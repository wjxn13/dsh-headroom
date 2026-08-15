/**
 * dsh-headroom browser half: the "线路切换" settings section.
 *
 * Presents the Headroom compression route as a control panel:
 *  - current route (direct / compressed / unknown) from the `llm-deepseek`
 *    settings namespace
 *  - Headroom health (probed in-browser; the proxy answers loopback CORS)
 *  - one-click route toggle (writes `llm-deepseek.baseURL`)
 *
 * The heavy lifecycle actions (install / start / stop) are orchestrated by the
 * host half; the UI surfaces their outcomes through the settings snapshot and
 * the health probe. This panel is an integration surface only — the
 * compression engine is Headroom (see NOTICE).
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import { DIRECT_BASE_URL, HEADROOM_BASE_URL, HEADROOM_LIVEZ_URL } from '../constants.ts'
import type { en } from './locales.ts'
import styles from './HeadroomPanel.module.css'

/** The narrowed `llm-deepseek` section this page reads and writes. */
export interface DeepSeekRouteSettings {
  /** The configured endpoint override; undefined means the composition default. */
  baseURL?: string
}

/** Injected dependencies of {@link HeadroomPanel}. */
export interface HeadroomPanelInjected {
  /** Hot-reloaded `llm-deepseek` namespace scope. */
  scope: SettingsScope<DeepSeekRouteSettings>
  /** uSES hook bound to the scope snapshot. */
  useSnapshot: SnapshotSelectorHook<SettingsScopeSnapshot<DeepSeekRouteSettings>>
  /** Panel copy. */
  t: (key: keyof typeof en) => string
  /** Execute a host command (e.g. '/headroom start') and return its result. */
  runCommand: (line: string) => Promise<{ kind: 'success' | 'error'; text: string }>
}

/** Props delivered by the slot outlet (inject face spread flat). */
export type HeadroomPanelProps = Partial<HeadroomPanelInjected>

/** Headroom health probe outcome. */
type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'healthy'; version: string }
  | { kind: 'down' }

/** The resolved route name for a baseURL value (undefined = direct default). */
function routeOf(baseURL: string | undefined): 'direct' | 'headroom' | 'unknown' {
  if (baseURL === undefined || baseURL === DIRECT_BASE_URL) return 'direct'
  if (baseURL === HEADROOM_BASE_URL) return 'headroom'
  return 'unknown'
}

/**
 * Probe Headroom `/livez` once. The proxy answers the loopback origin's CORS
 * preflight, so a plain fetch is sufficient; a timeout or network failure
 * means the route is down.
 * @returns the probe outcome.
 */
async function probeHeadroom(): Promise<Exclude<ProbeState, { kind: 'idle' | 'probing' }>> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    try {
      const response = await fetch(HEADROOM_LIVEZ_URL, { signal: controller.signal })
      if (!response.ok) return { kind: 'down' }
      const body = (await response.json()) as { version?: string }
      return { kind: 'healthy', version: typeof body.version === 'string' ? body.version : '?' }
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return { kind: 'down' }
  }
}

/**
 * Render the Headroom control panel: current route, proxy health, route
 * toggle, and the safety notes. All writes go through the settings scope; the
 * panel re-renders from the next snapshot.
 * @param props - the inject face (scope, snapshot hook, copy).
 * @returns the panel content.
 */
