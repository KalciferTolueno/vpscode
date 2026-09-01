import { mkdir, writeFile } from "node:fs/promises"
import path from "path"
import { describe, expect, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { isArtifactPath, zipDirectory } from "../../src/util/zip-archive"

describe("zipDirectory", () => {
  test("packs project files and skips node_modules", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await writeFile(path.join(dir, "index.html"), "<h1>hi</h1>")
        await mkdir(path.join(dir, "src"))
        await writeFile(path.join(dir, "src", "app.ts"), "export const n = 1")
        await mkdir(path.join(dir, "node_modules", "left-pad"), { recursive: true })
        await writeFile(path.join(dir, "node_modules", "left-pad", "index.js"), "module.exports = 1")
      },
    })

    const zip = await zipDirectory(tmp.path)
    expect(zip.subarray(0, 2).toString()).toBe("PK")
    expect(zipNames(zip).slice().sort()).toEqual(["index.html", "src/app.ts"])
  })
})

describe("isArtifactPath", () => {
  test("matches installable build outputs", () => {
    expect(isArtifactPath("app-release.apk")).toBe(true)
    expect(isArtifactPath("App.ipa")).toBe(true)
    expect(isArtifactPath("src/app.ts")).toBe(false)
  })
})

function zipNames(zip: Buffer) {
  const names: string[] = []
  let offset = 0
  while (offset + 30 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const nameLen = zip.readUInt16LE(offset + 26)
    const extraLen = zip.readUInt16LE(offset + 28)
    const compressed = zip.readUInt32LE(offset + 18)
    names.push(zip.subarray(offset + 30, offset + 30 + nameLen).toString("utf8"))
    offset += 30 + nameLen + extraLen + compressed
  }
  return names
}
