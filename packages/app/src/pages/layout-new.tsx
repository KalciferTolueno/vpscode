import { createEffect, createMemo, Show, Suspense, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { DebugBar } from "@/components/debug-bar"
import { TabsInfoPopup } from "@/components/help-button"
import { Titlebar, type TitlebarUpdate } from "@/components/titlebar"
import { isIdleRoute, useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { IdleNav } from "@/pages/home/idle-nav"
import { setV2Toast, ToastRegion } from "@/utils/toast"

export default function NewLayout(props: ParentProps) {
  const platform = usePlatform()
  const layout = useLayout()
  const idle = createMemo(() => isIdleRoute(layout.route()))
  const [state, setState] = createStore({ debugTools: true })

  createEffect(() => setV2Toast(true))

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
      <Titlebar
        update={update}
        debugTools={
          import.meta.env.DEV
            ? { visible: state.debugTools, toggle: () => setState("debugTools", (value) => !value) }
            : undefined
        }
      />
      <main
        data-component="layout-main"
        class="flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col items-start contain-strict"
      >
        <div class="flex min-h-0 min-w-0 w-full flex-1">
          <Show when={idle()}>
            <IdleNav />
          </Show>
          <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Suspense
              fallback={
                <div class="min-h-0 min-w-0 flex-1 self-stretch rounded-[3px] bg-v2-background-bg-deep" data-oc-enter />
              }
            >
              {props.children}
            </Suspense>
          </div>
        </div>
      </main>
      {import.meta.env.DEV && state.debugTools && <DebugBar inline />}
      <TabsInfoPopup />
      <ToastRegion v2 />
    </div>
  )
}
