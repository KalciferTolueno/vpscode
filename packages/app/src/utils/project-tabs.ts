import { pathKey } from "@/utils/path-key"

export function projectScopeDirectories(
  directory: string,
  projects: { worktree: string; sandboxes?: string[] }[],
) {
  const key = pathKey(directory)
  const project = projects.find(
    (item) => pathKey(item.worktree) === key || item.sandboxes?.some((sandbox) => pathKey(sandbox) === key),
  )
  if (!project) return [directory]
  return [project.worktree, ...(project.sandboxes ?? [])]
}

export function resolveTabDirectory(
  tab: { type: "draft" | "session"; directory?: string },
  info?: { directory?: string },
  sessionDirectory?: string,
) {
  if (tab.type === "draft") return tab.directory
  return info?.directory ?? sessionDirectory
}

export function tabMatchesProject(input: {
  tab: { type: "draft" | "session"; server: string; directory?: string }
  directories: string[]
  server?: string
  info?: { directory?: string }
  sessionDirectory?: string
}) {
  if (input.server && input.tab.server !== input.server) return false
  const directory = resolveTabDirectory(input.tab, input.info, input.sessionDirectory)
  if (!directory) return false
  const keys = new Set(input.directories.map(pathKey))
  return keys.has(pathKey(directory))
}

export function tabVisibleInProject(input: {
  tab: { type: "draft" | "session"; server: string; directory?: string }
  directories?: string[]
  server?: string
  info?: { directory?: string }
  sessionDirectory?: string
  current?: boolean
}) {
  if (!input.directories) return true
  if (
    tabMatchesProject({
      tab: input.tab,
      directories: input.directories,
      server: input.server,
      info: input.info,
      sessionDirectory: input.sessionDirectory,
    })
  ) {
    return true
  }
  if (!input.current) return false
  return !resolveTabDirectory(input.tab, input.info, input.sessionDirectory)
}

export function latestUnseenSession(notifications: { session?: string; time: number }[]) {
  const session = notifications
    .filter((item) => item.session)
    .sort((a, b) => b.time - a.time)
    .at(0)?.session
  return session
}

export function pickTabForProject<T extends { type: "draft" | "session" }>(tabs: T[], match: (tab: T) => boolean) {
  const matching = tabs.filter(match)
  return matching.findLast((tab) => tab.type === "session") ?? matching.findLast((tab) => tab.type === "draft")
}
