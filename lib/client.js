window.__ModuleLoader__.load({ id: "@dsh-external/dsh-headroom", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_dsh_client_web_react = require("@deepseek-ai/dsh-client-web-react");

// src/client/HeadroomPanel.tsx
var import_react = require("react");

// src/constants.ts
var HEADROOM_PORT = 8787;
var HEADROOM_BASE_URL = `http://127.0.0.1:${HEADROOM_PORT}/v1`;
var DIRECT_BASE_URL = "https://api.deepseek.com";
var LLM_DEEPSEEK_NAMESPACE = "llm-deepseek";
var HEADROOM_LIVEZ_URL = `http://127.0.0.1:${HEADROOM_PORT}/livez`;

// src/client/HeadroomPanel.module.css
var css = ".section_wl13vp {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n}\n\n.card_1tafk {\n  border: 1px solid var(--dsw-color-border-strong, #d0d7de);\n  border-radius: 8px;\n  padding: 16px;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.row_2fa2 {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.label_1p5sz8 {\n  font-size: 13px;\n  color: var(--dsw-color-text-secondary, #57606a);\n}\n\n.value_1unypd {\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-color-text-primary, #1f2328);\n}\n\n.badge_1jnwkj {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  padding: 2px 10px;\n  border-radius: 999px;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.badgeHealthy_1yuqcmy {\n  background: var(--dsw-color-success-bg, #dafbe1);\n  color: var(--dsw-color-success-fg, #1a7f37);\n}\n\n.badgeDown_yxl97p {\n  background: var(--dsw-color-danger-bg, #ffebe9);\n  color: var(--dsw-color-danger-fg, #cf222e);\n}\n\n.badgeProbing_1gks40a {\n  background: var(--dsw-color-neutral-bg, #f6f8fa);\n  color: var(--dsw-color-text-secondary, #57606a);\n}\n\n.actions_1ftekn1 {\n  display: flex;\n  gap: 8px;\n  margin-top: 4px;\n}\n\n.warning_ilgs64 {\n  font-size: 12px;\n  color: var(--dsw-color-danger-fg, #cf222e);\n  background: var(--dsw-color-danger-bg, #ffebe9);\n  border-radius: 6px;\n  padding: 8px 12px;\n}\n\n.notes_1qipc1 {\n  font-size: 12px;\n  color: var(--dsw-color-text-secondary, #57606a);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding-left: 16px;\n}\n\n.notesTitle_1xoosuv {\n  font-weight: 600;\n  color: var(--dsw-color-text-primary, #1f2328);\n  margin-bottom: 4px;\n}\n";
var tagId = "@dsh-external/dsh-headroom/HeadroomPanel.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "@dsh-external/dsh-headroom";
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}
var HeadroomPanel_default = { "section": "section_wl13vp", "card": "card_1tafk", "row": "row_2fa2", "label": "label_1p5sz8", "value": "value_1unypd", "badge": "badge_1jnwkj", "badgeHealthy": "badgeHealthy_1yuqcmy", "badgeDown": "badgeDown_yxl97p", "badgeProbing": "badgeProbing_1gks40a", "actions": "actions_1ftekn1", "warning": "warning_ilgs64", "notes": "notes_1qipc1", "notesTitle": "notesTitle_1xoosuv" };

// src/client/HeadroomPanel.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function routeOf(baseURL) {
  if (baseURL === void 0 || baseURL === DIRECT_BASE_URL) return "direct";
  if (baseURL === HEADROOM_BASE_URL) return "headroom";
  return "unknown";
}
async function probeHeadroom() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3e3);
    try {
      const response = await fetch(HEADROOM_LIVEZ_URL, { signal: controller.signal });
      if (!response.ok) return { kind: "down" };
      const body = await response.json();
      return { kind: "healthy", version: typeof body.version === "string" ? body.version : "?" };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { kind: "down" };
  }
}
function HeadroomPanel(props) {
  const { scope, useSnapshot, t } = props;
  if (scope === void 0 || useSnapshot === void 0 || t === void 0) return null;
  const snapshot = useSnapshot((s) => s);
  const baseURL = snapshot.value?.baseURL;
  const writable = snapshot.writable === true;
  const route = routeOf(baseURL);
  const [probe, setProbe] = (0, import_react.useState)({ kind: "idle" });
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [done, setDone] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    if (route !== "headroom" || probe.kind !== "idle") return;
    setProbe({ kind: "probing" });
    void probeHeadroom().then(setProbe);
  }, [route, probe.kind]);
  const switchRoute = async (target) => {
    if (!writable) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      if (target === "direct") await scope.unset("baseURL");
      else await scope.set("baseURL", HEADROOM_BASE_URL);
      setDone(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  const routeLabel = route === "direct" ? t("routeDirect") : route === "headroom" ? t("routeHeadroom") : t("routeUnknown");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: HeadroomPanel_default["section"], "aria-label": t("title"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: HeadroomPanel_default["card"], children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: HeadroomPanel_default["row"], children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: HeadroomPanel_default["label"], children: t("current") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: HeadroomPanel_default["value"], children: routeLabel })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: HeadroomPanel_default["row"], children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: HeadroomPanel_default["label"], children: t("headroomStatus") }),
        probe.kind === "healthy" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${HeadroomPanel_default["badge"]} ${HeadroomPanel_default["badgeHealthy"]}`, children: t("headroomHealthy").replace("{version}", probe.version) }) : probe.kind === "down" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${HeadroomPanel_default["badge"]} ${HeadroomPanel_default["badgeDown"]}`, children: t("headroomDown") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${HeadroomPanel_default["badge"]} ${HeadroomPanel_default["badgeProbing"]}`, children: t("headroomProbing") })
      ] }),
      probe.kind === "down" && route === "headroom" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: HeadroomPanel_default["warning"], children: t("headroomDownWarning") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: HeadroomPanel_default["actions"], children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "dsw-button dsw-button--primary",
            disabled: busy || !writable || route === "headroom",
            onClick: () => {
              void switchRoute("headroom");
            },
            children: busy && route !== "headroom" ? t("switching") : t("switchToHeadroom")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "dsw-button",
            disabled: busy || !writable || route === "direct",
            onClick: () => {
              void switchRoute("direct");
            },
            children: busy && route !== "direct" ? t("switching") : t("switchToDirect")
          }
        )
      ] }),
      done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: HeadroomPanel_default["row"], children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: HeadroomPanel_default["value"], children: t("switched") }) }) : null,
      error !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: HeadroomPanel_default["warning"], children: t("error").replace("{message}", error) }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: HeadroomPanel_default["notes"], children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: HeadroomPanel_default["notesTitle"], children: t("notes") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u2022 ",
        t("noteSource")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u2022 ",
        t("noteCache")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u2022 ",
        t("noteQuality")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u2022 ",
        t("noteFallback")
      ] })
    ] })
  ] });
}

// src/client/locales.ts
var zh = {
  "nav": "\u7EBF\u8DEF\u5207\u6362",
  "title": "Headroom \u538B\u7F29\u7EBF\u8DEF",
  "description": "\u5728\u76F4\u8FDE\u4E0E Headroom \u538B\u7F29\u4EE3\u7406\u4E4B\u95F4\u4E00\u952E\u5207\u6362\u3002\u5207\u6362\u70ED\u751F\u6548\uFF0C\u4E0B\u4E00\u6B21\u8BF7\u6C42\u5373\u8D70\u65B0\u7EBF\u8DEF\u3002",
  "current": "\u5F53\u524D\u7EBF\u8DEF",
  "routeDirect": "\u76F4\u8FDE\uFF08api.deepseek.com\uFF09",
  "routeHeadroom": "\u538B\u7F29\uFF08Headroom :8787\uFF09",
  "routeUnknown": "\u672A\u77E5\uFF08baseURL \u672A\u8BC6\u522B\uFF09",
  "headroomStatus": "Headroom \u72B6\u6001",
  "headroomHealthy": "\u5065\u5EB7\uFF08v{version}\uFF09",
  "headroomDown": "\u4E0D\u53EF\u8FBE",
  "headroomProbing": "\u63A2\u6D4B\u4E2D\u2026",
  "switchToHeadroom": "\u5207\u6362\u5230\u538B\u7F29\u7EBF\u8DEF",
  "switchToDirect": "\u5207\u56DE\u76F4\u8FDE",
  "switching": "\u5207\u6362\u4E2D\u2026",
  "switched": "\u5DF2\u5207\u6362",
  "error": "\u64CD\u4F5C\u5931\u8D25\uFF1A{message}",
  "headroomDownWarning": "Headroom \u5F53\u524D\u4E0D\u53EF\u8FBE\u3002\u5207\u6362\u540E\u8BF7\u6C42\u4F1A\u5931\u8D25\uFF0CDSH \u4F1A\u81EA\u52A8\u91CD\u8BD5\uFF1B\u8BF7\u5148\u542F\u52A8 Headroom\u3002",
  "notes": "\u8BF4\u660E",
  "noteSource": "\u538B\u7F29\u5F15\u64CE\u4E3A Headroom\uFF08headroomlabs-ai/headroom\uFF0CApache 2.0\uFF09\uFF0C\u672C\u63D2\u4EF6\u4EC5\u8D1F\u8D23\u96C6\u6210\u4E0E\u7BA1\u7406\u3002",
  "noteCache": "Headroom \u7684\u6539\u5199\u662F\u786E\u5B9A\u6027\u7684\uFF0C\u524D\u7F00\u7F13\u5B58\u547D\u4E2D\u7387\u4E0D\u53D7\u5F71\u54CD\uFF08\u5B9E\u6D4B 97.6%+\uFF09\u3002",
  "noteQuality": "\u538B\u7F29\u53EA\u4F5C\u7528\u4E8E\u5DE5\u5177\u63CF\u8FF0\u7B49\u975E\u5173\u952E\u5185\u5BB9\uFF0C\u5BF9\u8BDD\u4E0E\u5DE5\u5177\u7ED3\u679C\u4E0D\u53D7\u5F71\u54CD\u3002",
  "noteFallback": "\u7EBF\u8DEF\u6545\u969C\u65F6\u53EF\u5728\u6B64\u9875\u4E00\u952E\u5207\u56DE\u76F4\u8FDE\uFF0C\u65E0\u9700\u91CD\u542F\u3002"
};
var en = {
  "nav": "Route Switch",
  "title": "Headroom Compression Route",
  "description": "Toggle between direct DeepSeek and the Headroom compression proxy with one click. The change applies to the next request.",
  "current": "Current route",
  "routeDirect": "Direct (api.deepseek.com)",
  "routeHeadroom": "Compressed (Headroom :8787)",
  "routeUnknown": "Unknown baseURL",
  "headroomStatus": "Headroom status",
  "headroomHealthy": "Healthy (v{version})",
  "headroomDown": "Unreachable",
  "headroomProbing": "Probing\u2026",
  "switchToHeadroom": "Switch to compressed",
  "switchToDirect": "Switch to direct",
  "switching": "Switching\u2026",
  "switched": "Switched",
  "error": "Operation failed: {message}",
  "headroomDownWarning": "Headroom is unreachable. Requests will fail and DSH will retry; start Headroom first.",
  "notes": "Notes",
  "noteSource": "Compression engine: Headroom (headroomlabs-ai/headroom, Apache-2.0). This plugin only integrates and manages it.",
  "noteCache": "Headroom rewrites are deterministic; prefix cache hit rate is unaffected (measured 97.6%+).",
  "noteQuality": "Compression only touches tool descriptions, never conversation or tool results.",
  "noteFallback": "If the route fails, switch back here with one click. No restart needed."
};

// src/client/index.ts
var NS = "dsh-headroom";
var inject = ["slots", "locale", "connection", "remote", "settingsScope"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-headroom: copy dictionaries");
  const scope = ctx.settingsScope.bind({ namespace: LLM_DEEPSEEK_NAMESPACE });
  const useSnapshot = (0, import_dsh_client_web_react.bindSnapshotSelector)(scope);
  const t = ctx.locale.bind(NS);
  const injected = () => ({ scope, useSnapshot, t });
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "dsh-headroom",
    order: 20,
    label: () => t("nav"),
    inject: injected
  }, HeadroomPanel));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
