import { expect, test } from "bun:test"
import { injectHtmlScript } from "../../src/server/routes/instance/httpapi/middleware/inject-html-script"

test("injects preview instrumentation before page scripts", () => {
  expect(injectHtmlScript("<html><head><script>start()</script></head></html>", "capture()"))
    .toBe("<html><head><script>capture()</script><script>start()</script></head></html>")
  expect(injectHtmlScript("<main>preview</main>", "capture()"))
    .toBe("<script>capture()</script><main>preview</main>")
})
