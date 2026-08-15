/**
 * Headroom stats types, fetch helper, and user-configurable price model.
 *
 * The proxy exposes a rich /stats endpoint (no auth, loopback CORS). This
 * module extracts the lifetime + display-session numbers the panel renders,
 * and computes USD estimates from a user-supplied price table (peak/off-peak,
 * mirroring DeepSeek's 2026-08-17 peak pricing). Without a configured price
 * table the panel shows tokens only — no money.
 */

/** The persistent lifetime summary Headroom keeps in proxy_savings.json. */
export interface HeadroomLifetimeStats {
  requests: number
  tokens_saved: number
  compression_savings_usd: number
  cache_read_tokens: number
  cache_savings_usd: number
  total_input_tokens: number
  total_input_cost_usd: number
  output_tokens_saved: number
  output_savings_usd: number
}

/** The /stats payload slice the panel consumes. */
export interface HeadroomStatsResponse {
  persistent_savings?: {
    lifetime?: HeadroomLifetimeStats
    display_session?: HeadroomLifetimeStats
  }
  cost?: {
    total_input_cost_usd?: number
    savings_usd?: number
    compression_savings_usd?: number
    cache_savings_usd?: number
  }
  prefix_cache?: {
    totals?: {
      cache_read_tokens?: number
      hit_rate?: number
    }
  }
}

/** Panel-facing numbers with fallbacks when the endpoint is unreachable. */
export interface HeadroomStatsView {
  /** Input tokens billed in the rolling 60-minute display session. */
  inputTokens: number
  /** Tokens removed by compression (lifetime). */
  tokensSaved: number
  /** Total input tokens (lifetime). */
  lifetimeInputTokens: number
  /** Provider prefix-cache discount in USD (lifetime) — NOT Headroom's doing. */
  cacheDiscountUsd: number
  /** Prefix cache hit rate (0-100). */
  cacheHitRate: number
  /** Cache read tokens (lifetime). */
  cacheReadTokens: number
  /** Total requests (lifetime). */
  requests: number
  /** Whether the fetch succeeded. */
  ok: boolean
}

/** Defaults before the first successful fetch. */
export const EMPTY_STATS: HeadroomStatsView = {
  inputTokens: 0,
  tokensSaved: 0,
  lifetimeInputTokens: 0,
  cacheDiscountUsd: 0,
  cacheHitRate: 0,
  cacheReadTokens: 0,
  requests: 0,
  ok: false,
}

/**
 * User-configurable price table, in CNY per 1M tokens. Mirrors DeepSeek's
 * peak/off-peak pricing (peak: Beijing 09:00-12:00, 14:00-18:00). All fields
 * are optional; a missing field falls back to its off-peak counterpart, and
 * a fully empty table disables money display.
 */
export interface PriceTable {
  /** Input cache-hit price (CNY/M), peak. */
  hitPeak?: number
  /** Input cache-hit price (CNY/M), off-peak. */
  hitOffPeak?: number
  /** Input cache-miss price (CNY/M), peak. */
  missPeak?: number
  /** Input cache-miss price (CNY/M), off-peak. */
  missOffPeak?: number
  /** Output price (CNY/M), peak. */
  outputPeak?: number
  /** Output price (CNY/M), off-peak. */
  outputOffPeak?: number
}

/** Official DeepSeek V4-Flash prices (CNY/M) as the default table. */
export const DEEPSEEK_V4_FLASH_PRICES: PriceTable = {
  hitPeak: 0.10,
  hitOffPeak: 0.05,
  missPeak: 3.0,
  missOffPeak: 1.5,
  outputPeak: 9.0,
  outputOffPeak: 4.5,
}

/** Whether any money-relevant price is configured. */
export function hasPriceTable(table: PriceTable | undefined): table is PriceTable {
  if (table === undefined) return false
  return [table.hitPeak, table.hitOffPeak, table.missPeak, table.missOffPeak, table.outputPeak, table.outputOffPeak]
    .some((v) => typeof v === 'number' && v >= 0)
}

