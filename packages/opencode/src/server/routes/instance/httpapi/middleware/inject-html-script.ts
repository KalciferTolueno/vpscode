export function injectHtmlScript(html: string, script: string) {
  const tag = `<script>${script}</script>`
  const head = /<head(?:\s[^>]*)?>/i.exec(html)
  if (!head || head.index === undefined) return tag + html
  const index = head.index + head[0].length
  return html.slice(0, index) + tag + html.slice(index)
}
