import { readdir, readFile, stat } from "node:fs/promises"
import path from "path"
import { crc32, deflateRawSync } from "node:zlib"

const SKIP_NAMES = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".opencode",
  ".output",
  ".turbo",
  ".venv",
  "coverage",
  "dist",
  "node_modules",
  "Pods",
])

const MAX_FILE_BYTES = 32 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024

export const ARTIFACT_EXTENSIONS = [".apk", ".aab", ".ipa", ".exe", ".dmg", ".msix"] as const

export function isArtifactPath(file: string) {
  const lower = file.toLowerCase()
  return ARTIFACT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export async function zipDirectory(root: string) {
  const files = await listFiles(root)
  const entries: ZipEntry[] = []
  let total = 0
  for (const abs of files) {
    const size = (await stat(abs)).size
    if (size > MAX_FILE_BYTES) continue
    total += size
    if (total > MAX_ARCHIVE_BYTES) throw new Error("Project is too large to download")
    const data = await readFile(abs)
    const name = toZipPath(path.relative(root, abs))
    if (!name || name.startsWith("..")) continue
    entries.push(zipEntry(name, data))
  }
  return concatZip(entries)
}

async function listFiles(root: string) {
  const out: string[] = []
  await walk(root, out)
  return out
}

async function walk(dir: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(abs, out)
      continue
    }
    if (entry.isFile()) out.push(abs)
  }
}

function toZipPath(relative: string) {
  return relative.replaceAll("\\", "/")
}

type ZipEntry = {
  name: Buffer
  crc: number
  compressed: Buffer
  uncompressed: number
  local: Buffer
}

function zipEntry(name: string, data: Buffer): ZipEntry {
  const nameBytes = Buffer.from(name, "utf8")
  const compressed = deflateRawSync(data)
  const crc = crc32(data)
  const local = Buffer.concat([
    u32(0x04034b50),
    u16(20),
    u16(0x0800),
    u16(8),
    u16(0),
    u16(0),
    u32(crc),
    u32(compressed.length),
    u32(data.length),
    u16(nameBytes.length),
    u16(0),
    nameBytes,
    compressed,
  ])
  return { name: nameBytes, crc, compressed, uncompressed: data.length, local }
}

function concatZip(entries: ZipEntry[]) {
  const locals = Buffer.concat(entries.map((entry) => entry.local))
  const centralParts: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    centralParts.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(8),
        u16(0),
        u16(0),
        u32(entry.crc),
        u32(entry.compressed.length),
        u32(entry.uncompressed),
        u16(entry.name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        entry.name,
      ]),
    )
    offset += entry.local.length
  }
  const central = Buffer.concat(centralParts)
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(locals.length),
    u16(0),
  ])
  return Buffer.concat([locals, central, eocd])
}

function u16(value: number) {
  const buf = Buffer.alloc(2)
  buf.writeUInt16LE(value)
  return buf
}

function u32(value: number) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(value)
  return buf
}
