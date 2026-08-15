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
import {
  EMPTY_STATS, fetchHeadroomStats, formatTokens, formatUsd, formatCny,
  hasPriceTable, isPeakHour, estimateSpend, DEEPSEEK_V4_FLASH_PRICES,
} from './stats.ts'
import type { HeadroomStatsView, PriceTable } from './stats.ts'
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
  /** Price-table configuration scope (this plugin's own namespace). */
  priceScope: SettingsScope<{ priceTable?: PriceTable }>
  /** uSES hook bound to the price scope. */
  usePriceSnapshot: SnapshotSelectorHook<SettingsScopeSnapshot<{ priceTable?: PriceTable }>>
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
 * A numeric price field (CNY per 1M tokens) with a blank-tolerant local state.
 */
function PriceField(props: { label: string; value: number | undefined; onChange: (v: number | undefined) => void }): ReactNode {
  const [text, setText] = useState(props.value === undefined ? '' : String(props.value))
  return (
    <label className={styles['priceField']}>
      <span className={styles['statLabel']}>{props.label}</span>
      <input
        className={styles['input']}
        type="number"
        min="0"
        step="0.01"
        value={text}
        placeholder="—"
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          const parsed = Number(raw)
          props.onChange(raw === '' || Number.isNaN(parsed) ? undefined : parsed)
        }}
      />
    </label>
  )
}

/**
 * Render the Headroom control panel: current route, proxy health, route
 * toggle, and the safety notes. All writes go through the settings scope; the
 * panel re-renders from the next snapshot.
 * @param props - the inject face (scope, snapshot hook, copy).
 * @returns the panel content.
 */
export function HeadroomPanel(props: HeadroomPanelProps): ReactNode {
  const { scope, useSnapshot, priceScope, usePriceSnapshot, t, runCommand } = props
  if (scope === undefined || useSnapshot === undefined || t === undefined) return null
  const snapshot = useSnapshot((s) => s)
  const priceSnapshot = usePriceSnapshot?.((s) => s)
  const priceTable = priceSnapshot?.value?.priceTable
  const baseURL = snapshot.value?.baseURL
  const writable = snapshot.writable === true
  const route = routeOf(baseURL)
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [opBusy, setOpBusy] = useState<string | null>(null)
  const [opResult, setOpResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [stats, setStats] = useState<HeadroomStatsView>(EMPTY_STATS)

  useEffect(() => {
    if (route !== 'headroom' || probe.kind !== 'idle') return
    setProbe({ kind: 'probing' })
    void probeHeadroom().then(setProbe)
  }, [route, probe.kind])

  // Live stats: poll Headroom /stats every 10s while the panel is mounted.
  useEffect(() => {
    let alive = true
    const refresh = async (): Promise<void> => {
      const next = await fetchHeadroomStats()
      if (alive) setStats(next)
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 10_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

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
      <div className={styles['statsCard']}>
        <div className={styles['statsTitle']}>{t('statsTitle')}</div>
        {route === 'direct'
          ? <div className={styles['statsWarn']}>{t('statsFrozenDirect')}</div>
          : null}
        <div className={styles['statsGrid']}>
          <div className={styles['statCell']}>
            <span className={styles['statValue']}>{formatTokens(stats.inputTokens)}</span>
            <span className={styles['statLabel']}>{t('stat60min')}</span>
          </div>
          <div className={styles['statCell']}>
            <span className={styles['statValue']}>{formatTokens(stats.tokensSaved)}</span>
            <span className={styles['statLabel']}>{t('statSavedTotal')}</span>
          </div>
          <div className={styles['statCell']}>
            <span className={styles['statValue']}>{formatTokens(stats.lifetimeInputTokens)}</span>
            <span className={styles['statLabel']}>{t('statLifetimeInput')}</span>
          </div>
          <div className={styles['statCell']}>
            <span className={styles['statValue']}>{stats.cacheHitRate > 0 ? `${stats.cacheHitRate.toFixed(1)}%` : '—'}</span>
            <span className={styles['statLabel']}>{t('statCacheHit')}</span>
          </div>
          <div className={styles['statCell']}>
            <span className={styles['statValue']}>{stats.requests > 0 ? String(stats.requests) : '—'}</span>
            <span className={styles['statLabel']}>{t('statRequests')}</span>
          </div>
        </div>
        {hasPriceTable(priceTable)
          ? (
            <div className={styles['moneyRow']}>
              <span className={styles['statValue']}>
                {formatCny(estimateSpend(stats.inputTokens, 0, stats.cacheHitRate / 100, priceTable, isPeakHour()))}
              </span>
              <span className={styles['statLabel']}>
                {t('stat60minMoney')}{isPeakHour() ? `（${t('peak')}）` : `（${t('offPeak')}）`}
              </span>
            </div>
          )
          : <span className={styles['statsNote']}>{t('statsNoPrice')}</span>}
        {stats.ok
          ? <span className={styles['statsNote']}>{t('statsNote')}</span>
          : <span className={styles['statsWarn']}>{t('statsUnavailable')}</span>}
      </div>
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
      <div className={styles['card']}>
        <div className={styles['row']}>
          <span className={styles['label']}>{t('priceTitle')}</span>
          <button
            type="button"
            className="dsw-button"
            onClick={() => {
              if (hasPriceTable(priceTable)) { void priceScope?.unset('priceTable') }
              else { void priceScope?.set('priceTable', DEEPSEEK_V4_FLASH_PRICES) }
            }}
          >
            {hasPriceTable(priceTable) ? t('priceDisable') : t('priceEnable')}
          </button>
        </div>
        {hasPriceTable(priceTable)
          ? (
            <div className={styles['priceGrid']}>
              <PriceField label={t('priceHitPeak')} value={priceTable.hitPeak} onChange={(v) => { void priceScope?.set('priceTable', { ...priceTable, hitPeak: v }) }} />
              <PriceField label={t('priceHitOff')} value={priceTable.hitOffPeak} onChange={(v) => { void priceScope?.set('priceTable', { ...priceTable, hitOffPeak: v }) }} />
              <PriceField label={t('priceMissPeak')} value={priceTable.missPeak} onChange={(v) => { void priceScope?.set('priceTable', { ...priceTable, missPeak: v }) }} />
              <PriceField label={t('priceMissOff')} value={priceTable.missOffPeak} onChange={(v) => { void priceScope?.set('priceTable', { ...priceTable, missOffPeak: v }) }} />
              <PriceField label={t('priceOutPeak')} value={priceTable.outputPeak} onChange={(v) => { void priceScope?.set('priceTable', { ...priceTable, outputPeak: v }) }} />
              <PriceField label={t('priceOutOff')} value={priceTable.outputOffPeak} onChange={(v) => { void priceScope?.set('priceTable', { ...priceTable, outputOffPeak: v }) }} />
            </div>
          )
          : <span className={styles['statsNote']}>{t('priceHint')}</span>}
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
