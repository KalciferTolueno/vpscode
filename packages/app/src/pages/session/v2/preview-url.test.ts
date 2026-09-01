import { describe, expect, test } from "bun:test"
import { normalizePreviewUrl, previewIframeSrc, startPreviewFilePoll } from "./preview-url"

describe("normalizePreviewUrl", () => {
  test("maps loopback hosts and bare ports onto the preview proxy", () => {
    expect(normalizePreviewUrl("5173")).toBe("/preview/5173/")
    expect(normalizePreviewUrl("localhost:5173")).toBe("/preview/5173/")
    expect(normalizePreviewUrl("http://127.0.0.1:4173/app?x=1")).toBe("/preview/4173/app?x=1")
    expect(normalizePreviewUrl("/preview/3000/")).toBe("/preview/3000/")
    expect(normalizePreviewUrl("http://localhost:3000/preview/5173/")).toBe("/preview/5173/")
  })

  test("rejects sites that are not the local app", () => {
    expect(normalizePreviewUrl("https://www.google.com/")).toBe("")
    expect(normalizePreviewUrl("google.com")).toBe("")
    expect(normalizePreviewUrl("https://example.com/x")).toBe("")
    expect(normalizePreviewUrl("/docs")).toBe("")
    expect(previewIframeSrc("https://www.google.com/")).toBe("")
    expect(previewIframeSrc("/docs")).toBe("")
    expect(previewIframeSrc("5173")).toBe("/preview/5173/")
  })

  test("keeps empty input empty", () => {
    expect(normalizePreviewUrl("")).toBe("")
  })
})

describe("startPreviewFilePoll", () => {
  test("opens a new preview url immediately", async () => {
    const urls: string[] = []
    const stop = startPreviewFilePoll({
      directory: () => "/project",
      read: async () => "/preview/5173/",
      onUrl: (url) => urls.push(url),
    })
    await Promise.resolve()
    stop()
    expect(urls).toEqual(["/preview/5173/"])
  })

  test("ignores invalid urls and repeats", async () => {
    const urls: string[] = []
    const stop = startPreviewFilePoll({
      directory: () => "/project",
      read: async () => "https://example.com",
      onUrl: (url) => urls.push(url),
    })
    await Promise.resolve()
    stop()
    expect(urls).toEqual([])
  })
})
