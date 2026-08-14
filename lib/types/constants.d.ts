/**
 * Shared constants for the dsh-headroom plugin. Kept in a dedicated module so
 * the browser bundle can import the route values without dragging the host
 * half (node: imports) into the client graph.
 */
/** Plugin identity (also the settings namespace for plugin-owned config). */
export declare const PLUGIN_NAME = "dsh-headroom";
/** Headroom proxy port and the DeepSeek upstream it forwards to. */
export declare const HEADROOM_PORT = 8787;
export declare const DEEPSEEK_ANTHROPIC_URL = "https://api.deepseek.com/anthropic";
export declare const DEEPSEEK_OPENAI_URL = "https://api.deepseek.com";
/** The headroom baseURL the plugin writes into `llm-deepseek` settings. */
export declare const HEADROOM_BASE_URL = "http://127.0.0.1:8787/v1";
/** The DeepSeek public endpoint used when no base URL override is set. */
export declare const DIRECT_BASE_URL = "https://api.deepseek.com";
/** The settings namespace whose `baseURL` field selects the route. */
export declare const LLM_DEEPSEEK_NAMESPACE = "llm-deepseek";
/** Headroom health-check endpoint. */
export declare const HEADROOM_LIVEZ_URL = "http://127.0.0.1:8787/livez";
