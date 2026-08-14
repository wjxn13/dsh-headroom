/**
 * dsh-headroom browser half entry: registers the "线路切换" settings section.
 * The section binds the `llm-deepseek` namespace through the settings scope
 * service and writes `baseURL` (or unsets it to revert to the composition
 * default) — the same hot-reloaded field the dsh-llm-deepseek adapter reads
 * per request.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry)
// and the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { HeadroomPanel } from './HeadroomPanel.tsx'
import type { DeepSeekRouteSettings, HeadroomPanelInjected } from './HeadroomPanel.tsx'
import { en, zh, type HeadroomPanelKey } from './locales.ts'
import { LLM_DEEPSEEK_NAMESPACE } from '../constants.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Headroom route panel copy. */
    'dsh-headroom': HeadroomPanelKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'dsh-headroom'

/**
 * Required services (cordis fiber inject). The `settings.section` declaration
 * lives in ui-settings-general's SettingsRoot entry; registration waits on it
 * through `slots.inject()`. `settingsScope` supplies the hot-reloaded
 * `llm-deepseek` namespace scope.
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Register the Headroom panel once the `settings.section` declaration is on
 * the ledger, binding the `llm-deepseek` namespace scope for the page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-headroom: copy dictionaries')

  const scope = ctx.settingsScope.bind<DeepSeekRouteSettings>({ namespace: LLM_DEEPSEEK_NAMESPACE })
  const useSnapshot = bindSnapshotSelector(scope)
  const t = ctx.locale.bind(NS) as HeadroomPanelInjected['t']
  const injected = (): HeadroomPanelInjected => ({ scope, useSnapshot, t })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-headroom',
    order: 20,
    label: () => t('nav'),
    inject: injected,
  }, HeadroomPanel))
}
