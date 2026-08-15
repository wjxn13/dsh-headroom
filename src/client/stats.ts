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
/**
 * One model's price set, in CNY per 1M tokens, for the peak and off-peak
 * windows. A missing field falls back to its off-peak counterpart.
 */
export interface ModelPrices {
  hitPeak?: number
  hitOffPeak?: number
  missPeak?: number
  missOffPeak?: number
  outputPeak?: number
  outputOffPeak?: number
}

/** One peak span: local hours (inclusive start, exclusive end). */
export interface PeakSpan {
  startHour: number
  endHour: number
}

/**
 * User-configurable peak windows. DeepSeek's official peak is TWO spans
 * (Beijing 09:00-12:00 and 14:00-18:00), so a single start/end would wrongly
 * mark the 12:00-14:00 gap as peak and overestimate spend. The UI edits the
 * span list; an empty list means "no peak" (all hours off-peak).
 */
export interface PeakWindow {
  spans: PeakSpan[]
}

/**
 * Full user price configuration: a price table per model id plus the peak
 * window definition. The default window mirrors DeepSeek's official peak
 * hours (Beijing 09:00-12:00, 14:00-18:00).
 */
export interface PriceTable {
  models: Record<string, ModelPrices>
  window: PeakWindow
}

/** Official DeepSeek peak/off-peak prices (CNY/M), effective 2026-08-17. */
export const DEEPSEEK_OFFICIAL_PRICES: Record<string, ModelPrices> = {
  'deepseek-v4-flash': {
    hitPeak: 0.10, hitOffPeak: 0.05,
    missPeak: 3.0, missOffPeak: 1.5,
    outputPeak: 9.0, outputOffPeak: 4.5,
  },
  'deepseek-v4-pro': {
    hitPeak: 0.30, hitOffPeak: 0.15,
    missPeak: 9.0, missOffPeak: 4.5,
    outputPeak: 27.0, outputOffPeak: 13.5,
  },
}

/** Default price table: official prices with the official peak window. */
export const DEFAULT_PRICE_TABLE: PriceTable = {
  models: DEEPSEEK_OFFICIAL_PRICES,
  window: { spans: [{ startHour: 9, endHour: 12 }, { startHour: 14, endHour: 18 }] }, // official Beijing peak
}

/** Whether any money-relevant price is configured. */
export function hasPriceTable(table: PriceTable | undefined): table is PriceTable {
  if (table === undefined) return false
  const models = table.models ?? {}
  return Object.values(models).some((m) =>
    [m.hitPeak, m.hitOffPeak, m.missPeak, m.missOffPeak, m.outputPeak, m.outputOffPeak]
      .some((v) => typeof v === 'number' && v >= 0),
  )
}

/**
 * Whether `now` (local time) falls in the user's peak window. The official
 * window is two spans (09-12 and 14-18); the config stores a single
 * start/end, and the UI offers the official two-span preset as the default.
 */
export function isPeakHour(window: PeakWindow | undefined, now: Date = new Date()): boolean {
  const spans = window?.spans
  if (spans === undefined || spans.length === 0) {
    // Fall back to the official two-span window when unconfigured.
    const hour = now.getHours()
    return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
  }
  const hour = now.getHours()
  return spans.some((span) => {
    const { startHour, endHour } = span
    if (startHour === endHour) return false
    if (startHour < endHour) return hour >= startHour && hour < endHour
    // Wraps midnight (e.g. 22:00 - 06:00).
    return hour >= startHour || hour < endHour
  })
}

/** A price lookup that falls back peak<->off-peak and then to a default. */
function priceOf(value: number | undefined, fallback: number | undefined, defaultPrice: number): number {
  if (typeof value === 'number' && value >= 0) return value
  if (typeof fallback === 'number' && fallback >= 0) return fallback
  return defaultPrice
}

/** Resolve the price set for a model id, falling back to the first model or a flash-like default. */
export function pricesForModel(table: PriceTable | undefined, modelId: string | undefined): ModelPrices {
  if (table !== undefined) {
    const byId = table.models?.[modelId ?? '']
    if (byId !== undefined) return byId
    const first = Object.values(table.models ?? {})[0]
    if (first !== undefined) return first
  }
  return DEEPSEEK_OFFICIAL_PRICES['deepseek-v4-flash'] ?? {}
}

/**
 * Estimate the spend of a token mix under a model's price set at the current
 * peak status. Input tokens are split by the observed cache hit rate.
 * @param inputTokens - total input tokens.
 * @param outputTokens - total output tokens (0 if unknown).
 * @param hitRate - observed cache hit rate (0-1).
 * @param prices - the model's price set.
 * @param peak - whether the current local hour is peak.
 * @returns estimated spend in CNY.
 */
export function estimateSpend(
  inputTokens: number,
  outputTokens: number,
  hitRate: number,
  prices: ModelPrices,
  peak: boolean,
): number {
  const hit = inputTokens * (hitRate > 0 ? Math.min(hitRate, 1) : 0)
  const miss = inputTokens - hit
  const hitPrice = peak ? priceOf(prices.hitPeak, prices.hitOffPeak, 0.05) : priceOf(prices.hitOffPeak, prices.hitPeak, 0.05)
  const missPrice = peak ? priceOf(prices.missPeak, prices.missOffPeak, 1.5) : priceOf(prices.missOffPeak, prices.missPeak, 1.5)
  const outPrice = peak ? priceOf(prices.outputPeak, prices.outputOffPeak, 4.5) : priceOf(prices.outputOffPeak, prices.outputPeak, 4.5)
  return (hit / 1_000_000) * hitPrice + (miss / 1_000_000) * missPrice + (outputTokens / 1_000_000) * outPrice
}

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
