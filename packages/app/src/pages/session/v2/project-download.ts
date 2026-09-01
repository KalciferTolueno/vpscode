import { authTokenFromCredentials } from "@/utils/server"
import type { ServerConnection } from "@/context/server"

export const ARTIFACT_EXTENSIONS = [".apk", ".aab", ".ipa", ".exe", ".dmg", ".msix"] as const

export function isArtifactPath(file: string) {
  const lower = file.toLowerCase()
  return ARTIFACT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function projectDownloadHeaders(server: ServerConnection.Any | undefined): Record<string, string> {
  if (!server?.http.password) return {}
  return {
    Authorization: `Basic ${authTokenFromCredentials({
      username: server.http.username,
      password: server.http.password,
    })}`,
  }
}

export async function downloadProjectBlob(input: {
  url: string
  headers: Record<string, string>
  filename: string
  fetch?: typeof fetch
}) {
  const response = await (input.fetch ?? fetch)(input.url, { headers: input.headers })
  if (!response.ok) throw new Error(String(response.status))
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = input.filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(href)
}

export function archiveUrl(baseUrl: string, directory: string) {
  const url = new URL("/file/archive", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`)
  url.searchParams.set("directory", directory)
  return url.toString()
}

export function fileDownloadUrl(baseUrl: string, directory: string, path: string) {
  const url = new URL("/file/download", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`)
  url.searchParams.set("directory", directory)
  url.searchParams.set("path", path)
  return url.toString()
}