export function HeadroomPanel(props: HeadroomPanelProps): ReactNode {
  const { scope, useSnapshot, t, runCommand } = props
  if (scope === undefined || useSnapshot === undefined || t === undefined) return null
  const snapshot = useSnapshot((s) => s)
  const baseURL = snapshot.value?.baseURL
  const writable = snapshot.writable === true
  const route = routeOf(baseURL)
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [opBusy, setOpBusy] = useState<string | null>(null)
  const [opResult, setOpResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (route !== 'headroom' || probe.kind !== 'idle') return
    setProbe({ kind: 'probing' })
    void probeHeadroom().then(setProbe)
  }, [route, probe.kind])

  const switchRoute = async (target: 'direct' | 'headroom'): Promise<void> => {
    if (!writable) return
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      if (target === 'direct') await scope.unset('baseURL')
      else await scope.set('baseURL', HEADROOM_BASE_URL)
      setDone(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }

  const runLifecycle = async (command: string, label: string): Promise<void> => {
    if (runCommand === undefined) return
    setOpBusy(label)
    setOpResult(null)
    try {
      const result = await runCommand(command)
      setOpResult(result)
      // Refresh the health probe after start/stop so the badge reflects reality.
      setProbe({ kind: 'probing' })
      void probeHeadroom().then(setProbe)
    } catch (failure) {
      setOpResult({ kind: 'error', text: failure instanceof Error ? failure.message : String(failure) })
    } finally {
      setOpBusy(null)
    }
  }

  const routeLabel = route === 'direct' ? t('routeDirect')
    : route === 'headroom' ? t('routeHeadroom')
      : t('routeUnknown')

  return (
    <section className={styles['section']} aria-label={t('title')}>
      <div className={styles['card']}>
        <div className={styles['row']}>
          <span className={styles['label']}>{t('current')}</span>
          <span className={styles['value']}>{routeLabel}</span>
        </div>
        <div className={styles['row']}>
          <span className={styles['label']}>{t('headroomStatus')}</span>
          {probe.kind === 'healthy'
            ? <span className={`${styles['badge']} ${styles['badgeHealthy']}`}>{t('headroomHealthy').replace('{version}', probe.version)}</span>
            : probe.kind === 'down'
              ? <span className={`${styles['badge']} ${styles['badgeDown']}`}>{t('headroomDown')}</span>
              : <span className={`${styles['badge']} ${styles['badgeProbing']}`}>{t('headroomProbing')}</span>}
        </div>
        {probe.kind === 'down' && route === 'headroom'
          ? <div className={styles['warning']}>{t('headroomDownWarning')}</div>
          : null}
        <div className={styles['actions']}>
          <button
            type="button"
            className="dsw-button dsw-button--primary"
            disabled={busy || !writable || route === 'headroom'}
            onClick={() => { void switchRoute('headroom') }}
          >
            {busy && route !== 'headroom' ? t('switching') : t('switchToHeadroom')}
          </button>
          <button
            type="button"
            className="dsw-button"
            disabled={busy || !writable || route === 'direct'}
            onClick={() => { void switchRoute('direct') }}
          >
            {busy && route !== 'direct' ? t('switching') : t('switchToDirect')}
          </button>
        </div>
        {done ? <div className={styles['row']}><span className={styles['value']}>{t('switched')}</span></div> : null}
        {error !== null ? <div className={styles['warning']}>{t('error').replace('{message}', error)}</div> : null}
      </div>
      <div className={styles['card']}>
        <div className={styles['row']}>
          <span className={styles['label']}>{t('lifecycle')}</span>
        </div>
        <div className={styles['actions']}>
          <button
            type="button"
            className="dsw-button"
            disabled={opBusy !== null}
            onClick={() => { void runLifecycle('/headroom-install', t('installing')) }}
          >
            {opBusy === t('installing') ? t('installing') : t('install')}
          </button>
          <button
            type="button"
            className="dsw-button dsw-button--primary"
            disabled={opBusy !== null}
            onClick={() => { void runLifecycle('/headroom-start', t('starting')) }}
          >
            {opBusy === t('starting') ? t('starting') : t('start')}
          </button>
          <button
            type="button"
            className="dsw-button"
            disabled={opBusy !== null}
            onClick={() => { void runLifecycle('/headroom-stop', t('stopping')) }}
          >
            {opBusy === t('stopping') ? t('stopping') : t('stop')}
          </button>
        </div>
        {opResult !== null
          ? <div className={opResult.kind === 'error' ? styles['warning'] : styles['row']}>
            <span className={styles['value']}>{opResult.text}</span>
          </div>
          : null}
        {opBusy !== null ? <div className={styles['row']}><span className={styles['value']}>{opBusy}</span></div> : null}
      </div>
      <div className={styles['notes']}>
        <span className={styles['notesTitle']}>{t('notes')}</span>
        <span>• {t('noteSource')}</span>
        <span>• {t('noteCache')}</span>
        <span>• {t('noteQuality')}</span>
        <span>• {t('noteFallback')}</span>
      </div>
    </section>
  )
}
