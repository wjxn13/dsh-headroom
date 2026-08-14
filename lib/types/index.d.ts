/**
 * dsh-headroom host half: manages the Headroom compression proxy lifecycle.
 *
 * Responsibilities:
 *  - detect a usable Python interpreter and an existing Headroom install
 *  - create an isolated venv and install `headroom-ai[proxy]` on first use
 *  - spawn `headroom proxy` with the DeepSeek compatibility presets
 *  - probe /livez, surface status, and expose start/stop/status operations
 *    to the browser half through a tiny command seam (settings-backed).
 *
 * This plugin only *integrates* Headroom — it does not reimplement the
 * compression engine. See NOTICE for the upstream attribution.
 */
import type { Context } from '@deepseek-ai/cordis';
export { DEEPSEEK_ANTHROPIC_URL, DEEPSEEK_OPENAI_URL, DIRECT_BASE_URL, HEADROOM_BASE_URL, HEADROOM_LIVEZ_URL, HEADROOM_PORT, LLM_DEEPSEEK_NAMESPACE, PLUGIN_NAME } from './constants.ts';
/** Whether a headroom proxy is currently answering on the port. */
export declare function probeHealth(timeoutMs?: number): Promise<{
    healthy: boolean;
    version?: string;
}>;
/**
 * Ensure a plugin-managed venv with `headroom-ai[proxy]` installed.
 * Reuses an existing venv; otherwise creates one and installs (this is the
 * heavy first-use step). Returns a human-readable outcome.
 */
export declare function ensureInstalled(log: (message: string) => void): Promise<{
    ok: boolean;
    message: string;
}>;
/**
 * Start the Headroom proxy detached from this process, with the DeepSeek
 * compatibility presets. Returns the spawn outcome (the proxy needs a few
 * seconds to become healthy).
 */
export declare function startProxy(log: (message: string) => void): Promise<{
    ok: boolean;
    message: string;
}>;
/** Stop any headroom proxy listening on the plugin port (best-effort). */
export declare function stopProxy(log: (message: string) => void): Promise<{
    ok: boolean;
    message: string;
}>;
/**
 * cordis entry. The host half registers plugin metadata; the browser half
 * drives the UI. All heavy work is exposed as exported functions so tests and
 * CLI users can call them directly.
 */
export declare function apply(_ctx: Context): void;
