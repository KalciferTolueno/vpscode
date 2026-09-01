import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { useSearchParams } from "@solidjs/router"
import { Show, createMemo, onCleanup } from "solid-js"
import { Portal } from "solid-js/web"
import { createMediaQuery } from "@solid-primitives/media"
import { makeEventListener } from "@solid-primitives/event-listener"
import { useLanguage } from "@/context/language"
import { ServerConnection } from "@/context/server"
import { useSettings } from "@/context/settings"
import { type DraftTab, useTabs } from "@/context/tabs"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { createHomeController } from "./home-controller"
import { createHomeProjectsController } from "./home-projects-controller"
import { HomeProjects } from "./home-projects"
import { HomeUtilityNav } from "./home-projects-view"
import { createHomeScrollController } from "./home-scroll-controller"
import { createHomeSessionSearchController } from "./home-session-search-controller"
import { createHomeSessionsController, type OpenSessionOptions } from "./home-sessions-controller"
import { HomeSessions } from "./home-sessions"

export function IdleNav(props: { desktop: boolean; mobileOpen: boolean; onMobileClose: () => void }) {
  const mobile = createMediaQuery("(max-width: 767px)")
  return (
    <>
      <Show when={!mobile() && props.desktop}>
        <IdleNavPanel />
      </Show>
      <Show when={mobile() && props.mobileOpen}>
        <IdleNavMobile onClose={props.onMobileClose} />
      </Show>
    </>
  )
}

function IdleNavMobile(props: { onClose: () => void }) {
  const language = useLanguage()
  const settings = useSettings()
  const bottom = createMemo(
    () => settings.general.newLayoutDesigns() && settings.general.mobileTitlebarPosition() === "bottom",
  )

  onCleanup(
    makeEventListener(document, "keydown", (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      props.onClose()
    }),
  )

  return (
    <Portal>
      <div
        data-component="idle-nav-mobile"
        data-oc-enter
        class="fixed inset-x-0 z-[70] flex flex-col md:hidden bg-v2-background-bg-deep"
        style={{
          top: bottom() ? "0px" : "calc(2.25rem + env(safe-area-inset-top, 0px))",
          bottom: bottom() ? "calc(2.25rem + env(safe-area-inset-bottom, 0px))" : "0px",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={language.t("home.title")}
      >
        <IdleNavPanel mobile onNavigate={props.onClose} />
      </div>
    </Portal>
  )
}

function IdleNavPanel(props: { mobile?: boolean; onNavigate?: () => void }) {
  const language = useLanguage()
  const tabs = useTabs()
  const [search] = useSearchParams<{ draftId?: string }>()
  const home = createHomeController()
  const projects = createHomeProjectsController(home)
  const sessions = createHomeSessionsController(home)
  const close = () => props.onNavigate?.()
  const session = {
    ...sessions.session,
    create: () => {
      sessions.session.create()
      close()
    },
    open: (item: Session, options?: OpenSessionOptions) => {
      sessions.session.open(item, options)
      if (!options?.background) close()
    },
  }
  const nav = { copy: sessions.copy, data: sessions.data, session, tab: sessions.tab }
  const searchSessions = createHomeSessionSearchController(home, nav)
  const scroll = createHomeScrollController(sessions.data.groups)

  const selectProject = (server: ServerConnection.Any, directory: string) => {
    projects.project.select(server, directory)
    const draftID = search.draftId ?? tabs.store.find((tab): tab is DraftTab => tab.type === "draft")?.draftID
    if (!draftID) return
    tabs.updateDraft(draftID, { server: ServerConnection.key(server), directory })
  }

  return (
    <nav
      data-component="idle-nav"
      data-mobile={props.mobile ? "" : undefined}
      data-oc-enter={props.mobile ? undefined : "idle-nav"}
      class="flex min-h-0 shrink-0 flex-col self-stretch overflow-hidden rounded-[3px] border border-v2-border-border-base bg-v2-background-bg-base"
      classList={{ "flex-1 w-full": props.mobile }}
      aria-label={language.t("home.title")}
    >
      <Show when={props.mobile}>
        <div class="flex h-10 shrink-0 items-center justify-between gap-2 px-2 pt-1">
          <div class="px-2 text-v2-text-text-base [font-weight:530]">{language.t("home.title")}</div>
          <IconButtonV2
            variant="ghost-muted"
            size="small"
            icon={<IconV2 name="close" />}
            aria-label={language.t("common.close")}
            onClick={close}
          />
        </div>
      </Show>
      <div class="shrink-0 px-2 pt-2">
        <Show when={sessions.session.canCreate()}>
          <ButtonV2
            data-action="idle-nav-new-session"
            variant="ghost-muted"
            size="normal"
            icon="edit"
            class="h-8 w-full justify-start px-2 [font-weight:530]"
            onClick={session.create}
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
          <HomeSessions sessions={nav} search={searchSessions} scroll={scroll} density="nav" />
        </div>
      </ScrollView>
      <HomeUtilityNav
        class="flex shrink-0 pb-2"
        onOpenSettings={() => {
          projects.utility.settings()
          close()
        }}
        onOpenHelp={() => {
          projects.utility.help()
          close()
        }}
        language={language}
      />
    </nav>
  )
}
