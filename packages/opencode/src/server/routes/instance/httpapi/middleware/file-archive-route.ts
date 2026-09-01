import { Effect } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"
import path from "path"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { zipDirectory } from "@/util/zip-archive"

function queryValue(request: { url: string; headers: Record<string, string | undefined> }, name: string) {
  const url = new URL(request.url, "http://localhost")
  const header = name === "directory" ? request.headers["x-opencode-directory"] : undefined
  const raw = url.searchParams.get(name) || header || ""
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function attachment(filename: string, contentType: string, body: Uint8Array) {
  const headers = new Headers({
    "content-type": contentType,
    "content-disposition": `attachment; filename="${filename.replaceAll('"', "")}"`,
  })
  return HttpServerResponse.raw(body, { headers })
}

export const fileArchiveRoute = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    yield* router.add("GET", "/file/archive", (request) =>
      Effect.gen(function* () {
        const directory = queryValue(request, "directory")
        if (!directory) return HttpServerResponse.empty({ status: 400 })
        const zip = yield* Effect.tryPromise(() => zipDirectory(directory)).pipe(
          Effect.catch(() => Effect.succeed(undefined)),
        )
        if (!zip) return HttpServerResponse.empty({ status: 500 })
        const name = `${path.basename(directory) || "project"}.zip`
        return attachment(name, "application/zip", zip)
      }),
    )
    yield* router.add("GET", "/file/download", (request) =>
      Effect.gen(function* () {
        const directory = queryValue(request, "directory")
        const relative = queryValue(request, "path")
        if (!directory || !relative) return HttpServerResponse.empty({ status: 400 })
        const file = path.resolve(directory, relative)
        if (!FSUtil.contains(directory, file)) return HttpServerResponse.empty({ status: 400 })
        const exists = yield* fs.existsSafe(file)
        if (!exists) return HttpServerResponse.empty({ status: 404 })
        const body = yield* fs.readFile(file).pipe(Effect.catch(() => Effect.succeed(undefined)))
        if (!body) return HttpServerResponse.empty({ status: 500 })
        return attachment(path.basename(file), FSUtil.mimeType(file), body)
      }),
    )
  }),
)
