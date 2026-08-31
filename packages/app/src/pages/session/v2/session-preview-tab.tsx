import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useLanguage } from "@/context/language"
import { previewIframeSrc } from "./preview-url"

const STORAGE_PREFIX = "opencode.preview.url"
const DEFAULT_URL = ""
const COMMON_PORTS = [3000, 5000, 5173, 8000, 8080, 4173, 4200]

const registries = new Map<string, { set(value: string): void }>()

export function setPreviewUrlFor(sessionKey: string, tabId: string, value: string) {
  const next = previewIframeSrc(value)
  if (!next) return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${sessionKey}.${tabId}`, next)
  } catch {}
  registries.get(`${sessionKey}.${tabId}`)?.set(next)
}

function initialUrl(sessionKey: string, tabId: string) {
  if (typeof localStorage === "undefined") return DEFAULT_URL
  try {
    const key = `${STORAGE_PREFIX}.${sessionKey}.${tabId}`
    const stored = localStorage.getItem(key) ?? DEFAULT_URL
    const next = previewIframeSrc(stored)
    if (stored && !next) localStorage.removeItem(key)
    return next
  } catch {
    return DEFAULT_URL
  }
}

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
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: fullText }))
  return true
}

const PRESETS = [
  { key: "desktop", icon: "layout-right", width: 1280, height: 720 },
  { key: "tablet", icon: "layout-right-partial", width: 768, height: 1024 },
  { key: "mobile", icon: "layout-right", width: 390, height: 844 },
] as const

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2
const ZOOM_STEP = 0.25

type ConsoleEntry = { level: "error" | "warn" | "log"; text: string; source: string; ts: number }

function consoleLevel(level: string) {
  if (level === "warn") return "warn"
  if (level === "error") return "error"
  return "log"
}

function consoleMark(level: ConsoleEntry["level"]) {
  if (level === "error") return { class: "text-text-on-critical-base", mark: "✕" }
  if (level === "warn") return { class: "text-text-weak", mark: "⚠" }
  return { class: "text-text-base", mark: "·" }
}

export function SessionPreviewTab(props: { tabId: string; sessionKey: string }) {
  const language = useLanguage()
  const [url, setUrl] = createSignal(initialUrl(props.sessionKey, props.tabId))
  const [draft, setDraft] = createSignal(url())
  const [iframeSrc, setIframeSrc] = createSignal(previewIframeSrc(url()))
  const [picking, setPicking] = createSignal(false)
  const [canBack, setCanBack] = createSignal(false)
  const [canForward, setCanForward] = createSignal(false)
  const [preset, setPreset] = createSignal<(typeof PRESETS)[number]["key"]>("desktop")
  const [zoom, setZoom] = createSignal(1)
  const [viewport, setViewport] = createSignal({ w: 0, h: 0 })
  const [consoleOpen, setConsoleOpen] = createSignal(false)
  const [consoleEntries, setConsoleEntries] = createSignal<ConsoleEntry[]>([])
  const [stageEl, setStageEl] = createSignal<HTMLDivElement>()
  let frame: HTMLIFrameElement | undefined
  let eCurrent: HTMLInputElement | undefined
  let history = url() ? [url()] : []
  let historyIndex = url() ? 0 : -1
  let skipRecord = false

  const registriesKey = `${props.sessionKey}.${props.tabId}`
  registries.set(registriesKey, { set: (value) => navigate(value) })
  onCleanup(() => {
    registries.delete(registriesKey)
  })

  createEffect(() => setDraft(url()))

  const persist = (next: string) => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}.${props.sessionKey}.${props.tabId}`, next)
    } catch {}
  }

  const syncHistoryButtons = () => {
    setCanBack(historyIndex > 0)
    setCanForward(historyIndex >= 0 && historyIndex < history.length - 1)
  }

  const navigate = (value: string) => {
    const next = previewIframeSrc(value)
    if (!next) return
    setDraft(next)
    setUrl(next)
    setIframeSrc(previewIframeSrc(next))
    history = [next]
    historyIndex = 0
    skipRecord = false
    syncHistoryButtons()
    persist(next)
  }

  const commit = () => {
    const value = draft().trim()
    if (!previewIframeSrc(value)) {
      setDraft(url())
      return
    }
    navigate(value)
    eCurrent?.blur()
  }

  const postPick = (enabled: boolean) => {
    frame?.contentWindow?.postMessage({ type: "opencode-preview-pick", enabled }, location.origin)
  }

  const recordLocation = () => {
    if (!frame) return
    try {
      const loc = frame.contentWindow?.location
      if (!loc) return
      const next = `${loc.pathname}${loc.search}${loc.hash}`
      if (!next.startsWith("/preview/") && loc.origin !== location.origin) return
      const path = next.startsWith("/") ? next : url()
      if (!path) return
      setUrl(path)
      setDraft(path)
      persist(path)
      if (skipRecord) {
        skipRecord = false
        return
      }
      if (history[historyIndex] === path) return
      history = history.slice(0, historyIndex + 1)
      history.push(path)
      historyIndex = history.length - 1
      syncHistoryButtons()
    } catch {}
  }

  const goHistory = (delta: number) => {
    const next = historyIndex + delta
    if (next < 0 || next >= history.length) return
    skipRecord = true
    historyIndex = next
    syncHistoryButtons()
    frame?.contentWindow?.history.go(delta)
  }

  const reload = () => {
    try {
      frame?.contentWindow?.location.reload()
    } catch {
      const current = iframeSrc()
      if (current) setIframeSrc("")
      requestAnimationFrame(() => setIframeSrc(current))
    }
  }

  const onFrameLoad = () => {
    recordLocation()
    if (picking()) postPick(true)
  }

  const onWindowMessage = (event: MessageEvent) => {
    if (event.origin !== location.origin) return
    const data = event.data as {
      type?: string
      level?: string
      text?: string
      source?: string
      summary?: string
      picked?: boolean
    }
    if (!data || typeof data !== "object") return
    if (data.type === "opencode-preview-console" && data.text) {
      const entry: ConsoleEntry = {
        level: consoleLevel(data.level ?? ""),
        text: data.text,
        source: data.source ?? "",
        ts: Date.now(),
      }
      setConsoleEntries((list) => {
        const next = [...list, entry]
        return next.length > 100 ? next.slice(-100) : next
      })
      return
    }
    if (data.type === "opencode-preview-pick") {
      setPicking(false)
      if (data.picked && data.summary) {
        insertElementChip(` [${language.t("session.preview.element")}: ${data.summary}] `)
      }
    }
  }
  window.addEventListener("message", onWindowMessage)
  onCleanup(() => window.removeEventListener("message", onWindowMessage))

  createEffect(() => {
    const el = stageEl()
    if (!el) return
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  const currentPreset = () => PRESETS.find((item) => item.key === preset()) ?? PRESETS[0]

  const frameLayout = createMemo(() => {
    const next = currentPreset()
    const pad = 16
    const availW = Math.max(viewport().w - pad, 1)
    const availH = Math.max(viewport().h - pad, 1)
    const fit = Math.min(availW / next.width, availH / next.height)
    const scale = Math.max(0.05, fit * zoom())
    return {
      vw: next.width,
      vh: next.height,
      scale,
      shellW: next.width * scale,
      shellH: next.height * scale,
    }
  })

  const cycleWidth = () => {
    const idx = PRESETS.findIndex((item) => item.key === preset())
    setPreset(PRESETS[(idx + 1) % PRESETS.length].key)
  }

  const nudgeZoom = (delta: number) => {
    setZoom((value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((value + delta) * 100) / 100)))
  }

  const widthLabel = () => language.t(`session.preview.responsive.${currentPreset().key}`)

  const errorCount = () => consoleEntries().filter((e) => e.level === "error").length

  const sendErrors = () => {
    if (!consoleEntries().length) return
    insertElementChip(
      ` [${language.t("session.preview.console")}:\n${consoleEntries()
        .map((entry) => `- ${entry.source ? `${entry.source}: ` : ""}${entry.text}`)
        .join("\n")}] `,
    )
  }

  const onWindowKey = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return
    const t = event.target as HTMLElement | null
    const editable = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
    const key = event.key.toLowerCase()
    if (key === "r" && !editable) {
      event.preventDefault()
      reload()
    } else if (key === "l" && !editable) {
      event.preventDefault()
      eCurrent?.focus()
      eCurrent?.select()
    }
  }
  window.addEventListener("keydown", onWindowKey)
  onCleanup(() => window.removeEventListener("keydown", onWindowKey))

  return (
    <div data-component="session-preview" class="flex flex-col h-full min-h-0 bg-v2-background-bg-base">
      <div class="flex items-center gap-1 px-2 py-2 border-b border-v2-border-border-base shrink-0 bg-v2-background-bg-base">
        <IconButton
          icon="arrow-left"
          variant="ghost"
          class="h-6 w-6"
          disabled={!canBack()}
          onClick={() => goHistory(-1)}
          aria-label={language.t("session.preview.back")}
        />
        <IconButton
          icon="arrow-right"
          variant="ghost"
          class="h-6 w-6"
          disabled={!canForward()}
          onClick={() => goHistory(1)}
          aria-label={language.t("session.preview.forward")}
        />
        <IconButton
          icon="refresh"
          variant="ghost"
          class="h-6 w-6"
          disabled={!iframeSrc()}
          onClick={reload}
          aria-label={language.t("session.preview.reload")}
        />
        <input
          ref={(el) => (eCurrent = el)}
          type="text"
          value={draft()}
          list="opencode-preview-ports"
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
          }}
          onBlur={() => setDraft(url())}
          class="flex-1 min-w-0 h-7 px-2 rounded-[2px] bg-v2-background-bg-deep text-12-regular text-v2-text-text-base outline-none border border-v2-border-border-base focus:border-v2-border-border-focus"
          placeholder={language.t("session.preview.placeholder")}
          aria-label={language.t("session.preview.url")}
          spellcheck={false}
          autocomplete="off"
        />
        <datalist id="opencode-preview-ports">
          {COMMON_PORTS.map((p) => (
            <option value={`/preview/${p}/`} />
          ))}
        </datalist>
        <IconButton
          icon={currentPreset().icon}
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
          disabled={!iframeSrc()}
          onClick={() => {
            const next = !picking()
            setPicking(next)
            postPick(next)
          }}
          aria-label={language.t("session.preview.pickElement")}
          aria-pressed={picking()}
        />
      </div>
      <div ref={setStageEl} class="flex-1 min-h-0 relative overflow-hidden bg-v2-background-bg-deep">
        <div class="absolute inset-0 overflow-auto p-2 flex items-[safe_center] justify-[safe_center]">
          <div
            class="relative shrink-0 overflow-hidden bg-white border border-v2-border-border-base"
            style={{
              width: `${frameLayout().shellW}px`,
              height: `${frameLayout().shellH}px`,
            }}
          >
            <Show
              when={iframeSrc()}
              fallback={
                <div class="absolute inset-0 flex items-center justify-center text-center px-6 text-12-regular text-text-weak">
                  {language.t("session.preview.empty")}
                </div>
              }
            >
              <iframe
                ref={(el) => (frame = el)}
                src={iframeSrc()}
                class="absolute top-0 left-0 border-0 bg-white origin-top-left"
                style={{
                  width: `${frameLayout().vw}px`,
                  height: `${frameLayout().vh}px`,
                  transform: `scale(${frameLayout().scale})`,
                }}
                title={language.t("session.tab.browser")}
                onLoad={onFrameLoad}
              />
            </Show>
          </div>
        </div>
        <Show when={consoleOpen()}>
          <div class="absolute inset-x-0 bottom-0 z-20 max-h-48 overflow-auto border-t border-border-weaker-base bg-background-stronger/95 px-2 py-1.5 space-y-0.5 font-mono text-11-regular">
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
              {(entry) => {
                const mark = consoleMark(entry.level)
                return (
                  <div class="flex gap-2 items-start">
                    <span class={mark.class}>{mark.mark}</span>
                    <span class="text-text-base break-all">{entry.text}</span>
                    <span class="text-text-weak ml-auto shrink-0">{entry.source}</span>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </div>
      <div class="shrink-0 flex items-center justify-center gap-1 px-2 py-1.5 border-t border-v2-border-border-base bg-v2-background-bg-base">
        <IconButton
          icon="minus-small"
          variant="ghost"
          class="h-6 w-6"
          disabled={zoom() <= ZOOM_MIN}
          onClick={() => nudgeZoom(-ZOOM_STEP)}
          aria-label={language.t("session.preview.zoomOut")}
        />
        <span class="min-w-10 text-center text-12-regular text-v2-text-text-weak" aria-label={language.t("session.preview.zoom")}>
          {Math.round(zoom() * 100)}%
        </span>
        <IconButton
          icon="plus-small"
          variant="ghost"
          class="h-6 w-6"
          disabled={zoom() >= ZOOM_MAX}
          onClick={() => nudgeZoom(ZOOM_STEP)}
          aria-label={language.t("session.preview.zoomIn")}
        />
      </div>
    </div>
  )
}
