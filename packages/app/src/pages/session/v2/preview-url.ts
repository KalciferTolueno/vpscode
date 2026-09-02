const LOOPBACK = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i
const PREVIEW_HOST = String.raw`(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])`
const PREVIEW_URL_RE = new RegExp(String.raw`(?:https?:\/\/)?${PREVIEW_HOST}:(\d{2,5})(?!\d)(?:\/[^\s"'<>\]]*)?`, "gi")
const PREVIEW_PROXY_RE = /\/preview\/(\d{2,5})(?!\d)(?:\/[^\s"'<>\]]*)?/g
const PREVIEW_SOURCE_TOOLS = new Set(["preview", "bash", "shell"])
const BLOCKED_PREVIEW_PORTS = new Set(["80", "443", "4096"])

export function normalizePreviewUrl(value: string) {
  const next = value.trim()
  if (!next) return next
  if (/^\d{2,5}$/.test(next)) return previewSrcForPort(next, "/")
  if (next.startsWith("/preview/")) return blockedPreviewSrc(next) ? "" : next
  const parsed = parseMaybeUrl(next)
  if (!parsed || !LOOPBACK.test(parsed.hostname)) return ""
  if (parsed.pathname.startsWith("/preview/")) {
    const src = `${parsed.pathname}${parsed.search}`
    return blockedPreviewSrc(src) ? "" : src
  }
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80")
  const path = parsed.pathname || "/"
  return previewSrcForPort(port, `${path}${parsed.search}`)
}

export function previewIframeSrc(value: string) {
  const next = normalizePreviewUrl(value)
  return next.startsWith("/preview/") ? next : ""
}

export type PreviewScanPart = {
  type: string
  text?: string
  tool?: string
  state?: {
    output?: string
    title?: string
    input?: { [key: string]: unknown }
    metadata?: { [key: string]: unknown }
  }
}

export function extractPreviewUrl(text: string) {
  const found: { index: number; src: string }[] = []
  for (const match of text.matchAll(PREVIEW_URL_RE)) {
    const src = candidatePreviewSrc(match[0])
    if (src && match.index !== undefined) found.push({ index: match.index, src })
  }
  for (const match of text.matchAll(PREVIEW_PROXY_RE)) {
    const src = candidatePreviewSrc(match[0])
    if (src && match.index !== undefined) found.push({ index: match.index, src })
  }
  return found.toSorted((a, b) => a.index - b.index).at(-1)?.src ?? ""
}

export function extractPreviewUrlFromPart(part: PreviewScanPart) {
  if (part.type === "text" && typeof part.text === "string") return extractPreviewUrl(part.text)
  if (part.type !== "tool") return ""
  return extractPreviewUrl(toolPreviewText(part))
}

export function latestPreviewUrlFromParts(parts: readonly PreviewScanPart[]) {
  return parts.reduce((found, part) => extractPreviewUrlFromPart(part) || found, "")
}

export const PREVIEW_WAITING_HEADER = "x-opencode-preview"
export const PREVIEW_WAITING_VALUE = "waiting"

export function previewResponseIsLive(ok: boolean, waiting: string | null) {
  return ok && waiting !== PREVIEW_WAITING_VALUE
}

export async function previewFrameReady(src: string) {
  if (!src.startsWith("/preview/")) return false
  try {
    const response = await fetch(src, { method: "GET", credentials: "same-origin" })
    return previewResponseIsLive(response.ok, response.headers.get(PREVIEW_WAITING_HEADER))
  } catch {
    return false
  }
}

export const PREVIEW_OPEN_EVENT = "opencode-preview-open"

export function requestPreviewOpen(value: string) {
  const next = previewIframeSrc(value)
  if (!next || typeof window === "undefined") return false
  window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_EVENT, { detail: next }))
  return true
}

export function startPreviewFilePoll(input: {
  directory: () => string | undefined
  read: (path: string) => Promise<string>
  onUrl: (url: string) => void
}) {
  let last = ""
  const tick = () => {
    const directory = input.directory()
    if (!directory) return
    const path = `${directory.replace(/[\\/]+$/, "")}/.opencode/preview`
    input
      .read(path)
      .then((text) => {
        const value = text.trim()
        if (!value || value === last) return
        last = value
        if (!previewIframeSrc(value)) return
        input.onUrl(value)
      })
      .catch(() => {})
  }
  tick()
  const timer = setInterval(tick, 2000)
  return () => clearInterval(timer)
}

function parseMaybeUrl(value: string) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return new URL(value)
  const host = value.split("/")[0] ?? ""
  const hostname = host.startsWith("[") ? (host.match(/^\[([^\]]+)\]/)?.[1] ?? "") : (host.split(":")[0] ?? "")
  if (!LOOPBACK.test(hostname) && !host.includes(".")) return
  const local = LOOPBACK.test(hostname)
  return new URL(`${local ? "http" : "https"}://${value}`)
}

function candidatePreviewSrc(raw: string) {
  const value = raw.replace(/[.,;:!?]+$/u, "")
  if (value.startsWith("[") && !value.includes("://")) return previewIframeSrc(`http://${value}`)
  return previewIframeSrc(value)
}

function toolPreviewText(part: PreviewScanPart) {
  if (!part.tool || !PREVIEW_SOURCE_TOOLS.has(part.tool)) return ""
  const state = part.state
  if (!state) return ""
  const port = state.input?.port
  const bits = [
    typeof state.output === "string" ? state.output : "",
    typeof state.title === "string" ? state.title : "",
    typeof state.metadata?.output === "string" ? state.metadata.output : "",
    typeof state.metadata?.url === "string" ? state.metadata.url : "",
    part.tool === "preview" && typeof port === "number" ? `http://localhost:${port}/` : "",
  ]
  return bits.filter(Boolean).join("\n")
}

function previewSrcForPort(port: string, path: string) {
  if (blockedPreviewPort(port)) return ""
  return `/preview/${port}${path.startsWith("/") ? path : `/${path}`}`
}

function blockedPreviewSrc(src: string) {
  return blockedPreviewPort(src.match(/^\/preview\/(\d{2,5})\b/)?.[1] ?? "")
}

function blockedPreviewPort(port: string) {
  if (!port || BLOCKED_PREVIEW_PORTS.has(port)) return true
  if (typeof location === "undefined") return false
  return !!location.port && port === location.port
}
