import { For, Show, createMemo, createSignal, onMount } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { type PromptProject } from "@/components/prompt-project-selector"
import { createPromptProjectControls } from "@/pages/session/composer"
import { SessionTabAvatarView } from "@/pages/layout/session-tab-avatar"
import { useProjectNavAvatarState } from "@/pages/layout/project-avatar-state"
import { displayName } from "@/pages/layout/helpers"
import { ServerConnection, useServer } from "@/context/server"
import { pathKey } from "@/utils/path-key"

const COLLAPSED_WIDTH = "3rem"

export function SessionProjectNav(props: { ref?: HTMLElement | ((el: HTMLElement) => void) }) {
  const language = useLanguage()
  const server = useServer()
  const controls = createPromptProjectControls()
  const isDesktop = createMediaQuery("(min-width: 768px)")
  const canHover = createMediaQuery("(hover: hover) and (pointer: fine)")
  const [hoverOpen, setHoverOpen] = createSignal(false)
  const [hoverArmed, setHoverArmed] = createSignal(false)
  let rail: HTMLElement | undefined

  const closeHover = () => {
    setHoverOpen(false)
    setHoverArmed(true)
  }

  onMount(() => {
    requestAnimationFrame(() => {
      if (rail?.matches(":hover")) return
      setHoverArmed(true)
    })
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
  }

  const projectServer = (project: PromptProject) => {
    if (project.server?.key) return ServerConnection.Key.make(project.server.key)
    if (controls().server) return ServerConnection.Key.make(controls().server)
    return server.key
  }

  const addProject = (serverKey?: string) => {
    controls().add(language.t("home.project.add"), serverKey ?? controls().server)
  }

  return (
    <Show when={isDesktop()}>
      <div
        ref={(el) => {
          rail = el
          const next = props.ref
          if (typeof next === "function") next(el)
        }}
        data-component="session-project-nav-rail"
        data-hover-open={hoverOpen() ? "" : undefined}
        class="relative z-[80] shrink-0 min-h-0 h-full overflow-visible"
        style={{ width: COLLAPSED_WIDTH }}
        onPointerEnter={() => {
          if (!canHover() || !hoverArmed()) return
          setHoverOpen(true)
        }}
        onPointerLeave={closeHover}
        onFocusIn={() => setHoverOpen(true)}
        onFocusOut={(event) => {
          const next = event.relatedTarget
          if (next instanceof Node && rail?.contains(next)) return
          if (rail?.matches(":hover")) return
          closeHover()
        }}
      >
        <aside
          data-component="session-project-nav"
          class="absolute inset-y-0 start-0 z-[1] flex h-full flex-col overflow-hidden rounded-[3px] border border-v2-border-border-base bg-v2-background-bg-base"
          aria-label={language.t("home.projects")}
          aria-expanded={hoverOpen()}
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
            <TooltipV2 placement="right" value={language.t("home.project.add")} inactive={canHover()}>
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
      </div>
    </Show>
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
