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
import type { ReactNode } from 'react';
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client';
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react';
import type { en } from './locales.ts';
/** The narrowed `llm-deepseek` section this page reads and writes. */
export interface DeepSeekRouteSettings {
    /** The configured endpoint override; undefined means the composition default. */
    baseURL?: string;
}
/** Injected dependencies of {@link HeadroomPanel}. */
export interface HeadroomPanelInjected {
    /** Hot-reloaded `llm-deepseek` namespace scope. */
    scope: SettingsScope<DeepSeekRouteSettings>;
    /** uSES hook bound to the scope snapshot. */
    useSnapshot: SnapshotSelectorHook<SettingsScopeSnapshot<DeepSeekRouteSettings>>;
    /** Panel copy. */
    t: (key: keyof typeof en) => string;
}
/** Props delivered by the slot outlet (inject face spread flat). */
export type HeadroomPanelProps = Partial<HeadroomPanelInjected>;
/**
 * Render the Headroom control panel: current route, proxy health, route
 * toggle, and the safety notes. All writes go through the settings scope; the
 * panel re-renders from the next snapshot.
 * @param props - the inject face (scope, snapshot hook, copy).
 * @returns the panel content.
 */
export declare function HeadroomPanel(props: HeadroomPanelProps): ReactNode;
