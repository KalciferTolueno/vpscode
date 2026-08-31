import { createQuery } from "@tanstack/solid-query"
import { useSearchParams } from "@solidjs/router"
import { type Accessor, createMemo } from "solid-js"
import type { PromptInputControls } from "@/components/prompt-input/contracts"
import type { PromptProjectControls } from "@/components/prompt-project-selector"
import { useDirectoryPicker } from "@/components/directory-picker"
import { useGlobal } from "@/context/global"
import { useLayout } from "@/context/layout"
import { useLocal, type ModelSelection } from "@/context/local"
import { useNotification } from "@/context/notification"
import type { QueryOptionsApi } from "@/context/server-sync"
import { useServerSDK } from "@/context/server-sdk"
import { serverName, ServerConnection, useServer } from "@/context/server"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { tabKey, useTabs } from "@/context/tabs"
import { useProviders } from "@/hooks/use-providers"
import { pathKey } from "@/utils/path-key"
import { latestUnseenSession, pickTabForProject, projectScopeDirectories, tabMatchesProject } from "@/utils/project-tabs"

export function createPromptInputController(input: {
  sessionKey: Accessor<string>
  sessionID: Accessor<string | undefined>
  queryOptions: Pick<QueryOptionsApi, "agents" | "providers">
  model?: ModelSelection
}) {
  const layout = useLayout()
  const local = useLocal()
  const sdk = useSDK()
  const sync = useSync()
  const providers = useProviders(() => sdk().directory)
  const view = layout.view(input.sessionKey)
  const agentsQuery = createQuery(() => input.queryOptions.agents(pathKey(sdk().directory)))
  const globalProvidersQuery = createQuery(() => input.queryOptions.providers(null))
  const providersQuery = createQuery(() => input.queryOptions.providers(pathKey(sdk().directory)))

  return createMemo<PromptInputControls>(() => {
    return {
      agents: {
        available: sync().data.agent,
        options: local.agent.list().map((agent) => agent.name),
        current: local.agent.current()?.name ?? "",
        loading: agentsQuery.isLoading,
        visible: local.agent.visible(),
        select: local.agent.set,
      },
      model: {
        selection: input.model ?? local.model,
        paid: providers.paid().length > 0,
        loading:
          (local.agent.visible() && agentsQuery.isLoading) ||
          providersQuery.isLoading ||
          globalProvidersQuery.isLoading,
      },
      session: {
        id: input.sessionID(),
        tabs: layout.tabs(input.sessionKey),
        reviewPanel: view.reviewPanel,
      },
    }
  })
}

export function createPromptProjectControls() {
  const layout = useLayout()
  const server = useServer()
  const serverSDK = useServerSDK()
  const sdk = useSDK()
  const tabs = useTabs()
  const global = useGlobal()
  const notification = useNotification()
  const pickDirectory = useDirectoryPicker()
  const [search] = useSearchParams<{ draftId?: string }>()
  const projectServer = () => serverSDK().server
  const projectServerCtx = createMemo(() => global.ensureServerCtx(projectServer()))
  const projects = createMemo(() => {
    if (server.list.length <= 1) {
      return search.draftId ? projectServerCtx().projects.list() : layout.projects.list()
    }
    return server.list.flatMap((conn) => {
      const item = { key: ServerConnection.key(conn), name: serverName(conn) }
      return global
        .ensureServerCtx(conn)
        .projects.list()
        .map((project) => ({ ...project, server: item }))
    })
  })
  const selectProject = (worktree: string, serverKey?: string) => {
    const conn = serverKey ? server.list.find((item) => ServerConnection.key(item) === serverKey) : projectServer()
    if (!conn) return

    if (search.draftId) {
      const target = global.ensureServerCtx(conn)
      target.projects.open(worktree)
      target.projects.touch(worktree)
      tabs.updateDraft(search.draftId, { server: ServerConnection.key(conn), directory: worktree })
      return
    }

    if (serverKey) {
      const target = global.ensureServerCtx(conn)
      target.projects.open(worktree)
      target.projects.touch(worktree)
      server.setActive(ServerConnection.key(conn))
    }
    if (!serverKey) {
      layout.projects.open(worktree)
      server.projects.touch(worktree)
    }

    const targetKey = ServerConnection.key(conn)
    const target = global.ensureServerCtx(conn)
    const directories = projectScopeDirectories(worktree, target.projects.list())
    tabs.setProjectScope({ server: targetKey, directories })
    const openSession = (sessionId: string) => {
      const tab = tabs.addSessionTab({ server: targetKey, sessionId })
      tabs.rememberTabDirectory(tab, target.sync.session.get(sessionId)?.directory ?? worktree)
      tabs.select(tab)
    }
    const notify = notification.ensureServerState(targetKey)
    const unseenId = latestUnseenSession(directories.flatMap((directory) => notify.project.unseen(directory)))
    const workingId = Object.keys(target.sync.session.data.session_status).find((id) => {
      const session = target.sync.session.get(id)
      if (!session) return false
      if (!directories.some((directory) => pathKey(directory) === pathKey(session.directory))) return false
      return target.sync.session.data.session_working(id)
    })
    const route = layout.route()
    const currentSessionId = route.type === "session" ? route.sessionId : undefined
    const here =
      targetKey === ServerConnection.key(projectServer()) &&
      directories.some((directory) => pathKey(directory) === pathKey(sdk().directory))

    if (here) {
      if (unseenId && unseenId !== currentSessionId) openSession(unseenId)
      return
    }

    if (unseenId) {
      openSession(unseenId)
      return
    }
    if (workingId) {
      openSession(workingId)
      return
    }

    const tab = pickTabForProject(tabs.store, (item) =>
      tabMatchesProject({
        tab: item,
        directories,
        server: targetKey,
        info: tabs.info[tabKey(item)],
        sessionDirectory: item.type === "session" ? target.sync.session.get(item.sessionId)?.directory : undefined,
      }),
    )
    if (tab) {
      tabs.select(tab)
      return
    }

    void tabs.newDraft({ server: targetKey, directory: worktree })
  }

  const addProject = (title: string, serverKey?: string) => {
    const conn = serverKey ? server.list.find((conn) => ServerConnection.key(conn) === serverKey) : projectServer()
    if (!conn) return
    pickDirectory({
      server: conn,
      title,
      onSelect: (result) => {
        const directory = Array.isArray(result) ? result[0] : result
        if (directory) selectProject(directory, serverKey)
      },
    })
  }

  return createMemo<PromptProjectControls>(() => ({
    available: projects(),
    directory: sdk().directory,
    server: server.list.length > 1 ? ServerConnection.key(projectServer()) : undefined,
    select: selectProject,
    add: addProject,
  }))
}
