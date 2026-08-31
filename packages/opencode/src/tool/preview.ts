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
        "Open a development server in the user's built-in browser. Start the server on 0.0.0.0 first, then call this tool with its port. For Vite, use base /preview/<port>/ so absolute assets resolve through the proxy.",
      parameters: Parameters,
      execute: ({ port }: { port: number }) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const url = `/preview/${port}/`
          yield* fs.writeWithDirs(path.join(instance.directory, ".opencode", "preview"), url).pipe(Effect.orDie)
          return {
            title: `Preview :${port}`,
            metadata: { port, url },
            output: `Opened ${url} in the built-in browser.`,
          }
        }),
    }
  }),
)
