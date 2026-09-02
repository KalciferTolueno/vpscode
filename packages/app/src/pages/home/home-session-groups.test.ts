import { describe, expect, test } from "bun:test"
import { compactRelativeTime, groupSessionsByProject } from "./home-session-groups"
import type { HomeSessionRecord } from "./home-sessions-controller"

function record(id: string, project: string, updated: number): HomeSessionRecord {
  return {
    session: {
      id,
      directory: `/work/${project}`,
      title: id,
      time: { created: updated, updated },
    },
    project: { worktree: `/work/${project}`, expanded: true },
    projectName: project,
  } as HomeSessionRecord
}

describe("groupSessionsByProject", () => {
  test("keeps recency order of projects and sessions", () => {
    const groups = groupSessionsByProject([
      record("a", "vpscode", 3),
      record("b", "vpscode", 2),
      record("c", "Default", 1),
    ])
    expect(groups.map((group) => group.title)).toEqual(["vpscode", "Default"])
    expect(groups[0].sessions.map((item) => item.session.id)).toEqual(["a", "b"])
    expect(groups[1].sessions.map((item) => item.session.id)).toEqual(["c"])
  })
})

describe("compactRelativeTime", () => {
  const now = 1_700_000_000_000

  test("uses compact units like a chat sidebar", () => {
    expect(compactRelativeTime(now - 11 * 60_000, now)).toBe("11m")
    expect(compactRelativeTime(now - 2 * 60 * 60_000, now)).toBe("2h")
    expect(compactRelativeTime(now - 23 * 60 * 60_000, now)).toBe("23h")
    expect(compactRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe("2d")
  })
})
