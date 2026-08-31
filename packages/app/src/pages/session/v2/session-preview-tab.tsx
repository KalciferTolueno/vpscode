import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useLanguage } from "@/context/language"

const STORAGE_PREFIX = "opencode.preview.url"
const DEFAULT_URL = ""
const COMMON_PORTS = [3000, 5000, 5173, 8000, 8080, 4173, 4200]

// Injected into the preview iframe: captures console errors/warnings, uncaught
// errors/rejections and failed resource loads, reporting each to the parent.
const CONSOLE_SCRIPT = `
(function(){
  if (window.__ocCon) return
  window.__ocCon = true
  function send(level, text, source){
    try {
      parent.postMessage({ type: "opencode-preview-console", level: level, text: String(text).slice(0, 500), source: source || "" }, window.location.origin)
    } catch(e){}
  }
  try {
    var ce = console.error
    var cw = console.warn
    console.error = function(){ send("error", Array.prototype.map.call(arguments, String).join(" "), "console.error"); ce.apply(console, arguments) }
    console.warn = function(){ send("warn", Array.prototype.map.call(arguments, String).join(" "), "console.warn"); cw.apply(console, arguments) }
    window.addEventListener("error", function(e){
      var t = e.target
      if (t && t !== window && t.tagName && (t.tagName === "IMG" || t.tagName === "SCRIPT" || t.tagName === "LINK" || t.tagName === "VIDEO" || t.tagName === "AUDIO")){
        send("error", "Recurso fallido: " + (t.src || t.href || t.tagName), "network")
      } else {
        send("error", e.message || "Error", "window.onerror")
      }
    }, true)
    window.addEventListener("unhandledrejection", function(e){
      send("error", (e.reason && e.reason.message) ? e.reason.message : String(e.reason || "rechazada"), "promise")
    })
  } catch(e){}
})()
`

// Runs inside the preview iframe: hover-highlight + click-capture, then reports
// the selected element to the parent via postMessage. Self-contained so it
// survives Solid re-renders.
const PICKER_SCRIPT = `
(function(){
  if (window.__ocPickActive) return
  window.__ocPickActive = true
  var style = document.createElement("style")
  style.id = "__opencode_pick_style__"
  style.textContent = "html.__ocPick, html.__ocPick *{cursor:crosshair!important}"
  document.head.appendChild(style)
  document.documentElement.classList.add("__ocPick")
  var hovered
  function reset(el){
    if(!el) return
    el.style.outline = el.dataset.ocPrevO || ""
    el.style.outlineOffset = el.dataset.ocPrevOf || ""
    delete el.dataset.ocPrevO
    delete el.dataset.ocPrevOf
  }
  function find(el){
    if(hovered === el) return
    reset(hovered)
    hovered = el
    el.dataset.ocPrevO = el.style.outline
    el.dataset.ocPrevOf = el.style.outlineOffset
    el.style.outline = "2px solid #f9825c"
    el.style.outlineOffset = "1px"
  }
  function path(el){
    var parts = []
    var n = el
    while(n && n.nodeType === 1 && parts.length < 5){
      if(n.id){ parts.unshift("#" + n.id); break }
      var s = n.tagName.toLowerCase()
      var p = n.parentElement
      if(p){
        var sibs = Array.prototype.filter.call(p.children, function(c){ return c.tagName === n.tagName })
        if(sibs.length > 1) s += ":nth-of-type(" + (sibs.indexOf(n) + 1) + ")"
      }
      parts.unshift(s)
      n = p
    }
    return parts.join(" > ")
  }
  function summary(el){
    var tag = el.tagName.toLowerCase()
    var id = el.id ? "#" + el.id : ""
    var cls = Array.prototype.slice.call(el.classList, 0, 3).map(function(c){ return "." + c }).join("")
    var text = (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40)
    return "<" + tag + id + cls + ">" + (text ? ' "' + text + '"' : "")
  }
  function done(picked, el){
    document.removeEventListener("mousemove", onMove, true)
    document.removeEventListener("click", onClick, true)
    document.removeEventListener("keydown", onKey, true)
    reset(hovered)
    style.remove()
    document.documentElement.classList.remove("__ocPick")
    window.__ocPickActive = false
    delete window.__ocPickCancel
    parent.postMessage({
      type: "opencode-preview-pick",
      picked: picked,
      summary: picked && el ? summary(el) + " — css: " + path(el) : null,
    }, window.location.origin)
  }
  window.__ocPickCancel = function(){ done(false, null) }
  function onMove(e){ if(e.target instanceof HTMLElement) find(e.target) }
  function onClick(e){
    e.preventDefault()
    e.stopPropagation()
    done(true, e.target instanceof Element ? e.target : null)
  }
  function onKey(e){ if(e.key === "Escape") done(false, null) }
  document.addEventListener("mousemove", onMove, true)
  document.addEventListener("click", onClick, true)
  document.addEventListener("keydown", onKey, true)
})()
`

