import { Show, createEffect, createMemo } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { ASCIIText } from "@/components/ascii-text"
import { CommentsProvider } from "@/context/comments"
import { FileProvider } from "@/context/file"
import { ModelsProvider } from "@/context/models"
import { PromptProvider } from "@/context/prompt"
import { SDKProvider } from "@/context/sdk"
import { ServerConnection } from "@/context/server"
import { type DraftTab, draftHref, useTabs } from "@/context/tabs"
import { DirectoryDataProvider } from "@/pages/directory-layout"
import NewSession from "@/pages/new-session"
import { createHomeController } from "./home/home-controller"

export function NewHome() {
  const tabs = useTabs()
  const navigate = useNavigate()
  const home = createHomeController()
  const directory = createMemo(() => home.project.newSession()?.worktree)
  const serverKey = createMemo(() => {
    const conn = home.server.focused()
    if (!conn) return
    return ServerConnection.key(conn)
  })
  const draft = createMemo(() => {
    if (!tabs.ready()) return
    const directory = home.project.newSession()?.worktree
    const server = serverKey()
    if (!directory || !server) return
    return (
      tabs.store.find(
        (tab): tab is DraftTab => tab.type === "draft" && tab.server === server && tab.directory === directory,
      ) ?? tabs.store.find((tab): tab is DraftTab => tab.type === "draft")
    )
  })

  let opening = false
  createEffect(() => {
    if (!tabs.ready()) return
    const tab = draft()
    if (tab) {
      navigate(draftHref(tab.draftID), { replace: true })
      return
    }
    if (opening) return
    const directory = home.project.newSession()?.worktree
    const conn = home.server.focused()
    if (!directory || !conn) return
    opening = true
    void tabs.newDraft({ server: ServerConnection.key(conn), directory })
  })

  return (
    <Show when={directory()} fallback={<IdleLogo />}>
      <ModelsProvider directory={directory}>
        <SDKProvider directory={() => directory() ?? ""}>
          <DirectoryDataProvider directory={() => directory() ?? ""} server={serverKey}>
            <FileProvider>
              <PromptProvider>
                <CommentsProvider>
                  <NewSession />
                </CommentsProvider>
              </PromptProvider>
            </FileProvider>
          </DirectoryDataProvider>
        </SDKProvider>
      </ModelsProvider>
    </Show>
  )
}

function IdleLogo() {
  return (
    <div class="relative min-h-0 flex-1 self-stretch overflow-hidden rounded-[3px]">
      <div class="absolute inset-x-0 top-[25.375%] flex justify-center px-6">
        <div class="relative w-full max-w-[720px] h-[140px] sm:h-[220px]" role="img" aria-label="vpscode">
          <ASCIIText text="vpscode" enableWaves={false} asciiFontSize={6} textFontSize={240} />
        </div>
      </div>
    </div>
  )
}
