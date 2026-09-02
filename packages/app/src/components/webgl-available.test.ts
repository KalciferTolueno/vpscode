import { describe, expect, test } from "bun:test"
import { markWebGLUnavailable, webglAvailable } from "./webgl-available"

describe("webglAvailable", () => {
  test("remembers a failed probe so callers stop creating renderers", () => {
    markWebGLUnavailable()
    expect(webglAvailable()).toBe(false)
    expect(webglAvailable()).toBe(false)
  })
})
