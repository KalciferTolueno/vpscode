import { ProxyUtil } from "@/server/proxy-util"
import { Effect, Stream } from "effect"
import { HttpBody, HttpClient, HttpClientRequest, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import * as Socket from "effect/unstable/socket/Socket"
import { WebSocketTracker } from "../websocket-tracker"
import { preparePreviewBody, previewRewritable } from "./rewrite-preview-urls"

function requestBody(request: HttpServerRequest.HttpServerRequest) {
  if (request.method === "GET" || request.method === "HEAD") return HttpBody.empty
  if (request.source instanceof Request && request.source.body === null) return HttpBody.empty
  const len = request.headers["content-length"]
  return HttpBody.stream(request.stream, request.headers["content-type"], len ? Number(len) : undefined)
}

export function websocket(
  request: HttpServerRequest.HttpServerRequest,
  target: string | URL,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, Socket.WebSocketConstructor> {
  return Effect.scoped(
    Effect.gen(function* () {
      const inbound = yield* Effect.orDie(request.upgrade)
      const outbound = yield* Socket.makeWebSocket(ProxyUtil.websocketTargetURL(target), {
        protocols: ProxyUtil.websocketProtocols(request.headers),
      })
      const writeInbound = yield* inbound.writer
      const writeOutbound = yield* outbound.writer
      const closeSocket = (socket: Socket.Socket, write: (event: Socket.CloseEvent) => Effect.Effect<void, unknown>) =>
        socket
          .runRaw(() => Effect.void, {
            onOpen: write(WebSocketTracker.SERVER_CLOSING_EVENT()).pipe(Effect.catch(() => Effect.void)),
          })
          .pipe(
            Effect.timeout("1 second"),
            Effect.catchReason("SocketError", "SocketCloseError", () => Effect.void),
            Effect.catch(() => Effect.void),
          )
      const closeAccepted = Effect.all([closeSocket(inbound, writeInbound), closeSocket(outbound, writeOutbound)], {
        concurrency: "unbounded",
        discard: true,
      })
      const registered = yield* WebSocketTracker.register(
        Effect.all(
          [
            writeInbound(WebSocketTracker.SERVER_CLOSING_EVENT()),
            writeOutbound(WebSocketTracker.SERVER_CLOSING_EVENT()),
          ],
          { concurrency: "unbounded", discard: true },
        ),
      )
      if (!registered) {
        yield* closeAccepted
        return HttpServerResponse.empty()
      }

      yield* outbound
        .runRaw((message) => writeInbound(message))
        .pipe(
          Effect.catchReason("SocketError", "SocketCloseError", (reason) =>
            writeInbound(new Socket.CloseEvent(reason.code, reason.closeReason)).pipe(Effect.catch(() => Effect.void)),
          ),
          Effect.catch(() =>
            writeInbound(new Socket.CloseEvent(1011, "proxy error")).pipe(Effect.catch(() => Effect.void)),
          ),
          Effect.forkScoped,
        )

      yield* inbound
        .runRaw((message) => {
          return writeOutbound(typeof message === "string" ? message : message.slice())
        })
        .pipe(
          Effect.catch(() => Effect.void),
          Effect.ensuring(writeOutbound(new Socket.CloseEvent()).pipe(Effect.catch(() => Effect.void))),
        )
      return HttpServerResponse.empty()
    }).pipe(Effect.orDie),
  )
}

function statusText(response: unknown) {
  return (response as { source?: Response }).source?.statusText
}

export function stripFramingHeaders(headers: Headers) {
  headers.delete("x-frame-options")
  const csp = headers.get("content-security-policy")
  if (!csp) return
  const next = csp
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && !/^frame-ancestors\b/i.test(item))
    .join("; ")
  if (next) headers.set("content-security-policy", next)
  else headers.delete("content-security-policy")
}

export const PREVIEW_LOOPBACK_HOSTS = ["127.0.0.1", "localhost", "[::1]"] as const

export function previewUpstreamURL(port: number, pathWithSearch: string, host: string) {
  const path = pathWithSearch.startsWith("/") ? pathWithSearch : `/${pathWithSearch}`
  return new URL(path, `http://${host}:${port}`)
}

export function previewUnreachablePage(port: number) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Preview unreachable</title></head>
<body style="margin:0;background:#121212;color:#eee;font:15px/1.5 ui-sans-serif,system-ui,sans-serif;padding:24px">
  <h1 style="font-size:18px">Preview cannot reach port ${port}</h1>
  <p>Nothing responded on localhost, 127.0.0.1, or ::1. Start the app with <code>--host 0.0.0.0 --port ${port}</code>.</p>
  <p>Vite: <code>vite --host 0.0.0.0 --port ${port}</code></p>
</body>
</html>`
}

function previewUnreachableResponse(port: number) {
  return HttpServerResponse.text(previewUnreachablePage(port), {
    status: 502,
    contentType: "text/html",
  })
}

function httpAttempt(
  client: HttpClient.HttpClient,
  url: string | URL,
  extra: HeadersInit | undefined,
  request: HttpServerRequest.HttpServerRequest,
  preview?: { port?: number; script: string },
) {
  return Effect.gen(function* () {
    const response = yield* client.execute(
      HttpClientRequest.make(request.method as never)(url, {
        headers: ProxyUtil.headers(request.headers as HeadersInit, extra),
        body: requestBody(request),
      }),
    )
    const headers = new Headers(response.headers as HeadersInit)
    headers.delete("content-encoding")
    headers.delete("content-length")
    if (preview) stripFramingHeaders(headers)

    // An upstream 5xx from a remote workspace sandbox arrives here as an opaque
    // status — its real cause (and log line) live only inside the sandbox. Buffer
    // the small error body, log it locally so it shows up in the host's log, and
    // forward it unchanged (preserving content-type so the client can still parse
    // the structured error, e.g. its `ref`).
    if (response.status >= 500) {
      const body = yield* response.text.pipe(Effect.catch(() => Effect.succeed("")))
      const contentType = response.headers["content-type"] ?? "application/json"
      headers.delete("content-type")
      yield* Effect.logError("workspace proxy upstream error", {
        url: url.toString(),
        method: request.method,
        status: response.status,
        body: body.slice(0, 2000),
      })
      return HttpServerResponse.text(body, {
        status: response.status,
        statusText: statusText(response),
        headers,
        contentType,
      })
    }

    const contentType = response.headers["content-type"]
    if (preview && request.method === "GET" && previewRewritable(contentType, preview.port)) {
      const body = yield* response.text
      headers.delete("content-type")
      return HttpServerResponse.text(preparePreviewBody(body, contentType ?? "", preview.port, preview.script), {
        status: response.status,
        statusText: statusText(response),
        headers,
        contentType,
      })
    }

    return HttpServerResponse.stream(response.stream.pipe(Stream.catchCause(() => Stream.empty)), {
      status: response.status,
      statusText: statusText(response),
      headers,
    })
  })
}

export function preview(
  client: HttpClient.HttpClient,
  port: number,
  pathWithSearch: string,
  request: HttpServerRequest.HttpServerRequest,
  script?: string,
): Effect.Effect<HttpServerResponse.HttpServerResponse> {
  return Effect.firstSuccessOf(
    PREVIEW_LOOPBACK_HOSTS.map((host) => {
      const target = previewUpstreamURL(port, pathWithSearch, host)
      return httpAttempt(client, target, { host: target.host }, request, script ? { port, script } : undefined)
    }),
  ).pipe(Effect.catch(() => Effect.succeed(previewUnreachableResponse(port))))
}

export function http(
  client: HttpClient.HttpClient,
  url: string | URL,
  extra: HeadersInit | undefined,
  request: HttpServerRequest.HttpServerRequest,
  script?: string,
): Effect.Effect<HttpServerResponse.HttpServerResponse> {
  return httpAttempt(client, url, extra, request, script ? { script } : undefined).pipe(
    Effect.catch(() => Effect.succeed(HttpServerResponse.empty({ status: 500 }))),
  )
}

export * as HttpApiProxy from "./proxy"
