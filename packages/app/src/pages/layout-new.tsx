import { createEffect, createMemo, createSignal, lazy, Show, Suspense, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { DebugBar } from "@/components/debug-bar"
import { TabsInfoPopup } from "@/components/help-button"
import { Titlebar, type TitlebarUpdate } from "@/components/titlebar"
import { isIdleRoute, useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { IdleNav } from "@/pages/home/idle-nav"
import { COMPACT_SHELL_QUERY } from "@/pages/layout/compact-shell"
import { setV2Toast, ToastRegion } from "@/utils/toast"

const Dither = lazy(async () => {
  const { Dither } = await import("@/components/dither")
  return { default: Dither }
})

export default function NewLayout(props: ParentProps) {
  const platform = usePlatform()
  const layout = useLayout()
  const idle = createMemo(() => isIdleRoute(layout.route()))
  const compact = createMediaQuery(COMPACT_SHELL_QUERY)
  const [mobileNav, setMobileNav] = createSignal(false)
  const [state, setState] = createStore({ debugTools: true })

  createEffect(() => setV2Toast(true))
  createEffect(() => {
    if (!compact()) setMobileNav(false)
  })

  const update: TitlebarUpdate = {
    version: () => {
      const state = platform.updater?.state()
      if (state?.status !== "ready") return
      return state.version
    },
    installing: () => platform.updater?.state().status === "installing",
    install: () => void platform.updater?.install(),
  }

  return (
    <div
      class="relative bg-v2-background-bg-deep flex-1 min-h-0 min-w-0 flex flex-col select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable]]:select-text"
      style={{
        "padding-top": "env(safe-area-inset-top, 0px)",
        "padding-bottom": "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        class="pointer-events-none absolute inset-0 z-0 opacity-20"
        aria-hidden="true"
      >
        <Suspense>
          <Dither />
        </Suspense>
      </div>
      <div class="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
        <Titlebar
          update={update}
          debugTools={
            import.meta.env.DEV
              ? { visible: state.debugTools, toggle: () => setState("debugTools", (value) => !value) }
              : undefined
          }
          mobileNav={{
            open: mobileNav,
            toggle: () => setMobileNav((value) => !value),
          }}
        />
        <main
          data-component="layout-main"
          class="flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col items-start contain-strict"
        >
          <div class="flex min-h-0 min-w-0 w-full flex-1">
            <Show when={idle() || compact()}>
              <IdleNav desktop={idle()} mobileOpen={mobileNav()} onMobileClose={() => setMobileNav(false)} />
            </Show>
            <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <Suspense
                fallback={
                  <div class="min-h-0 min-w-0 flex-1 self-stretch rounded-[3px]" data-oc-enter />
                }
              >
                {props.children}
              </Suspense>
            </div>
          </div>
        </main>
        {import.meta.env.DEV && state.debugTools && <DebugBar inline />}
      </div>
      <TabsInfoPopup />
      <ToastRegion v2 />
    </div>
  )
}
