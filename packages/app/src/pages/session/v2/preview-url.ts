const LOOPBACK = /^(localhost|127\.0\.0\.1)$/i

export function normalizePreviewUrl(value: string) {
  const next = value.trim()
  if (!next) return next
  if (/^\d{2,5}$/.test(next)) return `/preview/${next}/`
  if (next.startsWith("/preview/")) return next
  const parsed = parseMaybeUrl(next)
  if (!parsed || !LOOPBACK.test(parsed.hostname)) return ""
  if (parsed.pathname.startsWith("/preview/")) return `${parsed.pathname}${parsed.search}`
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80")
  const path = parsed.pathname || "/"
  return `/preview/${port}${path}${parsed.search}`
}

export function previewIframeSrc(value: string) {
  const next = normalizePreviewUrl(value)
  return next.startsWith("/preview/") ? next : ""
}

function parseMaybeUrl(value: string) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return new URL(value)
  const host = value.split("/")[0] ?? ""
  const hostname = host.split(":")[0] ?? ""
  if (!LOOPBACK.test(hostname) && !host.includes(".")) return
  const local = LOOPBACK.test(hostname)
  return new URL(`${local ? "http" : "https"}://${value}`)
}
