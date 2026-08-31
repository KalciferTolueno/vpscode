import { describe, expect, test } from "bun:test"
import {
  latestUnseenSession,
  pickTabForProject,
  projectScopeDirectories,
  resolveTabDirectory,
  tabMatchesProject,
  tabVisibleInProject,
} from "./project-tabs"

const projects = [
  { worktree: "D:\\work\\alpha", sandboxes: ["D:\\work\\alpha-sandbox"] },
  { worktree: "D:\\work\\beta" },
]

describe("projectScopeDirectories", () => {
  test("includes worktree and sandboxes for the matching project", () => {
    expect(projectScopeDirectories("D:/work/alpha-sandbox", projects)).toEqual([
      "D:\\work\\alpha",
      "D:\\work\\alpha-sandbox",
    ])
  })

  test("falls back to the directory when no project matches", () => {
    expect(projectScopeDirectories("D:\\work\\gamma", projects)).toEqual(["D:\\work\\gamma"])
  })
})

describe("tabMatchesProject", () => {
  const directories = projectScopeDirectories("D:\\work\\alpha", projects)

  test("matches draft tabs by directory and server", () => {
    const tab = { type: "draft" as const, server: "local", directory: "D:/work/alpha" }
    expect(tabMatchesProject({ tab, directories, server: "local" })).toBe(true)
    expect(tabMatchesProject({ tab, directories, server: "other" })).toBe(false)
    expect(tabMatchesProject({ tab: { ...tab, directory: "D:\\work\\beta" }, directories, server: "local" })).toBe(
      false,
    )
  })

  test("matches session tabs from persisted or live directory", () => {
    const tab = { type: "session" as const, server: "local" }
    expect(tabMatchesProject({ tab, directories, info: { directory: "D:\\work\\alpha" } })).toBe(true)
    expect(tabMatchesProject({ tab, directories, sessionDirectory: "D:\\work\\alpha-sandbox" })).toBe(true)
    expect(tabMatchesProject({ tab, directories })).toBe(false)
  })
})

describe("tabVisibleInProject", () => {
  const directories = projectScopeDirectories("D:\\work\\alpha", projects)

  test("shows every tab when no project filter is active", () => {
    const tab = { type: "session" as const, server: "local" }
    expect(tabVisibleInProject({ tab })).toBe(true)
    expect(tabVisibleInProject({ tab, info: { directory: "D:\\work\\beta" } })).toBe(true)
  })

  test("hides other-project tabs even if they are current", () => {
    const tab = { type: "session" as const, server: "local" }
    expect(
      tabVisibleInProject({
        tab,
        directories,
        current: true,
        info: { directory: "D:\\work\\beta" },
      }),
    ).toBe(false)
  })

  test("keeps the current tab visible only until its directory is known", () => {
    const tab = { type: "session" as const, server: "local" }
    expect(tabVisibleInProject({ tab, directories, current: true })).toBe(true)
    expect(tabVisibleInProject({ tab, directories, current: false })).toBe(false)
  })
})

test("resolveTabDirectory prefers draft path then persisted info", () => {
  expect(resolveTabDirectory({ type: "draft", directory: "/a" }, { directory: "/b" }, "/c")).toBe("/a")
  expect(resolveTabDirectory({ type: "session" }, { directory: "/b" }, "/c")).toBe("/b")
  expect(resolveTabDirectory({ type: "session" }, undefined, "/c")).toBe("/c")
})

test("latestUnseenSession returns the newest session id", () => {
  expect(
    latestUnseenSession([
      { session: "old", time: 1 },
      { session: "new", time: 3 },
      { time: 4 },
      { session: "mid", time: 2 },
    ]),
  ).toBe("new")
  expect(latestUnseenSession([])).toBeUndefined()
})

test("pickTabForProject prefers the last session tab over drafts", () => {
  const tabs = [
    { type: "draft" as const, id: "d1" },
    { type: "session" as const, id: "s1" },
    { type: "session" as const, id: "s2" },
    { type: "draft" as const, id: "d2" },
  ]
  expect(pickTabForProject(tabs, () => true)).toEqual({ type: "session", id: "s2" })
  expect(pickTabForProject(tabs, (tab) => tab.type === "draft")).toEqual({ type: "draft", id: "d2" })
  expect(pickTabForProject(tabs, () => false)).toBeUndefined()
})
