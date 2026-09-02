import { pathKey } from "@/utils/path-key"
import type { HomeSessionGroup, HomeSessionRecord } from "./home-sessions-controller"

export function groupSessionsByProject(records: HomeSessionRecord[]): HomeSessionGroup[] {
  const groups: HomeSessionGroup[] = []
  const index = new Map<string, HomeSessionGroup>()
  for (const record of records) {
    const id = pathKey(record.project.worktree)
    const existing = index.get(id)
    if (existing) {
      existing.sessions.push(record)
      continue
    }
    const group = { id, title: record.projectName, sessions: [record] }
    index.set(id, group)
    groups.push(group)
  }
  return groups
}

export function compactRelativeTime(ms: number, now = Date.now()) {
  const minutes = Math.max(1, Math.round(Math.max(0, now - ms) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w`
  return `${Math.max(1, Math.round(days / 30))}mo`
}
