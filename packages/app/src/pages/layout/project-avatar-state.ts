import { createMemo, type Accessor } from "solid-js"
import { useGlobal } from "@/context/global"
import { useNotification } from "@/context/notification"
import { usePermission } from "@/context/permission"
import { sessionPermissionRequest, sessionQuestionRequest } from "@/pages/session/composer/session-request-tree"
import { hasProjectPermissions } from "@/pages/layout/helpers"
import { ServerConnection } from "@/context/server"
import { pathKey } from "@/utils/path-key"

export function useSessionTabAvatarState(
  server: Accessor<ServerConnection.Key>,
  directory: Accessor<string>,
  sessionId: Accessor<string>,
) {
  const global = useGlobal()
  const notification = useNotification()
  const permission = usePermission()
  const connection = createMemo(() => global.servers.list().find((item) => ServerConnection.key(item) === server()))
  const sync = createMemo(() => {
    const conn = connection()
    if (conn) return global.ensureServerCtx(conn).sync
  })
  const hasPermissions = createMemo(() => {
    const serverSync = sync()
    if (!serverSync) return false
    const permissionState = permission.ensureServerState(server())
    const [store] = serverSync.child(directory(), { bootstrap: false })
    return !!sessionPermissionRequest(store.session, serverSync.session.data.permission, sessionId(), (item) => {
      return !permissionState.autoResponds(item, directory())
    })
  })
  const hasQuestions = createMemo(() => {
    const serverSync = sync()
    if (!serverSync) return false
    const [store] = serverSync.child(directory(), { bootstrap: false })
    return !!sessionQuestionRequest(store.session, serverSync.session.data.question, sessionId())
  })
  const needsAttention = createMemo(() => hasPermissions() || hasQuestions())
  const notificationState = createMemo(() => {
    if (!connection()) return
    return notification.ensureServerState(server())
  })
  const unread = createMemo(() => needsAttention() || (notificationState()?.session.unseenCount(sessionId()) ?? 0) > 0)
  const loading = createMemo(() => {
    const serverSync = sync()
    if (!serverSync) return false
    if (needsAttention()) return false
    return serverSync.session.data.session_working(sessionId())
  })
  return { unread, loading }
}

export function useProjectNavAvatarState(server: Accessor<ServerConnection.Key>, directories: Accessor<string[]>) {
  const global = useGlobal()
  const notification = useNotification()
  const permission = usePermission()
  const connection = createMemo(() => global.servers.list().find((item) => ServerConnection.key(item) === server()))
  const sync = createMemo(() => {
    const conn = connection()
    if (conn) return global.ensureServerCtx(conn).sync
  })
  const keys = createMemo(() => new Set(directories().map(pathKey)))
  const inProject = (sessionID: string) => {
    const serverSync = sync()
    if (!serverSync) return false
    const session = serverSync.session.get(sessionID)
    if (!session) return false
    return keys().has(pathKey(session.directory))
  }
  const hasPermissions = createMemo(() => {
    const serverSync = sync()
    if (!serverSync) return false
    const permissionState = permission.ensureServerState(server())
    return hasProjectPermissions(serverSync.session.data.permission, (item) => {
      if (!inProject(item.sessionID)) return false
      const directory = serverSync.session.get(item.sessionID)?.directory
      if (!directory) return false
      return !permissionState.autoResponds(item, directory)
    })
  })
  const hasQuestions = createMemo(() => {
    const serverSync = sync()
    if (!serverSync) return false
    return hasProjectPermissions(serverSync.session.data.question, (item) => inProject(item.sessionID))
  })
  const needsAttention = createMemo(() => hasPermissions() || hasQuestions())
  const notificationState = createMemo(() => {
    if (!connection()) return
    return notification.ensureServerState(server())
  })
  const unread = createMemo(() => {
    if (needsAttention()) return true
    return directories().some((directory) => (notificationState()?.project.unseenCount(directory) ?? 0) > 0)
  })
  const loading = createMemo(() => {
    const serverSync = sync()
    if (!serverSync) return false
    if (needsAttention()) return false
    return Object.keys(serverSync.session.data.session_status).some((id) => {
      if (!inProject(id)) return false
      return serverSync.session.data.session_working(id)
    })
  })
  return { unread, loading }
}
