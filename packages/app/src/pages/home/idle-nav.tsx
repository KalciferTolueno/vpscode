import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { useSearchParams } from "@solidjs/router"
import { Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { ServerConnection } from "@/context/server"
import { type DraftTab, useTabs } from "@/context/tabs"
import { createHomeController } from "./home-controller"
import { createHomeProjectsController } from "./home-projects-controller"
import { HomeProjects } from "./home-projects"
import { HomeUtilityNav } from "./home-projects-view"
import { createHomeScrollController } from "./home-scroll-controller"
import { createHomeSessionSearchController } from "./home-session-search-controller"
import { createHomeSessionsController } from "./home-sessions-controller"
import { HomeSessions } from "./home-sessions"

export function IdleNav() {
  const language = useLanguage()
  const tabs = useTabs()
  const [search] = useSearchParams<{ draftId?: string }>()
  const home = createHomeController()
  const projects = createHomeProjectsController(home)
  const sessions = createHomeSessionsController(home)
  const searchSessions = createHomeSessionSearchController(home, sessions)
  const scroll = createHomeScrollController(sessions.data.groups)

  const selectProject = (server: ServerConnection.Any, directory: string) => {
    projects.project.select(server, directory)
    const draftID =
      search.draftId ?? tabs.store.find((tab): tab is DraftTab => tab.type === "draft")?.draftID
    if (!draftID) return
    tabs.updateDraft(draftID, { server: ServerConnection.key(server), directory })
  }

  return (
    <nav
      data-component="idle-nav"
      data-oc-enter="idle-nav"
      class="hidden md:flex min-h-0 shrink-0 flex-col self-stretch overflow-hidden rounded-[3px] border border-v2-border-border-base bg-v2-background-bg-base"
      aria-label={language.t("home.title")}
    >
      <div class="shrink-0 px-2 pt-2">
        <Show when={sessions.session.canCreate()}>
          <ButtonV2
            data-action="idle-nav-new-session"
            variant="ghost-muted"
            size="normal"
            icon="edit"
            class="h-8 w-full justify-start px-2 [font-weight:530]"
            onClick={sessions.session.create}
          >
            {language.t("command.session.new")}
          </ButtonV2>
        </Show>
      </div>
      <ScrollView
        class="min-h-0 min-w-0 flex-1"
        viewportRef={scroll.viewport.setViewport}
        onScroll={(event) => scroll.viewport.update(event.currentTarget.scrollTop)}
        onWheel={scroll.viewport.containWheel}
      >
        <div class="flex min-h-0 flex-col gap-4 px-1 pb-3">
          <HomeProjects projects={projects} scroll={scroll} density="nav" onSelectProject={selectProject} />
          <HomeSessions sessions={sessions} search={searchSessions} scroll={scroll} density="nav" />
        </div>
      </ScrollView>
      <HomeUtilityNav
        class="flex shrink-0 pb-2"
        onOpenSettings={projects.utility.settings}
        onOpenHelp={projects.utility.help}
        language={language}
      />
    </nav>
  )
}
