import { describe, expect, test } from "bun:test"
import { previewFrameLayout } from "./preview-frame-layout"

describe("previewFrameLayout", () => {
  test("desktop fills the available stage", () => {
    const layout = previewFrameLayout({
      key: "desktop",
      width: 1280,
      height: 720,
      availW: 900,
      availH: 500,
      fill: false,
      zoom: 1,
    })
    expect(layout).toEqual({
      vw: 900,
      vh: 500,
      scale: 1,
      shellW: 900,
      shellH: 500,
    })
  })

  test("mobile keeps device CSS pixels and letterboxes instead of stretching", () => {
    const layout = previewFrameLayout({
      key: "mobile",
      width: 390,
      height: 844,
      availW: 800,
      availH: 600,
      fill: false,
      zoom: 1,
    })
    expect(layout.vw).toBe(390)
    expect(layout.vh).toBe(844)
    expect(layout.scale).toBeCloseTo(600 / 844)
    expect(layout.shellW).toBeCloseTo(390 * (600 / 844))
    expect(layout.shellH).toBeCloseTo(600)
  })

  test("tablet scales down to fit width without growing past 1x", () => {
    const layout = previewFrameLayout({
      key: "tablet",
      width: 768,
      height: 1024,
      availW: 400,
      availH: 900,
      fill: false,
      zoom: 1,
    })
    expect(layout.vw).toBe(768)
    expect(layout.vh).toBe(1024)
    expect(layout.scale).toBeCloseTo(400 / 768)
    expect(layout.shellW).toBeCloseTo(400)
    expect(layout.shellH).toBeCloseTo(1024 * (400 / 768))
  })

  test("does not upscale a device that already fits", () => {
    const layout = previewFrameLayout({
      key: "mobile",
      width: 390,
      height: 844,
      availW: 1200,
      availH: 1100,
      fill: false,
      zoom: 1,
    })
    expect(layout.scale).toBe(1)
    expect(layout.shellW).toBe(390)
    expect(layout.shellH).toBe(844)
  })
})
