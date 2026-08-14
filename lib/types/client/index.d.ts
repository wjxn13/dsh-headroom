/**
 * dsh-headroom browser half entry: registers the "线路切换" settings section.
 * The section binds the `llm-deepseek` namespace through the settings scope
 * service and writes `baseURL` (or unsets it to revert to the composition
 * default) — the same hot-reloaded field the dsh-llm-deepseek adapter reads
 * per request.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type HeadroomPanelKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The Headroom route panel copy. */
        'dsh-headroom': HeadroomPanelKey;
    }
}
/**
 * Required services (cordis fiber inject). The `settings.section` declaration
 * lives in ui-settings-general's SettingsRoot entry; registration waits on it
 * through `slots.inject()`. `settingsScope` supplies the hot-reloaded
 * `llm-deepseek` namespace scope.
 */
export declare const inject: string[];
/**
 * Register the Headroom panel once the `settings.section` declaration is on
 * the ledger, binding the `llm-deepseek` namespace scope for the page.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
