import { expect, test } from "bun:test"
import { injectHtmlScript } from "../../src/server/routes/instance/httpapi/middleware/inject-html-script"
import { previewPageScript } from "../../src/server/routes/instance/httpapi/middleware/preview-page-script"
import {
  PREVIEW_LOOPBACK_HOSTS,
  previewUnreachablePage,
  previewUpstreamURL,
  stripFramingHeaders,
} from "../../src/server/routes/instance/httpapi/middleware/proxy"

test("injects preview instrumentation before page scripts", () => {
  expect(injectHtmlScript("<html><head><script>start()</script></head></html>", "capture()")).toBe(
    "<html><head><script>capture()</script><script>start()</script></head></html>",
  )
  expect(injectHtmlScript("<main>preview</main>", "capture()")).toBe("<script>capture()</script><main>preview</main>")
})

test("preview script captures console, errors, and element picks", () => {
  expect(previewPageScript).toContain("opencode-preview-console")
  expect(previewPageScript).toContain("opencode-preview-pick")
  expect(previewPageScript).toContain("console.log")
  expect(previewPageScript).toContain("window.open")
  expect(previewPageScript).toContain("location.assign")
  expect(previewPageScript).not.toContain("</script>")
})

test("strips frame-busting headers so project previews can load in the iframe", () => {
  const headers = new Headers({
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'self'; frame-ancestors 'none'; script-src 'self'",
  })
  stripFramingHeaders(headers)
  expect(headers.has("x-frame-options")).toBe(false)
  expect(headers.get("content-security-policy")).toBe("default-src 'self'; script-src 'self'")
})

test("preview upstream URLs cover IPv4 and IPv6 loopback", () => {
  expect(PREVIEW_LOOPBACK_HOSTS[0]).toBe("localhost")
  expect(previewUpstreamURL(5173, "/", "localhost").href).toBe("http://localhost:5173/")
  expect(previewUpstreamURL(5173, "/app?x=1", "127.0.0.1").href).toBe("http://127.0.0.1:5173/app?x=1")
  expect(previewUpstreamURL(5173, "/", "[::1]").href).toBe("http://[::1]:5173/")
})

test("unreachable preview page names the port instead of rendering blank", () => {
  const page = previewUnreachablePage(5173)
  expect(page).toContain("5173")
  expect(page).toContain("0.0.0.0")
  expect(page).toContain("--base /preview/5173/")
})

test("an IPv6-only server is reachable through at least one preview loopback host", async () => {
  const server = Bun.serve({
    hostname: "::1",
    port: 0,
    fetch() {
      return new Response("ok")
    },
  })
  try {
    const port = server.port
    if (port === undefined) throw new Error("expected ephemeral port")
    const hits = await Promise.all(
      PREVIEW_LOOPBACK_HOSTS.map(async (host) => {
        try {
          const response = await fetch(previewUpstreamURL(port, "/", host), { signal: AbortSignal.timeout(400) })
          return response.ok
        } catch {
          return false
        }
      }),
    )
    expect(hits.some(Boolean)).toBe(true)
  } finally {
    await server.stop(true)
  }
})
