import { describe, expect, test } from "bun:test"
import { canvasBackground } from "./canvas"
import { resolveThemeVariantV2 } from "./v2/resolve"
import nordThemeJson from "./themes/nord.json"
import type { DesktopTheme } from "./types"

const nord = nordThemeJson as DesktopTheme

describe("canvasBackground", () => {
  test("is white in light and black in dark", () => {
    expect(canvasBackground(false)).toBe("#ffffff")
    expect(canvasBackground(true)).toBe("#000000")
  })
})

describe("theme canvas", () => {
  test("paints only the area behind cards black or white", () => {
    const dark = resolveThemeVariantV2(nord.dark, true)
    const light = resolveThemeVariantV2(nord.light, false)
    expect(dark["v2-background-bg-deep"]).toBe("#000000")
    expect(light["v2-background-bg-deep"]).toBe("#ffffff")
    expect(dark["v2-background-bg-base"]).not.toBe("#000000")
    expect(light["v2-background-bg-base"]).not.toBe("#ffffff")
  })
})
