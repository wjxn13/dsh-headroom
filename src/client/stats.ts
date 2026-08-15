/**
 * Headroom stats types and fetch helper.
 *
 * The proxy exposes a rich /stats endpoint (no auth, loopback CORS). This
 * module extracts the lifetime + display-session token numbers the panel
 * renders. Money display was removed: Headroom's hit_rate is request-level
 * (not token-level) and its token split does not match DeepSeek billing, so
 * any USD/CNY estimate was misleading (see commit history).
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
  /** Tokens removed by compression in the rolling 60-min window. */
  sessionSavedTokens: number
  /** Total input tokens (lifetime). */
  lifetimeInputTokens: number
  /** Prefix cache hit rate (0-100). */
  cacheHitRate: number
  /** Total requests (lifetime). */
  requests: number
  /** Whether the fetch succeeded. */
  ok: boolean
}

/** Defaults before the first successful fetch. */
export const EMPTY_STATS: HeadroomStatsView = {
  inputTokens: 0,
  tokensSaved: 0,
  sessionSavedTokens: 0,
  lifetimeInputTokens: 0,
  cacheHitRate: 0,
  requests: 0,
  ok: false,
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
        sessionSavedTokens: session?.tokens_saved ?? 0,
        lifetimeInputTokens: lifetime?.total_input_tokens ?? 0,
        cacheHitRate: cache?.hit_rate ?? 0,
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