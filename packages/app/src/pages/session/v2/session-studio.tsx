import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSDK } from "@/context/sdk"
import { useServer } from "@/context/server"
import { useSessionLayout } from "@/pages/session/session-layout"
import { SESSION_OPEN_FILE_TAB, createOpenSessionFileTab } from "@/pages/session/helpers"
import { SessionFileBrowserTab, type SessionFileBrowserState } from "@/pages/session/v2/session-file-browser-tab"
import { SessionPreviewTab, PRESETS, reloadPreviewFor, togglePickFor, watchPickFor, type PreviewPreset } from "@/pages/session/v2/session-preview-tab"
import { PREVIEW_OPEN_EVENT, previewIframeSrc } from "@/pages/session/v2/preview-url"
import {
  ARTIFACT_EXTENSIONS,
  archiveUrl,
  downloadProjectBlob,
  fileDownloadUrl,
  isArtifactPath,
  projectDownloadHeaders,
} from "@/pages/session/v2/project-download"
import { showToast } from "@/utils/toast"
import type { Kind } from "@/components/file-tree-v2"
import "./session-studio.css"

const emptyKinds: ReadonlyMap<string, Kind> = new Map()

export function SessionStudio(props: {
  sessionKey: string
  kinds?: ReadonlyMap<string, Kind>
  fileBrowserState: SessionFileBrowserState
}) {
  const language = useLanguage()
  const file = useFile()
  const sdk = useSDK()
  const server = useServer()
  const platform = usePlatform()
  const { tabs, view } = useSessionLayout()
  const [studioView, setStudioView] = createSignal<"preview" | "code">("preview")
  const compact = createMediaQuery("(max-width: 767px)")
  const [preset, setPreset] = createSignal<PreviewPreset>("desktop")
  createEffect(on(compact, (narrow) => setPreset(narrow ? "mobile" : "desktop")))
  const [fullscreen, setFullscreen] = createSignal(false)
  const [picking, setPicking] = createSignal(false)
  const [downloading, setDownloading] = createSignal(false)
  const [artifacts, setArtifacts] = createSignal<string[]>([])
  const projectDirectory = createMemo(() => sdk().directory)
  let root: HTMLDivElement | undefined

  const normalizeTab = (tab: string) => {
    if (!tab.startsWith("file://")) return tab
    return file.tab(tab)
  }
  const openReviewPanel = () => {
    if (!view().reviewPanel.opened()) view().reviewPanel.open()
  }
  const openTab = createOpenSessionFileTab({
    normalizeTab,
    openTab: tabs().open,
    pathFromTab: file.pathFromTab,
    loadFile: file.load,
    openReviewPanel,
    setActive: tabs().setActive,
  })
  const previewTab = (value: string) => {
    const next = normalizeTab(value)
    tabs().previewTab(next)
    const path = file.pathFromTab(next)
    if (path) void file.load(path)
    openReviewPanel()
    queueMicrotask(() => tabs().setActive(next))
  }
  const activeFile = createMemo(() => {
    const active = tabs().active()
    if (active && file.pathFromTab(active)) return active
    return tabs()
      .all()
      .find((tab) => file.pathFromTab(tab))
  })
  const codeTab = createMemo(() => activeFile() ?? SESSION_OPEN_FILE_TAB)

  const showPreview = () => {
    setStudioView("preview")
    tabs().open("browser")
    openReviewPanel()
    queueMicrotask(() => tabs().setActive("browser"))
  }
  const showCode = () => {
    if (picking()) togglePickFor(props.sessionKey, "browser")
    setStudioView("code")
    openReviewPanel()
    if (!activeFile()) previewTab(SESSION_OPEN_FILE_TAB)
  }

  const onPreviewOpen = (event: Event) => {
    const url = (event as CustomEvent<string>).detail
    if (typeof url !== "string" || !previewIframeSrc(url)) return
    showPreview()
  }
  window.addEventListener(PREVIEW_OPEN_EVENT, onPreviewOpen)
  onCleanup(() => window.removeEventListener(PREVIEW_OPEN_EVENT, onPreviewOpen))
  onCleanup(watchPickFor(props.sessionKey, "browser", setPicking))

  const exitFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    setFullscreen(false)
  }
  const toggleFullscreen = () => {
    if (fullscreen()) {
      exitFullscreen()
      return
    }
    setFullscreen(true)
    void root?.requestFullscreen?.()
  }
  const onFullscreenChange = () => {
    if (!document.fullscreenElement) setFullscreen(false)
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && fullscreen()) exitFullscreen()
  }
  document.addEventListener("fullscreenchange", onFullscreenChange)
  window.addEventListener("keydown", onKey)
  onCleanup(() => {
    document.removeEventListener("fullscreenchange", onFullscreenChange)
    window.removeEventListener("keydown", onKey)
  })

  const headers = () => projectDownloadHeaders(server.current)
  const filenameZip = () => {
    const dir = projectDirectory() ?? "project"
    const base = dir.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "project"
    return `${base}.zip`
  }
  const downloadZip = async () => {
    const directory = projectDirectory()
    if (!directory || downloading()) return
    setDownloading(true)
    try {
      await downloadProjectBlob({
        url: archiveUrl(sdk().url, directory),
        headers: headers(),
        filename: filenameZip(),
        fetch: platform.fetch,
      })
    } catch {
      showToast({
        variant: "error",
        title: language.t("session.studio.downloadFailed"),
      })
    } finally {
      setDownloading(false)
    }
  }
  const downloadFile = async (path: string) => {
    const directory = projectDirectory()
    if (!directory || downloading()) return
    setDownloading(true)
    try {
      await downloadProjectBlob({
        url: fileDownloadUrl(sdk().url, directory, path),
        headers: headers(),
        filename: path.split(/[\\/]/).pop() || path,
        fetch: platform.fetch,
      })
    } catch {
      showToast({
        variant: "error",
        title: language.t("session.studio.downloadFailed"),
      })
    } finally {
      setDownloading(false)
    }
  }
  const loadArtifacts = () => {
    void Promise.all(ARTIFACT_EXTENSIONS.map((ext) => file.searchFiles(ext, { limit: 20 }))).then((lists) => {
      setArtifacts([...new Set(lists.flat().filter(isArtifactPath))])
    })
  }

  return (
    <div
      ref={root}
      class="session-studio"
      data-fullscreen={fullscreen() ? "" : undefined}
      data-component="session-studio"
    >
      <div class="session-studio-bar">
        <div class="session-studio-switch" role="tablist" aria-label={language.t("session.studio.views")}>
          <button
            type="button"
            role="tab"
            aria-selected={studioView() === "preview"}
            aria-pressed={studioView() === "preview"}
            onClick={showPreview}
          >
            {language.t("session.tab.preview")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={studioView() === "code"}
            aria-pressed={studioView() === "code"}
            onClick={showCode}
          >
            {language.t("session.tab.code")}
          </button>
        </div>
        <Show when={studioView() === "preview"}>
          <div class="session-studio-presets">
            <For each={PRESETS}>
              {(item) => (
                <IconButton
                  icon={item.icon}
                  variant="ghost"
                  class="h-6 w-6"
                  classList={{ "!bg-v2-overlay-simple-overlay-hover": preset() === item.key }}
                  onClick={() => setPreset(item.key)}
                  aria-label={language.t(`session.preview.responsive.${item.key}`)}
                  aria-pressed={preset() === item.key}
                />
              )}
            </For>
          </div>
        </Show>
        <div class="session-studio-actions">
          <Show
            when={studioView() === "code"}
            fallback={
              <>
                <IconButton
                  icon="magnifying-glass"
                  variant="ghost"
                  class="h-6 w-6"
                  classList={{ "!bg-v2-overlay-simple-overlay-hover": picking() }}
                  onClick={() => togglePickFor(props.sessionKey, "browser")}
                  aria-label={language.t("session.preview.pickElement")}
                  aria-pressed={picking()}
                />
                <IconButton
                  icon="refresh"
                  variant="ghost"
                  class="h-6 w-6"
                  onClick={() => reloadPreviewFor(props.sessionKey, "browser")}
                  aria-label={language.t("session.preview.reload")}
                />
                <IconButton
                  icon={fullscreen() ? "collapse" : "fullscreen"}
                  variant="ghost"
                  class="h-6 w-6"
                  onClick={toggleFullscreen}
                  aria-label={
                    fullscreen() ? language.t("session.studio.exitFullscreen") : language.t("session.studio.fullscreen")
                  }
                  aria-pressed={fullscreen()}
                />
              </>
            }
          >
            <DropdownMenu placement="bottom-end" gutter={4} onOpenChange={(open) => open && loadArtifacts()}>
              <DropdownMenu.Trigger class="session-studio-download" disabled={downloading()}>
                {language.t("session.studio.download")}
                <Icon name="chevron-down" size="small" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.Item onSelect={() => void downloadZip()}>
                    <DropdownMenu.ItemLabel>{language.t("session.studio.downloadZip")}</DropdownMenu.ItemLabel>
                  </DropdownMenu.Item>
                  <For each={artifacts()}>
                    {(path) => (
                      <DropdownMenu.Item onSelect={() => void downloadFile(path)}>
                        <DropdownMenu.ItemLabel>{path.split(/[\\/]/).pop()}</DropdownMenu.ItemLabel>
                      </DropdownMenu.Item>
                    )}
                  </For>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
          </Show>
        </div>
      </div>
      <div class="session-studio-body">
        <div class="session-studio-pane" hidden={studioView() !== "preview"}>
          <SessionPreviewTab
            tabId="browser"
            sessionKey={props.sessionKey}
            chrome="stage"
            preset={preset()}
            fill={preset() === "desktop"}
          />
        </div>
        <Show when={studioView() === "code"}>
          <div class="session-studio-pane">
            <SessionFileBrowserTab
              tab={codeTab()}
              placeholder={codeTab() === SESSION_OPEN_FILE_TAB}
              active={file.pathFromTab(codeTab())}
              kinds={props.kinds ?? emptyKinds}
              state={props.fileBrowserState}
              onSelect={(path) => previewTab(file.tab(path))}
              onSelectPermanent={(path) => openTab(file.tab(path))}
            />
          </div>
        </Show>
      </div>
    </div>
  )
}