/** Whether `now` (local time) falls in DeepSeek's peak window (Beijing 9-12 / 14-18). */
export function isPeakHour(now: Date = new Date()): boolean {
  const hour = now.getHours()
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

/** A price lookup that falls back peak<->off-peak and then to a default. */
function priceOf(value: number | undefined, fallback: number | undefined, defaultPrice: number): number {
  if (typeof value === 'number' && value >= 0) return value
  if (typeof fallback === 'number' && fallback >= 0) return fallback
  return defaultPrice
}

/**
 * Estimate the spend of a token mix under a price table at the current peak
 * status. The mix is a rough split: input tokens are assumed to be mostly
 * cache-hits (the observed hit rate is high), so the estimate is labelled as
 * such in the UI.
 * @param inputTokens - total input tokens.
 * @param outputTokens - total output tokens (0 if unknown).
 * @param hitRate - observed cache hit rate (0-1).
 * @param table - user price table.
 * @param peak - whether the current local hour is peak.
 * @returns estimated spend in CNY.
 */
export function estimateSpend(
  inputTokens: number,
  outputTokens: number,
  hitRate: number,
  table: PriceTable,
  peak: boolean,
): number {
  const hit = inputTokens * (hitRate > 0 ? Math.min(hitRate, 1) : 0)
  const miss = inputTokens - hit
  const hitPrice = peak ? priceOf(table.hitPeak, table.hitOffPeak, 0.05) : priceOf(table.hitOffPeak, table.hitPeak, 0.05)
  const missPrice = peak ? priceOf(table.missPeak, table.missOffPeak, 1.5) : priceOf(table.missOffPeak, table.missPeak, 1.5)
  const outPrice = peak ? priceOf(table.outputPeak, table.outputOffPeak, 4.5) : priceOf(table.outputOffPeak, table.outputPeak, 4.5)
  return (hit / 1_000_000) * hitPrice + (miss / 1_000_000) * missPrice + (outputTokens / 1_000_000) * outPrice
}

/**
 * Fetch Headroom /stats and project the panel numbers. A failure returns the
 * empty view with ok=false so the UI can degrade gracefully.
 * @param base - Headroom origin (defaults to the loopback proxy).
 * @returns the projected stats view.
 */
export async function fetchHeadroomStats(base = 'http://127.0.0.1:8787'): Promise<HeadroomStatsView> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    try {
      const response = await fetch(`${base}/stats`, { signal: controller.signal })
      if (!response.ok) return EMPTY_STATS
      const body = (await response.json()) as HeadroomStatsResponse
      const lifetime = body.persistent_savings?.lifetime
      const session = body.persistent_savings?.display_session
      const cache = body.prefix_cache?.totals
      return {
        // display_session is Headroom's rolling 60-minute activity window.
        inputTokens: session?.total_input_tokens ?? lifetime?.total_input_tokens ?? 0,
        tokensSaved: lifetime?.tokens_saved ?? 0,
        lifetimeInputTokens: lifetime?.total_input_tokens ?? 0,
        cacheDiscountUsd: lifetime?.cache_savings_usd ?? 0,
        cacheHitRate: cache?.hit_rate ?? 0,
        cacheReadTokens: cache?.cache_read_tokens ?? lifetime?.cache_read_tokens ?? 0,
        requests: lifetime?.requests ?? 0,
        ok: true,
      }
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return EMPTY_STATS
  }
}

/** Format a token count compactly: 1.2M / 345K / 12. */
export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(Math.round(value))
}

/** Format a USD amount: $1.23 / $0.0123. */
export function formatUsd(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.01) return `$${value.toFixed(3)}`
  return `$${value.toFixed(4)}`
}

/** Format a CNY amount: ¥1.23 / ¥0.0123. */
export function formatCny(value: number): string {
  if (value >= 1) return `¥${value.toFixed(2)}`
  if (value >= 0.01) return `¥${value.toFixed(3)}`
  return `¥${value.toFixed(4)}`
}