function normalizePreviewUrl(value: string) {
  let next = value.trim()
  if (!next) return next
  if (next.startsWith("/")) {
    // Resolve a root-relative route (the agent publishes /preview/<port>/) against
    // the proxy's own origin so the bar shows a full, copy-pasteable URL.
    try {
      return new URL(next, location.origin).toString()
    } catch {
      return next
    }
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(next)) next = `https://${next}`
  return next
}

// Per-tab registry so the outside world (the .opencode/preview watcher) can
// target a specific session + browser tab's URL. Keyed by `${sessionKey}.${tabId}`
// so each chat/project keeps its own browser independently.
const registries = new Map<string, { set(value: string): void }>()

export function setPreviewUrlFor(sessionKey: string, tabId: string, value: string) {
  const next = normalizePreviewUrl(value)
  if (!next) return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${sessionKey}.${tabId}`, next)
  } catch {}
  registries.get(`${sessionKey}.${tabId}`)?.set(next)
}

function initialUrl(sessionKey: string, tabId: string) {
  if (typeof localStorage === "undefined") return DEFAULT_URL
  try {
    return normalizePreviewUrl(localStorage.getItem(`${STORAGE_PREFIX}.${sessionKey}.${tabId}`) ?? DEFAULT_URL)
  } catch {
    return DEFAULT_URL
  }
}

// Inserts a compact, expandable element chip into the prompt editor. The full
// detail stays in the DOM (so the LLM receives it on submit) but is collapsed
// visually to one line; clicking it expands/collapses.
function insertElementChip(fullText: string) {
  const editor = document.querySelector<HTMLElement>('[data-component="prompt-input"][contenteditable="true"]')
  if (!editor) return false
  editor.focus()
  const selection = window.getSelection()
  let range: Range
  if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
    range = selection.getRangeAt(0)
  } else {
    range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  range.deleteContents()
  const chip = document.createElement("span")
  chip.contentEditable = "false"
  chip.textContent = fullText
  chip.className = "oc-element-chip"
  chip.style.cssText =
    "display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;padding:1px 6px;border-radius:6px;background:rgba(249,130,92,.15);border:1px solid rgba(249,130,92,.5);color:inherit;cursor:pointer;"
  chip.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    const expanded = chip.style.whiteSpace === "normal"
    chip.style.whiteSpace = expanded ? "nowrap" : "normal"
    chip.style.maxWidth = expanded ? "220px" : "100%"
    chip.style.overflow = expanded ? "hidden" : "visible"
    chip.style.textOverflow = expanded ? "ellipsis" : "clip"
  })
  range.insertNode(chip)
  range.setStartAfter(chip)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
  // Sync the prompt store (parses the DOM, keeping the chip's full text).
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: fullText }))
  return true
}

const WIDTHS = [
  { view: "100%", key: "desktop", icon: "layout-right" },
  { view: "768px", key: "tablet", icon: "layout-right-partial" },
  { view: "390px", key: "mobile", icon: "layout-right" },
] as const

type ConsoleEntry = { level: "error" | "warn"; text: string; source: string; ts: number }

export function SessionPreviewTab(props: { tabId: string; sessionKey: string }) {
  const language = useLanguage()
  const [url, setUrl] = createSignal(initialUrl(props.sessionKey, props.tabId))
  const [draft, setDraft] = createSignal(url())
  const [nonce, setNonce] = createSignal(0)
  const [picking, setPicking] = createSignal(false)
  const [hist, setHist] = createSignal<string[]>([url()])
  const [histIdx, setHistIdx] = createSignal(0)
  const [width, setWidth] = createSignal("100%")
  const [consoleOpen, setConsoleOpen] = createSignal(false)
  const [consoleEntries, setConsoleEntries] = createSignal<ConsoleEntry[]>([])
  const [alivePorts, setAlivePorts] = createSignal<number[]>([])
  let iframe: HTMLIFrameElement | undefined
  let eCurrent: HTMLInputElement | undefined
  let reloadTimer: number | undefined

  const registriesKey = `${props.sessionKey}.${props.tabId}`
  registries.set(registriesKey, { set: setUrl })
  onCleanup(() => {
    registries.delete(registriesKey)
  })

  // Keep the address bar in sync when the URL is set externally (the agent).
  createEffect(() => setDraft(url()))

  // A0 — live reload: poll the served page's Last-Modified/ETag and reload the
  // iframe when it changes. Works for any static server (python -m http.server)
  // without relying on framework HMR or watcher events.
  const queueReload = () => {
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = window.setTimeout(() => setNonce((n) => n + 1), 400)
  }
  createEffect(() => {
    const base = url()
    if (!base) return
    let same = false
    try {
      same = new URL(base, location.origin).origin === location.origin
    } catch {
      same = false
    }
    if (!same) return
    let last: string | null = null
    let first = true
    const iv = window.setInterval(async () => {
      try {
        const res = await fetch(base, { method: "HEAD", cache: "no-store" })
        const lm =
          res.headers.get("last-modified") ?? res.headers.get("etag") ?? res.headers.get("content-length") ?? ""
        if (!first && lm && lm !== last) queueReload()
        last = lm
        first = false
      } catch {
        last = null
      }
    }, 1600)
    return () => window.clearInterval(iv)
  })

  // A3 — probe which common dev ports are alive and suggest only those.
  createEffect(() => {
    const base = url()
    if (!base) return
    let cancelled = false
    void (async () => {
      const results = await Promise.all(
        COMMON_PORTS.map(async (p) => {
          try {
            const ctrl = new AbortController()
            const t = window.setTimeout(() => ctrl.abort(), 1500)
            const res = await fetch(`${location.origin}/preview/${p}/`, { cache: "no-store", signal: ctrl.signal })
            window.clearTimeout(t)
            return res.ok ? p : null
          } catch {
            return null
          }
        }),
      )
      if (!cancelled) setAlivePorts(results.filter((x): x is number => x !== null))
    })()
    return () => {
      cancelled = true
    }
  })

  const pushHist = (v: string) => {
    const next = [...hist().slice(0, histIdx() + 1), v]
    setHist(next)
    setHistIdx(next.length - 1)
  }

  const goBack = () => {
    const i = histIdx()
    if (i <= 0) return
    const v = hist()[i - 1]
    setHistIdx(i - 1)
    setDraft(v)
    setUrl(v)
    setNonce((n) => n + 1)
  }

  const goForward = () => {
    const i = histIdx()
    if (i >= hist().length - 1) return
    const v = hist()[i + 1]
    setHistIdx(i + 1)
    setDraft(v)
    setUrl(v)
    setNonce((n) => n + 1)
  }

  const setCurrent = (value: string) => {
    const next = normalizePreviewUrl(value)
    if (!next) return
    if (next !== url()) pushHist(next)
    setDraft(next)
    setUrl(next)
    setNonce((n) => n + 1)
    try {
      localStorage.setItem(`${STORAGE_PREFIX}.${props.sessionKey}.${props.tabId}`, next)
    } catch {}
  }

  const commit = () => {
    const value = draft().trim()
    if (!value) {
      setDraft(url())
      return
    }
    setCurrent(value)
    eCurrent?.blur()
  }

  const src = createMemo(() => {
    const base = url()
    if (!base) return "about:blank"
    return nonce() ? `${base}${base.includes("?") ? "&" : "?"}_r=${nonce()}` : base
  })

  const sameOrigin = () => {
    try {
      return new URL(src(), location.origin).origin === location.origin
    } catch {
      return false
    }
  }

  const injectConsole = () => {
    if (!sameOrigin()) return
    const doc = iframe?.contentDocument
    if (!doc || (iframe?.contentWindow as (Window & { __ocCon?: boolean }) | null)?.__ocCon) return
    const script = doc.createElement("script")
    script.textContent = CONSOLE_SCRIPT
    doc.head.appendChild(script)
    script.remove()
  }

  const togglePick = () => {
    const doc = iframe?.contentDocument
    if (!doc) return
    if (picking()) {
      ;(iframe?.contentWindow as (Window & { __ocPickCancel?: () => void }) | null)?.__ocPickCancel?.()
      return
    }
    const script = doc.createElement("script")
    script.textContent = PICKER_SCRIPT
    doc.head.appendChild(script)
    script.remove()
    setPicking(true)
  }

  const cycleWidth = () => {
    const idx = WIDTHS.findIndex((w) => w.view === width())
    setWidth(WIDTHS[(idx + 1) % WIDTHS.length].view)
  }

  const widthLabel = () => {
    const w = WIDTHS.find((x) => x.view === width())
    return w ? language.t(`session.preview.responsive.${w.key}`) : ""
  }

  const errorCount = () => consoleEntries().filter((e) => e.level === "error").length

  const sendErrors = () => {
    if (!consoleEntries().length) return
    insertElementChip(
      ` [${language.t("session.preview.console")}:\n${consoleEntries()
        .map((entry) => `- ${entry.source ? `${entry.source}: ` : ""}${entry.text}`)
        .join("\n")}] `,
    )
  }

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== location.origin) return
    const data = event.data as {
      type?: string
      picked?: boolean
      summary?: string | null
      level?: string
      text?: string
      source?: string
    }
    if (data?.type === "opencode-preview-pick") {
      setPicking(false)
      if (data.picked && data.summary) {
        insertElementChip(` [${language.t("session.preview.element")}: ${data.summary}] `)
      }
      return
    }
    if (data?.type === "opencode-preview-console" && data.text) {
      const entry: ConsoleEntry = {
        level: data.level === "warn" ? "warn" : "error",
        text: data.text,
        source: data.source ?? "",
        ts: Date.now(),
      }
      setConsoleEntries((list) => {
        const next = [...list, entry]
        return next.length > 100 ? next.slice(-100) : next
      })
    }
  }
  window.addEventListener("message", onMessage)
  onCleanup(() => window.removeEventListener("message", onMessage))

  // A4 — keyboard shortcuts in the browser tab (don't hijack the chat).
  const onWindowKey = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return
    const t = event.target as HTMLElement | null
    const editable = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
    const key = event.key.toLowerCase()
    if (key === "r" && !editable) {
      event.preventDefault()
      setNonce((n) => n + 1)
    } else if (key === "l" && !editable) {
      event.preventDefault()
      eCurrent?.focus()
      eCurrent?.select()
    }
  }
  window.addEventListener("keydown", onWindowKey)
  onCleanup(() => window.removeEventListener("keydown", onWindowKey))

  const portOptions = createMemo(() => (alivePorts().length ? alivePorts() : COMMON_PORTS))

  return (
    <div data-component="session-preview" class="flex flex-col h-full min-h-0 bg-v2-background-bg-base">
      <div class="flex items-center gap-1 px-2 py-2 border-b border-v2-border-border-base shrink-0 bg-v2-background-bg-base">
        <IconButton
          icon="arrow-left"
          variant="ghost"
          class="h-6 w-6"
          disabled={histIdx() <= 0}
          onClick={goBack}
          aria-label={language.t("session.preview.back")}
        />
        <IconButton
          icon="arrow-right"
          variant="ghost"
          class="h-6 w-6"
          disabled={histIdx() >= hist().length - 1}
          onClick={goForward}
          aria-label={language.t("session.preview.forward")}
        />
        <IconButton
          icon="refresh"
          variant="ghost"
          class="h-6 w-6"
          onClick={() => setNonce((n) => n + 1)}
          aria-label={language.t("session.preview.reload")}
        />
        <input
          ref={(el) => (eCurrent = el)}
          type="text"
          value={draft()}
          list="opencode-preview-ports"
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit()
            }
          }}
          onBlur={() => setDraft(url())}
          class="flex-1 min-w-0 h-7 px-2 rounded-[2px] bg-v2-background-bg-deep text-12-regular text-v2-text-text-base outline-none border border-v2-border-border-base focus:border-v2-border-border-focus"
          placeholder={language.t("session.preview.placeholder")}
          aria-label={language.t("session.preview.url")}
          spellcheck={false}
          autocomplete="off"
        />
        <datalist id="opencode-preview-ports">
          {portOptions().map((p) => (
            <option value={`${location.origin}/preview/${p}/`} />
          ))}
        </datalist>
        <IconButton
          icon={WIDTHS.find((w) => w.view === width())?.icon ?? "layout-right"}
          variant="ghost"
          class="h-6 w-6"
          onClick={cycleWidth}
          aria-label={language.t("session.preview.responsive")}
          title={widthLabel()}
        />
        <div class="relative">
          <IconButton
            icon="console"
            variant="ghost"
            class="h-6 w-6"
            classList={{ "!bg-v2-overlay-simple-overlay-hover": consoleOpen() }}
            onClick={() => setConsoleOpen((o) => !o)}
            aria-label={language.t("session.preview.console")}
            aria-pressed={consoleOpen()}
          />
          <Show when={consoleEntries().length > 0}>
            <span class="absolute -top-1 -right-1 rounded-full bg-text-on-critical-base px-1 leading-3 text-10-regular text-white">
              {errorCount() || consoleEntries().length}
            </span>
          </Show>
        </div>
        <IconButton
          icon="magnifying-glass"
          variant="ghost"
          class="h-6 w-6"
          classList={{ "!bg-v2-overlay-simple-overlay-hover": picking() }}
          disabled={!sameOrigin()}
          onClick={togglePick}
          aria-label={language.t("session.preview.pickElement")}
          aria-pressed={picking()}
        />
        <IconButton
          icon="square-arrow-top-right"
          variant="ghost"
          class="h-6 w-6"
          disabled={!url()}
          onClick={() => window.open(url(), "_blank", "noopener")}
          aria-label={language.t("session.preview.openExternal")}
        />
      </div>
      <div class="flex-1 min-h-0 grid place-items-center overflow-hidden bg-v2-background-bg-deep">
        <Show
          when={url()}
          fallback={
            <div class="flex items-center justify-center text-center px-6 text-12-regular text-text-weak">
              {language.t("session.preview.empty")}
            </div>
          }
        >
          <iframe
            ref={(el) => (iframe = el)}
            onLoad={() => {
              setPicking(false)
              injectConsole()
            }}
            class="h-full border-0 bg-white"
            style={{ width: width() }}
            src={src()}
            title={language.t("session.tab.browser")}
          />
        </Show>
      </div>
      <Show when={consoleOpen()}>
        <div class="shrink-0 max-h-40 overflow-auto border-t border-border-weaker-base bg-background-stronger px-2 py-1.5 space-y-0.5 font-mono text-11-regular">
          <div class="sticky top-0 flex items-center justify-between bg-background-stronger pb-1 text-12-medium text-text-weak">
            <span>{language.t("session.preview.console")}</span>
            <IconButton
              icon="prompt"
              variant="ghost"
              class="h-6 w-6"
              disabled={!consoleEntries().length}
              onClick={sendErrors}
              aria-label={language.t("prompt.action.send")}
            />
          </div>
          <For
            each={consoleEntries()}
            fallback={
              <div class="text-12-regular text-text-weak py-1">{language.t("session.preview.consoleEmpty")}</div>
            }
          >
            {(entry) => (
              <div class="flex gap-2 items-start">
                <span class={entry.level === "error" ? "text-text-on-critical-base" : "text-text-weak"}>
                  {entry.level === "error" ? "✕" : "⚠"}
                </span>
                <span class="text-text-base break-all">{entry.text}</span>
                <span class="text-text-weak ml-auto shrink-0">{entry.source}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
