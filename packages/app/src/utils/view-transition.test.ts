import { describe, expect, test } from "bun:test"
import { shouldViewTransition } from "./view-transition"

describe("shouldViewTransition", () => {
  test("runs for pointer navigation when the API is available", () => {
    expect(
      shouldViewTransition({
        reducedMotion: false,
        supported: true,
        pointerInitiated: true,
      }),
    ).toBe(true)
  })

  test("skips keyboard-initiated navigation", () => {
    expect(
      shouldViewTransition({
        reducedMotion: false,
        supported: true,
        pointerInitiated: false,
      }),
    ).toBe(false)
  })

  test("skips reduced motion", () => {
    expect(
      shouldViewTransition({
        reducedMotion: true,
        supported: true,
        pointerInitiated: true,
      }),
    ).toBe(false)
  })

  test("skips unsupported browsers", () => {
    expect(
      shouldViewTransition({
        reducedMotion: false,
        supported: false,
        pointerInitiated: true,
      }),
    ).toBe(false)
  })
})
