import { For, Show, createEffect, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { Portal } from "solid-js/web"
import { createMediaQuery } from "@solid-primitives/media"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { type PromptProject } from "@/components/prompt-project-selector"
import { useTitlebarProjectNavMount } from "@/components/titlebar"
import { createPromptProjectControls } from "@/pages/session/composer"
import { SessionTabAvatarView } from "@/pages/layout/session-tab-avatar"
import { useProjectNavAvatarState } from "@/pages/layout/project-avatar-state"
import { displayName } from "@/pages/layout/helpers"
import { ServerConnection, useServer } from "@/context/server"
import { pathKey } from "@/utils/path-key"
import { Persist, persisted } from "@/utils/persist"

const COLLAPSED_WIDTH = "3rem"

export function SessionProjectNav(props: { ref?: HTMLElement | ((el: HTMLElement) => void) }) {
  const language = useLanguage()
  const server = useServer()
  const titlebar = useTitlebarProjectNavMount()
  const controls = createPromptProjectControls()
  const isDesktop = createMediaQuery("(min-width: 768px)")
  const canHover = createMediaQuery("(hover: hover) and (pointer: fine)")
  const [prefs, setPrefs] = persisted(
    Persist.global("session.project-nav"),
    createStore({ expanded: false }),
  )
  const pinned = () => prefs.expanded

  createEffect((wasDesktop?: boolean) => {
    const desktop = isDesktop()
    if (!desktop && pinned() && wasDesktop !== false) setPrefs("expanded", false)
    return desktop
  })

  const projects = createMemo(() => controls().available)
  const servers = createMemo(() => {
    const names = new Map<string, string>()
    for (const project of projects()) {
      if (project.server) names.set(project.server.key, project.server.name)
    }
    return [...names.entries()].map(([key, name]) => ({ key, name }))
  })
  const grouped = createMemo(() => {
    const list = servers()
    if (list.length <= 1) return [{ key: list[0]?.key, name: list[0]?.name, items: projects() }]
    return list.map((item) => ({
      ...item,
      items: projects().filter((project) => project.server?.key === item.key),
    }))
  })

  const selected = (project: PromptProject) => {
    const directory = pathKey(controls().directory)
    return (
      pathKey(project.worktree) === directory ||
      !!project.sandboxes?.some((sandbox) => pathKey(sandbox) === directory)
    )
  }

  const openProject = (project: PromptProject) => {
    controls().select(project.worktree, project.server?.key)
    if (!isDesktop()) setPrefs("expanded", false)
  }

  const projectServer = (project: PromptProject) => {
    if (project.server?.key) return ServerConnection.Key.make(project.server.key)
    if (controls().server) return ServerConnection.Key.make(controls().server)
    return server.key
  }

  const addProject = (serverKey?: string) => {
    controls().add(language.t("home.project.add"), serverKey ?? controls().server)
  }

  const toggle = () => setPrefs("expanded", (value) => !value)
  const toggleLabel = () => (pinned() ? language.t("session.todo.collapse") : language.t("home.projects"))

  const panel = (open: boolean) => (
    <aside
      data-component="session-project-nav"
      data-expanded={open ? "" : undefined}
      class="flex h-full flex-col overflow-hidden rounded-[3px] border border-v2-border-border-base bg-v2-background-bg-base"
      aria-label={language.t("home.projects")}
    >
      <div class="min-h-0 flex-1 overflow-y-auto no-scrollbar py-2">
        <Show
          when={projects().length > 0}
          fallback={
            <button
              type="button"
              class="flex h-8 w-full min-w-0 items-center text-left text-v2-text-text-muted [font-weight:440] hover:bg-v2-background-bg-layer-01 hover:text-v2-text-text-base"
              onClick={() => addProject()}
            >
              <span class="flex w-12 shrink-0 items-center justify-center">
                <IconV2 name="folder-add-left" size="small" class="text-v2-icon-icon-muted" />
              </span>
              <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap pe-2">
                {language.t("home.project.add")}
              </span>
            </button>
          }
        >
          <div class="flex flex-col gap-1">
            <For each={grouped()}>
              {(group) => (
                <div class="flex min-w-0 flex-col gap-1">
                  <Show when={servers().length > 1 && group.name}>
                    <div class="truncate pb-1 pe-2 ps-12 text-[11px] leading-none text-v2-text-text-faint [font-weight:530]">
                      {group.name}
                    </div>
                  </Show>
                  <For each={group.items}>
                    {(project) => (
                      <SessionProjectNavRow
                        project={project}
                        server={projectServer(project)}
                        selected={selected(project)}
                        onSelect={() => openProject(project)}
                      />
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
      <div class="flex w-12 shrink-0 justify-center pb-2">
        <TooltipV2 placement="right" value={language.t("home.project.add")} inactive={canHover() || open}>
          <IconButtonV2
            variant="ghost-muted"
            size="small"
            icon={<IconV2 name="folder-add-left" />}
            aria-label={language.t("home.project.add")}
            onClick={() => addProject()}
          />
        </TooltipV2>
      </div>
    </aside>
  )

  return (
    <>
      <Show when={isDesktop()}>
        <Show when={titlebar()} keyed>
          {(mount) => (
            <Portal mount={mount}>
              <TooltipV2 placement="bottom" class="shrink-0" value={toggleLabel()}>
                <IconButtonV2
                  type="button"
                  variant="ghost-muted"
                  size="large"
                  class="!w-9 shrink-0"
                  icon={<IconV2 name="sidebar-right" />}
                  state={pinned() ? "pressed" : undefined}
                  aria-label={toggleLabel()}
                  aria-pressed={pinned()}
                  onClick={toggle}
                />
              </TooltipV2>
            </Portal>
          )}
        </Show>
        <div
          ref={props.ref}
          data-component="session-project-nav-rail"
          class="relative z-40 shrink-0 min-h-0 h-full"
          style={{ width: COLLAPSED_WIDTH }}
        >
          <div class="absolute inset-y-0 start-0">{panel(pinned())}</div>
        </div>
      </Show>
      <Show when={!isDesktop() && pinned()}>
        <Portal>
          <button
            type="button"
            class="fixed inset-0 z-40 bg-black/40"
            aria-label={language.t("session.todo.collapse")}
            onClick={toggle}
          />
          <div class="fixed inset-y-0 start-0 z-50 p-3 pointer-events-none">
            <div class="pointer-events-auto h-full" data-component="session-project-nav-rail">
              {panel(true)}
            </div>
          </div>
        </Portal>
      </Show>
    </>
  )
}

function SessionProjectNavRow(props: {
  project: PromptProject
  server: ServerConnection.Key
  selected: boolean
  onSelect: () => void
}) {
  const name = () => displayName(props.project)
  const directories = createMemo(() => [props.project.worktree, ...(props.project.sandboxes ?? [])])
  const state = useProjectNavAvatarState(
    () => props.server,
    directories,
  )

  return (
    <button
      type="button"
      data-component="session-project-nav-row"
      data-selected={props.selected ? "" : undefined}
      data-working={state.loading() ? "" : undefined}
      data-ready={state.unread() && !state.loading() ? "" : undefined}
      aria-current={props.selected ? "page" : undefined}
      aria-label={name()}
      class="flex h-8 w-full min-w-0 cursor-default items-center rounded-[3px] text-left text-v2-text-text-muted [font-weight:440] transition-[background-color,color] duration-[120ms] ease-in-out hover:bg-v2-background-bg-layer-01 hover:text-v2-text-text-base data-[selected]:bg-v2-background-bg-layer-03 data-[selected]:text-v2-text-text-base data-[selected]:hover:bg-v2-background-bg-layer-03 focus-visible:outline-none focus-visible:bg-v2-background-bg-layer-01"
      onClick={props.onSelect}
    >
      <span class="relative flex w-12 shrink-0 items-center justify-center overflow-visible">
        <SessionTabAvatarView
          project={{
            worktree: props.project.worktree,
            expanded: false,
            id: props.project.id,
            name: props.project.name,
            icon: props.project.icon,
          }}
          directory={props.project.worktree}
          revealProjectOnHover={false}
          unread={false}
          loading={state.loading()}
        />
        <Show when={!state.loading() && state.unread()}>
          <span class="pointer-events-none absolute -right-0.5 -top-0.5 flex size-2.5 items-center justify-center rounded-full bg-v2-background-bg-accent text-v2-background-bg-deep">
            <IconV2 name="check" class="size-2" />
          </span>
        </Show>
      </span>
      <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap pe-2">{name()}</span>
    </button>
  )
}
