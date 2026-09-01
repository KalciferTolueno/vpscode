import { injectHtmlHead } from "./inject-html-script"

export function previewPrefix(port: number) {
  return `/preview/${port}`
}

export function previewRewritable(contentType: string | undefined, port?: number) {
  if (!contentType) return false
  const type = contentType.toLowerCase()
  if (type.includes("text/html")) return true
  if (port === undefined) return false
  return type.includes("javascript") || type.includes("ecmascript") || type.includes("text/css")
}

export function preparePreviewBody(body: string, contentType: string, port: number | undefined, script: string) {
  const type = contentType.toLowerCase()
  if (type.includes("text/html")) return preparePreviewHtml(body, port, script)
  if (port === undefined) return body
  if (type.includes("javascript") || type.includes("ecmascript")) return rewritePreviewJs(body, port)
  if (type.includes("text/css")) return rewritePreviewCss(body, port)
  return body
}

export function preparePreviewHtml(html: string, port: number | undefined, script: string) {
  const rewritten = port === undefined ? html : rewritePreviewHtml(html, port)
  if (port === undefined) return injectHtmlHead(rewritten, `<script>${script}</script>`)
  const prefix = previewPrefix(port)
  const importMap = JSON.stringify({
    imports: {
      "/@vite/": `${prefix}/@vite/`,
      "/@id/": `${prefix}/@id/`,
      "/@fs/": `${prefix}/@fs/`,
      "/@react-refresh": `${prefix}/@react-refresh`,
      "/src/": `${prefix}/src/`,
      "/node_modules/": `${prefix}/node_modules/`,
    },
  })
  return injectHtmlHead(
    rewritten,
    `<script type="importmap">${importMap}</script><base href="${prefix}/"><script>${script}</script>`,
  )
}

export function rewritePreviewHtml(html: string, port: number) {
  const prefix = previewPrefix(port)
  return html.replace(/(\s(?:src|href|action|poster)=)(["'])\/(?!\/|preview\/)/gi, `$1$2${prefix}/`)
}

export function rewritePreviewJs(js: string, port: number) {
  const prefix = previewPrefix(port)
  return js.replace(
    /(["'`])\/((?:@vite\/|@id\/|@fs\/|@react-refresh|src\/|node_modules\/)[^"'`]*)\1/g,
    `$1${prefix}/$2$1`,
  )
}

export function rewritePreviewCss(css: string, port: number) {
  const prefix = previewPrefix(port)
  return css.replace(/url\(\s*(['"]?)\/(?!\/|preview\/)/g, `url($1${prefix}/`)
}
