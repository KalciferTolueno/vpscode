export const SESSION_OPEN_FILE_TAB = "open-file"

export type SessionTabs = {
  active?: string
  all: string[]
}

export type SessionTabState = {
  tabs: SessionTabs
  preview?: string
}

const sessionTabPreview = (current: SessionTabState) =>
  current.preview ?? (current.tabs.all.includes(SESSION_OPEN_FILE_TAB) ? SESSION_OPEN_FILE_TAB : undefined)

export function previewSessionTab(current: SessionTabState, tab: string): SessionTabState {
  const preview = sessionTabPreview(current)
  const previewIndex = preview ? current.tabs.all.indexOf(preview) : -1
  const existingIndex = current.tabs.all.indexOf(tab)

  if (existingIndex !== -1) {
    if (previewIndex === -1 || preview === tab) {
      return { tabs: { all: current.tabs.all, active: tab }, preview: preview === tab ? tab : undefined }
    }
    return {
      tabs: { all: current.tabs.all.filter((item) => item !== preview), active: tab },
    }
  }

  if (previewIndex === -1) {
    return { tabs: { all: [...current.tabs.all, tab], active: tab }, preview: tab }
  }

  return {
    tabs: {
      all: current.tabs.all.map((item, index) => (index === previewIndex ? tab : item)),
      active: tab,
    },
    preview: tab,
  }
}

export function snapshotSessionTabs(value: SessionTabs | undefined): SessionTabs {
  if (!value) return { all: [] }
  const source = value.all
  const all: string[] = []
  if (Array.isArray(source)) {
    const limit = Math.min(source.length, 64)
    for (let i = 0; i < limit; i++) {
      const tab = source[i]
      if (typeof tab === "string") all.push(tab)
    }
  }
  return { all, active: typeof value.active === "string" ? value.active : undefined }
}

export function sessionTabsEqual(left: SessionTabs, right: SessionTabs) {
  if (left.active !== right.active || left.all.length !== right.all.length) return false
  for (let i = 0; i < left.all.length; i++) {
    if (left.all[i] !== right.all[i]) return false
  }
  return true
}

export function openSessionTab(current: SessionTabState, tab: string): SessionTabState {
  const preview = sessionTabPreview(current)
  if (tab === "review") {
    return {
      tabs: { all: current.tabs.all.filter((item) => item !== tab), active: tab },
      preview,
    }
  }

  if (tab === "context" || tab === "browser" || tab.startsWith("browser:")) {
    if (current.tabs.active === tab && current.tabs.all[0] === tab) {
      let dup = false
      for (let i = 1; i < current.tabs.all.length; i++) {
        if (current.tabs.all[i] === tab) {
          dup = true
          break
        }
      }
      if (!dup) return current
    }
    return {
      tabs: { all: [tab, ...current.tabs.all.filter((item) => item !== tab)], active: tab },
      preview,
    }
  }

  const previewIndex = preview ? current.tabs.all.indexOf(preview) : -1
  const existingIndex = current.tabs.all.indexOf(tab)
  if (existingIndex !== -1) {
    if (previewIndex === -1 || preview === tab) {
      return { tabs: { all: current.tabs.all, active: tab } }
    }
    return {
      tabs: { all: current.tabs.all.filter((item) => item !== preview), active: tab },
    }
  }

  if (previewIndex === -1) {
    return { tabs: { all: [...current.tabs.all, tab], active: tab } }
  }

  return {
    tabs: {
      all: current.tabs.all.map((item, index) => (index === previewIndex ? tab : item)),
      active: tab,
    },
  }
}

export function closeSessionTab(current: SessionTabState, tab: string): SessionTabState {
  if (tab === "review") {
    if (current.tabs.active !== tab) return current
    return {
      tabs: { all: current.tabs.all, active: current.tabs.all[0] },
      preview: current.preview,
    }
  }

  const all = current.tabs.all.filter((item) => item !== tab)
  const preview = current.preview === tab ? undefined : current.preview
  if (current.tabs.active !== tab) return { tabs: { ...current.tabs, all }, preview }

  const index = current.tabs.all.indexOf(tab)
  return {
    tabs: {
      all,
      active: current.tabs.all[index - 1] ?? current.tabs.all[index + 1] ?? all[0],
    },
    preview,
  }
}
