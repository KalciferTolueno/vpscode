export function injectHtmlHead(html: string, snippet: string) {
  const head = /<head(?:\s[^>]*)?>/i.exec(html)
  if (!head || head.index === undefined) return snippet + html
  const index = head.index + head[0].length
  return html.slice(0, index) + snippet + html.slice(index)
}

export function injectHtmlScript(html: string, script: string) {
  return injectHtmlHead(html, `<script>${script}</script>`)
}
