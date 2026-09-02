import { expect, test } from "bun:test"
import { injectHtmlScript } from "../../src/server/routes/instance/httpapi/middleware/inject-html-script"
import { previewPageScript } from "../../src/server/routes/instance/httpapi/middleware/preview-page-script"
import {
  preparePreviewBody,
  rewritePreviewCss,
  rewritePreviewHtml,
  rewritePreviewJs,
} from "../../src/server/routes/instance/httpapi/middleware/rewrite-preview-urls"
import {
  PREVIEW_LOOPBACK_HOSTS,
  PREVIEW_UNREACHABLE_STATUS,
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
  expect(previewPageScript).toContain("vite-hmr")
  expect(previewPageScript).toContain("WebSocket")
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
  expect(PREVIEW_LOOPBACK_HOSTS[0]).toBe("127.0.0.1")
  expect(previewUpstreamURL(5173, "/", "localhost").href).toBe("http://localhost:5173/")
  expect(previewUpstreamURL(5173, "/app?x=1", "127.0.0.1").href).toBe("http://127.0.0.1:5173/app?x=1")
  expect(previewUpstreamURL(5173, "/", "[::1]").href).toBe("http://[::1]:5173/")
})

test("unreachable preview page names the port instead of rendering blank", () => {
  const page = previewUnreachablePage(5173)
  expect(PREVIEW_UNREACHABLE_STATUS).toBe(200)
  expect(page).toContain("5173")
  expect(page).toContain("0.0.0.0")
  expect(page).toContain("--host 0.0.0.0 --port 5173")
  expect(page).toContain("not an EasyPanel service")
  expect(page).not.toContain("--base")
})

test("rewrites Vite root-absolute assets onto the preview prefix", () => {
  expect(rewritePreviewHtml(`<script type="module" src="/src/main.tsx"></script>`, 5173)).toBe(
    `<script type="module" src="/preview/5173/src/main.tsx"></script>`,
  )
  expect(rewritePreviewHtml(`<script src="/preview/5173/@vite/client"></script>`, 5173)).toBe(
    `<script src="/preview/5173/@vite/client"></script>`,
  )
  expect(rewritePreviewHtml(`<img src="//cdn.example.com/x.png">`, 5173)).toBe(`<img src="//cdn.example.com/x.png">`)
  expect(rewritePreviewJs(`import "/@vite/client"; import "/src/main.tsx"; import Refresh from "/@react-refresh"`, 5173)).toBe(
    `import "/preview/5173/@vite/client"; import "/preview/5173/src/main.tsx"; import Refresh from "/preview/5173/@react-refresh"`,
  )
  expect(rewritePreviewCss(`body{background:url(/hero.png)}`, 5173)).toBe(`body{background:url(/preview/5173/hero.png)}`)
  const html = preparePreviewBody(
    `<html><head><script type="module" src="/src/main.tsx"></script></head></html>`,
    "text/html",
    5173,
    "capture()",
  )
  expect(html).toContain(`src="/preview/5173/src/main.tsx"`)
  expect(html).toContain(`<base href="/preview/5173/">`)
  expect(html).toContain(`"/@vite/":"/preview/5173/@vite/"`)
  expect(html).toContain("<script>capture()</script>")
  expect(html.indexOf("importmap")).toBeLessThan(html.indexOf('src="/preview/5173/src/main.tsx"'))
})

test("preview loopback hosts include IPv6", () => {
  expect(PREVIEW_LOOPBACK_HOSTS.includes("[::1]")).toBe(true)
  expect(previewUpstreamURL(5173, "/", "[::1]").href).toBe("http://[::1]:5173/")
})
