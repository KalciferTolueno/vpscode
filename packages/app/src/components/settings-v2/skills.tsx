import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { createResource, For, Show, type Component } from "solid-js"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"
import "./settings-v2.css"

export const SettingsSkillsV2: Component = () => {
  const language = useLanguage()
  const serverSdk = useServerSDK()
  const serverSync = useServerSync()
  const [skills] = createResource(
    () => serverSync().data.path.config,
    async (directory) => {
      const result = await serverSdk().client.app.skills({ directory })
      return (result.data ?? [])
        .filter((skill) => skill.location !== "<built-in>")
        .toSorted((a, b) => a.name.localeCompare(b.name))
    },
    { initialValue: [] },
  )

  const setEnabled = async (name: string, enabled: boolean) => {
    const before = serverSync().data.config.disabled_skills ?? []
    const next = enabled ? before.filter((item) => item !== name) : before.includes(name) ? before : [...before, name]
    serverSync().set("config", "disabled_skills", next)
    await serverSync()
      .updateConfig({ disabled_skills: next })
      .catch((error: unknown) => {
        serverSync().set("config", "disabled_skills", before)
        showToast({
          title: language.t("settings.skills.toast.updateFailed"),
          description: error instanceof Error ? error.message : String(error),
        })
      })
  }

  return (
    <>
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("settings.skills.title")}</h2>
      </div>
      <div class="settings-v2-tab-body">
        <div class="settings-v2-section">
          <h3 class="settings-v2-section-title">{language.t("settings.skills.description")}</h3>
          <Show
            when={!skills.loading && !skills.error && skills().length > 0}
            fallback={
              <div class="settings-v2-servers-status">
                {skills.loading
                  ? language.t("settings.skills.loading")
                  : skills.error
                    ? language.t("common.requestFailed")
                    : language.t("settings.skills.empty")}
              </div>
            }
          >
            <SettingsListV2>
              <For each={skills()}>
                {(skill) => (
                  <SettingsRowV2 title={skill.name} description={skill.description ?? skill.location}>
                    <Switch
                      checked={!serverSync().data.config.disabled_skills?.includes(skill.name)}
                      onChange={(enabled) => void setEnabled(skill.name, enabled)}
                      hideLabel
                    >
                      {skill.name}
                    </Switch>
                  </SettingsRowV2>
                )}
              </For>
            </SettingsListV2>
          </Show>
        </div>
      </div>
    </>
  )
}
