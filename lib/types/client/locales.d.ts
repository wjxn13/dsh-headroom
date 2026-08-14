/**
 * dsh-headroom copy dictionaries (zh + en). The panel is a settings page, so
 * its strings live in one namespace owned by this plugin.
 */
export declare const zh: {
    readonly nav: '线路切换';
    readonly title: 'Headroom 压缩线路';
    readonly description: '在直连与 Headroom 压缩代理之间一键切换。切换热生效，下一次请求即走新线路。';
    readonly current: '当前线路';
    readonly routeDirect: '直连（api.deepseek.com）';
    readonly routeHeadroom: '压缩（Headroom :8787）';
    readonly routeUnknown: '未知（baseURL 未识别）';
    readonly headroomStatus: 'Headroom 状态';
    readonly headroomHealthy: '健康（v{version}）';
    readonly headroomDown: '不可达';
    readonly headroomProbing: '探测中…';
    readonly switchToHeadroom: '切换到压缩线路';
    readonly switchToDirect: '切回直连';
    readonly switching: '切换中…';
    readonly switched: '已切换';
    readonly error: '操作失败：{message}';
    readonly headroomDownWarning: 'Headroom 当前不可达。切换后请求会失败，DSH 会自动重试；请先启动 Headroom。';
    readonly notes: '说明';
    readonly noteSource: '压缩引擎为 Headroom（headroomlabs-ai/headroom，Apache 2.0），本插件仅负责集成与管理。';
    readonly noteCache: 'Headroom 的改写是确定性的，前缀缓存命中率不受影响（实测 97.6%+）。';
    readonly noteQuality: '压缩只作用于工具描述等非关键内容，对话与工具结果不受影响。';
    readonly noteFallback: '线路故障时可在此页一键切回直连，无需重启。';
};
export declare const en: {
    readonly nav: 'Route Switch';
    readonly title: 'Headroom Compression Route';
    readonly description: 'Toggle between direct DeepSeek and the Headroom compression proxy with one click. The change applies to the next request.';
    readonly current: 'Current route';
    readonly routeDirect: 'Direct (api.deepseek.com)';
    readonly routeHeadroom: 'Compressed (Headroom :8787)';
    readonly routeUnknown: 'Unknown baseURL';
    readonly headroomStatus: 'Headroom status';
    readonly headroomHealthy: 'Healthy (v{version})';
    readonly headroomDown: 'Unreachable';
    readonly headroomProbing: 'Probing…';
    readonly switchToHeadroom: 'Switch to compressed';
    readonly switchToDirect: 'Switch to direct';
    readonly switching: 'Switching…';
    readonly switched: 'Switched';
    readonly error: 'Operation failed: {message}';
    readonly headroomDownWarning: 'Headroom is unreachable. Requests will fail and DSH will retry; start Headroom first.';
    readonly notes: 'Notes';
    readonly noteSource: 'Compression engine: Headroom (headroomlabs-ai/headroom, Apache-2.0). This plugin only integrates and manages it.';
    readonly noteCache: 'Headroom rewrites are deterministic; prefix cache hit rate is unaffected (measured 97.6%+).';
    readonly noteQuality: 'Compression only touches tool descriptions, never conversation or tool results.';
    readonly noteFallback: 'If the route fails, switch back here with one click. No restart needed.';
};
export type HeadroomPanelKey = keyof typeof zh;
