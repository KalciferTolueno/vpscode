import { For, Show, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { Portal } from "solid-js/web"
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
const EXPANDED_WIDTH = "14.5rem"

export function SessionProjectNav(props: { ref?: HTMLElement | ((el: HTMLElement) => void) }) {
  const language = useLanguage()
  const server = useServer()
  const titlebar = useTitlebarProjectNavMount()
  const controls = createPromptProjectControls()
  const [prefs, setPrefs] = persisted(
    Persist.global("session.project-nav"),
    createStore({ expanded: false }),
  )
  const expanded = () => prefs.expanded

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
    return list.map((server) => ({
      ...server,
      items: projects().filter((project) => project.server?.key === server.key),
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
  const toggleLabel = () => (expanded() ? language.t("session.todo.collapse") : language.t("home.projects"))

  return (
    <>
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
                state={expanded() ? "pressed" : undefined}
                aria-label={toggleLabel()}
                aria-pressed={expanded()}
                onClick={toggle}
              />
            </TooltipV2>
          </Portal>
        )}
      </Show>
    <div
      ref={props.ref}
      class="hidden md:block relative shrink-0 min-h-0 h-full"
      style={{ width: COLLAPSED_WIDTH }}
    >
    <aside
      data-component="session-project-nav"
      data-expanded={expanded() ? "" : undefined}
      class="absolute inset-y-0 start-0 z-20 flex h-full flex-col overflow-hidden rounded-[3px] border border-v2-border-border-base bg-v2-background-bg-base"
      style={{ width: EXPANDED_WIDTH }}
      aria-label={language.t("home.projects")}
    >
      <Show when={expanded()}>
        <div class="flex h-9 shrink-0 items-center justify-between gap-1 px-2">
          <div class="min-w-0 flex-1 truncate text-v2-text-text-muted [font-weight:530]">
            {language.t("home.projects")}
          </div>
          <TooltipV2 placement="bottom" value={language.t("home.project.add")}>
            <IconButtonV2
              variant="ghost-muted"
              size="small"
              icon={<IconV2 name="folder-add-left" />}
              aria-label={language.t("home.project.add")}
              onClick={() => addProject()}
            />
          </TooltipV2>
        </div>
      </Show>
      <div
        class="min-h-0 flex-1 overflow-y-auto no-scrollbar"
        classList={{
          "px-2 pb-3": expanded(),
          "px-1 py-2": !expanded(),
        }}
      >
        <Show
          when={projects().length > 0}
          fallback={
            <TooltipV2
              placement="right"
              class="flex justify-center"
              value={language.t("home.project.add")}
              inactive={expanded()}
            >
              <button
                type="button"
                class="flex w-full min-w-0 items-center rounded-[3px] text-v2-text-text-muted [font-weight:440] hover:bg-v2-background-bg-layer-01 hover:text-v2-text-text-base"
                classList={{
                  "h-7 gap-2 px-1.5": expanded(),
                  "size-8 justify-center": !expanded(),
                }}
                onClick={() => addProject()}
              >
                <IconV2 name="folder-add-left" size="small" class="text-v2-icon-icon-muted" />
                <Show when={expanded()}>
                  <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {language.t("home.project.add")}
                  </span>
                </Show>
              </button>
            </TooltipV2>
          }
        >
          <div class="flex flex-col" classList={{ "gap-3": expanded(), "gap-1": !expanded() }}>
            <For each={grouped()}>
              {(group) => (
                <div class="flex min-w-0 flex-col" classList={{ "gap-0.5": expanded(), "gap-1": !expanded() }}>
                  <Show when={expanded() && servers().length > 1 && group.name}>
                    <div class="px-1.5 pb-1 text-[11px] leading-none text-v2-text-text-faint [font-weight:530]">
                      {group.name}
                    </div>
                  </Show>
                  <For each={group.items}>
                    {(project) => (
                      <SessionProjectNavRow
                        project={project}
                        server={projectServer(project)}
                        selected={selected(project)}
                        expanded={expanded()}
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
      <Show when={!expanded()}>
        <div class="flex shrink-0 justify-center px-1 pb-2">
          <TooltipV2 placement="right" value={language.t("home.project.add")}>
            <IconButtonV2
              variant="ghost-muted"
              size="small"
              icon={<IconV2 name="folder-add-left" />}
              aria-label={language.t("home.project.add")}
              onClick={() => addProject()}
            />
          </TooltipV2>
        </div>
      </Show>
    </aside>
    </div>
    </>
  )
}

function SessionProjectNavRow(props: {
  project: PromptProject
  server: ServerConnection.Key
  selected: boolean
  expanded: boolean
  onSelect: () => void
}) {
  const name = () => displayName(props.project)
  const directories = createMemo(() => [props.project.worktree, ...(props.project.sandboxes ?? [])])
  const state = useProjectNavAvatarState(
    () => props.server,
    directories,
  )

  return (
    <TooltipV2 placement="right" class="flex justify-center" value={name()} inactive={props.expanded}>
      <button
        type="button"
        data-component="session-project-nav-row"
        data-selected={props.selected ? "" : undefined}
        data-working={state.loading() ? "" : undefined}
        data-ready={state.unread() && !state.loading() ? "" : undefined}
        aria-current={props.selected ? "page" : undefined}
        aria-label={name()}
        class="flex min-w-0 cursor-default items-center rounded-[3px] text-v2-text-text-muted [font-weight:440] transition-[background-color,color] duration-[120ms] ease-in-out hover:bg-v2-background-bg-layer-01 hover:text-v2-text-text-base data-[selected]:bg-v2-background-bg-layer-03 data-[selected]:text-v2-text-text-base data-[selected]:hover:bg-v2-background-bg-layer-03 focus-visible:outline-none focus-visible:bg-v2-background-bg-layer-01"
        classList={{
          "h-7 w-full gap-2 px-1.5 text-left": props.expanded,
          "size-8 justify-center": !props.expanded,
        }}
        onClick={props.onSelect}
      >
        <span class="relative block size-4 shrink-0 overflow-visible">
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
        <Show when={props.expanded}>
          <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{name()}</span>
        </Show>
      </button>
    </TooltipV2>
  )
}
