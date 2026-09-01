import { expect, test } from "bun:test"
import { injectHtmlScript } from "../../src/server/routes/instance/httpapi/middleware/inject-html-script"
import { previewPageScript } from "../../src/server/routes/instance/httpapi/middleware/preview-page-script"
import { stripFramingHeaders } from "../../src/server/routes/instance/httpapi/middleware/proxy"

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
