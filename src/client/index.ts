/**
 * dsh-headroom browser half entry: registers the "\u7ebf\u8def\u5207\u6362" settings section.
 * The section binds the `llm-deepseek` namespace through the config-forms service
 * and writes `baseURL` (or unsets it to revert to the composition default) --
 * the same hot-reloaded field the dsh-llm-deepseek adapter reads per request.
 *
 * 2026-10-04 (dsh 0.2.0-rc.2) -- rewritten against the real 0.2.0 surface.
 *
 *   0.2.0 REMOVED the per-namespace settings scope:
 *     - `settingsScope` no longer exists anywhere in the 0.2.0 tree (0 refs)
 *     - `SettingsScope` / `SettingsScopeSnapshot` types are gone
 *     - `dsh-client-ui-settings` now provides two services instead:
 *         `configForms`   -> `ctx.configForms.get(namespace)` returns a
 *                            `ConfigForm<T>`: getSnapshot / subscribe / set / unset / mutate
 *         `settingsSchema`-> schema operations
 *     - `ConfigFormSnapshot<T>` keeps the SAME field names the old
 *       `SettingsScopeSnapshot<T>` had (status / value / base / user / revision /
 *       writable / mode), so `HeadroomPanel.tsx` needs no change at all.
 *
 *   The one behavioural difference: `ConfigForms.get(entryId)` memoizes per
 *   namespace and is safe to call repeatedly, so there is no bind/unbind dance
 *   and no per-plugin lifecycle to own.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry) and
// the ConfigForm / ConfigFormSnapshot contracts.
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
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
 * Selector hook over a ConfigForm snapshot. Built on `useSyncExternalStore`
 * rather than a helper import, so an inline selector does not produce a fresh
 * reference on every render.
 * @param form - the config form to bind.
 * @returns a selector hook reading derived values off the form snapshot.
 */
function makeSnapshotSelector<T>(form: ConfigForm<T>) {
  return function useSnapshotSelector<R>(selector: (snapshot: ConfigFormSnapshot<T>) => R): R {
    const cacheRef = useRef<{ src: ConfigFormSnapshot<T> | undefined; out: R }>({
      src: undefined,
      out: undefined as unknown as R,
    })
    const selRef = useRef(selector)
    selRef.current = selector
    const subscribe = useCallback((onChange: () => void) => form.subscribe(onChange), [form])
    const getSnapshot = useCallback(() => {
      const src = form.getSnapshot()
      if (cacheRef.current.src !== src) cacheRef.current = { src, out: selRef.current(src) }
      return cacheRef.current.out
    }, [form])
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  }
}

/**
 * Required services (cordis fiber inject). `configForms` replaces the removed
 * `settingsScope`; its provider is `dsh-client-ui-settings`, which itself only
 * injects `['remote','remote.settings']` and therefore registers after this
 * plugin does -- so, exactly like the old scope, it must NOT be a hard entry in
 * this array. It is bound through a deferred `ctx.inject` below instead.
 *
 * `slots` / `locale` are enough to register the section itself; the section is
 * registered at the top level so the nav row appears regardless of settings
 * timing (verified: this is the shape dsh-headroom-manager and dshmarket use).
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'sessions']

/**
 * Register the Headroom panel.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-headroom: copy dictionaries')

  const t = ctx.locale.bind(NS) as HeadroomPanelInjected['t']
  // Host command channel: execute('/headroom start') etc. via the commands remote.
  const remote = ctx.get('remote') as { command?: { execute: (agentId: unknown, line: string) => Promise<unknown> } } | undefined
  const sessions = ctx.get('sessions') as { current?: () => { sessionId: string } | undefined } | undefined

  // Held so the panel can be registered before the settings form exists.
  let form: ConfigForm<DeepSeekRouteSettings> | undefined
  let useSnapshot: HeadroomPanelInjected['useSnapshot'] = (selector =>
    selector({ status: 'loading', value: undefined, base: undefined, user: undefined,
               revision: undefined, writable: false, mode: 'host' })) as HeadroomPanelInjected['useSnapshot']

  const injected = (): HeadroomPanelInjected => ({
    get scope() { return form },
    get useSnapshot() { return useSnapshot },
    t,
    runCommand: async (line: string) => {
      // Resolve the current agent session id for the command RPC; fall back to
      // "current" when no session service is available.
      let agentId: unknown = 'current'
      try {
        const current = sessions?.current?.()
        if (current !== undefined) agentId = current.sessionId
      } catch { /* keep 'current' */ }
      if (remote?.command?.execute === undefined) {
        return { kind: 'error', text: t('error').replace('{message}', 'host command channel unavailable') }
      }
      const raw = await remote.command.execute(agentId, line)
      const result = (raw as { result?: { kind?: string; text?: string } } | undefined)?.result
      return {
        kind: result?.kind === 'error' ? 'error' : 'success',
        text: result?.text ?? String(raw),
      }
    },
  })

  // Top-level registration: the nav row must not depend on settings timing.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-headroom',
    order: 20,
    label: () => t('nav'),
    inject: injected,
  }, HeadroomPanel))

  // Bind the real config form once the settings provider has registered.
  ctx.inject(['configForms'], (scoped) => {
    const forms = (scoped as unknown as {
      configForms: { get<T>(entryId: string): ConfigForm<T> }
    }).configForms
    form = forms.get<DeepSeekRouteSettings>(LLM_DEEPSEEK_NAMESPACE)
    useSnapshot = makeSnapshotSelector(form) as HeadroomPanelInjected['useSnapshot']
  })
}
