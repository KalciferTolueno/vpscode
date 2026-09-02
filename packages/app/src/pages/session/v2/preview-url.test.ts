import { describe, expect, test } from "bun:test"
import {
  extractPreviewUrl,
  extractPreviewUrlFromPart,
  latestPreviewUrlFromParts,
  normalizePreviewUrl,
  previewIframeSrc,
  previewResponseIsLive,
  startPreviewFilePoll,
} from "./preview-url"

describe("normalizePreviewUrl", () => {
  test("maps loopback hosts and bare ports onto the preview proxy", () => {
    expect(normalizePreviewUrl("5173")).toBe("/preview/5173/")
    expect(normalizePreviewUrl("localhost:5173")).toBe("/preview/5173/")
    expect(normalizePreviewUrl("http://127.0.0.1:4173/app?x=1")).toBe("/preview/4173/app?x=1")
    expect(normalizePreviewUrl("http://0.0.0.0:8080/")).toBe("/preview/8080/")
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
    expect(normalizePreviewUrl("http://localhost:4096")).toBe("")
    expect(normalizePreviewUrl("4096")).toBe("")
  })

  test("keeps empty input empty", () => {
    expect(normalizePreviewUrl("")).toBe("")
  })
})

describe("previewResponseIsLive", () => {
  test("hides EasyPanel errors and the waiting placeholder", () => {
    expect(previewResponseIsLive(false, null)).toBe(false)
    expect(previewResponseIsLive(true, "waiting")).toBe(false)
    expect(previewResponseIsLive(true, null)).toBe(true)
  })
})

describe("extractPreviewUrl", () => {
  test("opens localhost urls from assistant copy and vite logs", () => {
    expect(extractPreviewUrl("La web ya está abierta en el preview: http://localhost:8080")).toBe("/preview/8080/")
    expect(extractPreviewUrl("The web is already open in the preview: http://localhost:8080")).toBe("/preview/8080/")
    expect(extractPreviewUrl("  ➜  Local:   http://localhost:5173/\n")).toBe("/preview/5173/")
    expect(extractPreviewUrl("Opened http://127.0.0.1:3000/app")).toBe("/preview/3000/app")
    expect(extractPreviewUrl("see localhost:4173 and then localhost:8080")).toBe("/preview/8080/")
  })

  test("ignores the OpenCode server and remote sites", () => {
    expect(extractPreviewUrl("http://localhost:4096")).toBe("")
    expect(extractPreviewUrl("https://example.com:8080")).toBe("")
    expect(extractPreviewUrl("Opened /preview/8080/ in Preview.")).toBe("/preview/8080/")
  })
})

describe("extractPreviewUrlFromPart", () => {
  test("reads assistant text and bash output, not file edits", () => {
    expect(
      extractPreviewUrlFromPart({
        type: "text",
        text: "La web ya está abierta en el preview: http://localhost:8080",
      }),
    ).toBe("/preview/8080/")
    expect(
      extractPreviewUrlFromPart({
        type: "tool",
        tool: "bash",
        state: { output: "Local: http://localhost:5173/" },
      }),
    ).toBe("/preview/5173/")
    expect(
      extractPreviewUrlFromPart({
        type: "tool",
        tool: "preview",
        state: { input: { port: 8080 }, output: "Opened http://localhost:8080/ in Preview." },
      }),
    ).toBe("/preview/8080/")
    expect(
      extractPreviewUrlFromPart({
        type: "tool",
        tool: "edit",
        state: { output: "proxy: http://localhost:8080" },
      }),
    ).toBe("")
    expect(
      latestPreviewUrlFromParts([
        { type: "text", text: "starting" },
        { type: "tool", tool: "bash", state: { output: "Local: http://localhost:5173/" } },
        { type: "text", text: "La web ya está abierta en el preview: http://localhost:8080" },
      ]),
    ).toBe("/preview/8080/")
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
