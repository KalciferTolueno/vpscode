import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect, Schema } from "effect"
import path from "path"
import { InstanceState } from "@/effect/instance-state"
import * as Tool from "./tool"

const Parameters = Schema.Struct({
  port: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65535 })).annotate({
    description: "Port where the development server is listening",
  }),
})

export const PreviewTool = Tool.define(
  "preview",
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service

    return {
      description:
        "Show a local development server in Preview. Call this as soon as the server is listening — do not wait for the user to ask. Mentioning http://localhost:<port> in your reply also opens Preview. That is the only browser the user has: no OS browser, no popups, no new tabs. Do not publish the app, open a public URL, or create an EasyPanel service. Preview is an in-pane proxy to localhost. Start the server on 0.0.0.0 (not localhost-only) first, then call this tool with its port. Do not use source.unsplash.com (it is down). Prefer local SVG, CSS, or files in the project for images; Preview can load https CDNs from the user's browser and does not block Unsplash.",
      parameters: Parameters,
      execute: ({ port }: { port: number }) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const url = `http://localhost:${port}/`
          yield* fs.writeWithDirs(path.join(instance.directory, ".opencode", "preview"), url).pipe(Effect.orDie)
          return {
            title: `Preview :${port}`,
            metadata: { port, url },
            output: `Opened ${url} in Preview.`,
          }
        }),
    }
  }),
)
