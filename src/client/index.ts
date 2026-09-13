/**
 * dsh-headroom browser half entry: registers the "线路切换" settings section.
 * The section binds the `llm-deepseek` namespace through the settings scope
 * service and writes `baseURL` (or unsets it to revert to the composition
 * default) — the same hot-reloaded field the dsh-llm-deepseek adapter reads
 * per request.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry),
// the ctx.settingsScope Context merge, and the SettingsScope contract.
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
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
 * Minimal stand-in for `bindSnapshotSelector`, which shipped in
 * `@deepseek-ai/dsh-client-web-react` — a package dsh 0.1.5 dropped (it is no
 * longer a platform seed word nor a materialized module). The underlying
 * contract is unchanged: `SettingsScope` still exposes `subscribe` /
 * `getSnapshot`, so a `useSyncExternalStore` wrapper is all that was lost.
 * The derived value is cached per snapshot so an inline selector does not
 * produce a fresh reference on every render.
 * @param scope - the settings namespace scope to bind.
 * @returns a selector hook reading derived values off the scope snapshot.
 */
function makeSnapshotSelector<T>(scope: SettingsScope<T>) {
  return function useSnapshotSelector<R>(selector: (snapshot: SettingsScopeSnapshot<T>) => R): R {
    const cacheRef = useRef<{ src: SettingsScopeSnapshot<T> | undefined; out: R }>({
      src: undefined,
      out: undefined as unknown as R,
    })
    const selRef = useRef(selector)
    selRef.current = selector
    const subscribe = useCallback((onChange: () => void) => scope.subscribe(onChange), [scope])
    const getSnapshot = useCallback(() => {
      const src = scope.getSnapshot()
      if (cacheRef.current.src !== src) cacheRef.current = { src, out: selRef.current(src) }
      return cacheRef.current.out
    }, [scope])
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  }
}

/**
 * Required services (cordis fiber inject). The `settings.section` declaration
 * lives in ui-settings-general's SettingsRoot entry; registration waits on it
 * through `slots.inject()`. `settingsScope` supplies the hot-reloaded
 * `llm-deepseek` namespace scope; `remote` exposes the host command channel
 * used by the lifecycle buttons; `sessions` resolves the active agent id.
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope', 'sessions']

/**
 * Register the Headroom panel once the `settings.section` declaration is on
 * the ledger, binding the `llm-deepseek` namespace scope for the page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-headroom: copy dictionaries')

  const scope = ctx.settingsScope.bind<DeepSeekRouteSettings>({ namespace: LLM_DEEPSEEK_NAMESPACE })
  const useSnapshot = makeSnapshotSelector(scope)
  const t = ctx.locale.bind(NS) as HeadroomPanelInjected['t']
  // Host command channel: execute('/headroom start') etc. via the commands remote.
  const remote = ctx.get('remote') as { command?: { execute: (agentId: unknown, line: string) => Promise<unknown> } } | undefined
  const sessions = ctx.get('sessions') as { current?: () => { sessionId: string } | undefined } | undefined
  const injected = (): HeadroomPanelInjected => ({
    scope,
    useSnapshot,
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

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-headroom',
    order: 20,
    label: () => t('nav'),
    inject: injected,
  }, HeadroomPanel))
}
