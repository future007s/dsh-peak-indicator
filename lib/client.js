// dsh-peak-indicator client bundle (hand-built ModuleLoader format, mirrors the
// output shape of the other dsh web plugins). Shows a badge in the conversation
// session header marking whether the DeepSeek API is currently in its peak
// (高峰) or off-peak / half-price (闲时) billing window. Policy per the official
// DeepSeek peak/off-peak pricing scheme effective 2026-08-17 00:00 Beijing time:
//   peak    = Beijing 09:00-12:00 and 14:00-18:00
//   offpeak = every other minute, billed at half the peak price
window.__ModuleLoader__.load({
  id: "dsh-peak-indicator",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
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
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

    //#region src/client.js
    var client_exports = {};
    __export(client_exports, {
      NS: () => NS,
      PeakBadge: () => PeakBadge,
      apply: () => apply,
      beijingMinutes: () => beijingMinutes,
      currentPeriod: () => currentPeriod,
      default: () => client_default,
      en: () => en,
      inject: () => inject,
      isDeepseekModel: () => isDeepseekModel,
      zh: () => zh
    });
    module.exports = __toCommonJS(client_exports);
    var import_react = __toESM(require("react"), 1);
    var NS = "peakIndicator";
    var zh = {
      "badge.peak": "\u26A1 \u9AD8\u5CF0",
      "badge.offpeak": "\u{1F319} \u95F2\u65F6 \u00B7 \u534A\u4EF7",
      "tip.peak": "DeepSeek \u9AD8\u5CF0\u65F6\u6BB5\uFF08\u5317\u4EAC\u65F6\u95F4 09:00\u201312:00\u300114:00\u201318:00\uFF09\uFF0CAPI \u6309\u539F\u4EF7\u8BA1\u8D39",
      "tip.offpeak": "DeepSeek \u95F2\u65F6\uFF08\u9AD8\u5CF0\u4EE5\u5916\u65F6\u6BB5\uFF09\uFF0CAPI \u4EF7\u683C\u4E3A\u9AD8\u5CF0\u7684\u4E00\u534A",
      "tip.now": "\u5F53\u524D\u5317\u4EAC\u65F6\u95F4 {time}",
      "tip.next": "{countdown} \u540E\u5207\u6362\u8BA1\u4EF7\u65F6\u6BB5"
    };
    var en = {
      "badge.peak": "\u26A1 Peak",
      "badge.offpeak": "\u{1F319} Off-peak \u00B7 50%",
      "tip.peak": "DeepSeek peak hours (Beijing 09:00\u201312:00, 14:00\u201318:00); API billed at list price",
      "tip.offpeak": "DeepSeek off-peak (outside peak hours); API billed at half the peak price",
      "tip.now": "Beijing time {time}",
      "tip.next": "billing window switches in {countdown}"
    };

    /** Peak windows, Beijing hours (start inclusive, end exclusive). */
    var PEAK_WINDOWS = [[9, 12], [14, 18]];
    /** Beijing is UTC+8, no DST. */
    var BEIJING_OFFSET_MINUTES = 8 * 60;

    /**
     * Whether the peak/off-peak scheme applies to the given selection: only
     * DeepSeek flash/pro models are billed under the DeepSeek peak/off-peak
     * pricing, so the badge stays hidden for every other model.
     */
    function isDeepseekModel(provider, model) {
      const p = String(provider ?? "").toLowerCase();
      const m = String(model ?? "").toLowerCase();
      return p.includes("deepseek") && (m.includes("flash") || m.includes("pro"));
    }

    /** Minutes since Beijing midnight for `now`. */
    function beijingMinutes(now) {
      return (now.getUTCHours() * 60 + now.getUTCMinutes() + BEIJING_OFFSET_MINUTES) % 1440;
    }

    /** Current billing period: "peak" | "offpeak". */
    function currentPeriod(now) {
      const bj = beijingMinutes(now ?? new Date());
      return PEAK_WINDOWS.some(([startHour, endHour]) => bj >= startHour * 60 && bj < endHour * 60) ? "peak" : "offpeak";
    }

    /** Minutes until the next peak/off-peak transition (1..1440). */
    function nextTransitionInMinutes(now) {
      const bj = beijingMinutes(now ?? new Date());
      const boundaries = [];
      for (const [startHour, endHour] of PEAK_WINDOWS) boundaries.push(startHour * 60, endHour * 60);
      boundaries.sort((a, b) => a - b);
      for (const boundary of boundaries) if (boundary > bj) return boundary - bj;
      return 1440 - bj + boundaries[0];
    }

    /** Beijing wall clock "HH:MM" for `now`. */
    function formatBeijingClock(now) {
      const bj = beijingMinutes(now);
      return `${String(Math.floor(bj / 60)).padStart(2, "0")}:${String(bj % 60).padStart(2, "0")}`;
    }

    /** Human countdown like "1 小时 12 分钟". */
    function formatCountdown(minutes) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return hours === 0 ? `${rest} 分钟` : `${hours} 小时 ${rest} 分钟`;
    }

    /**
     * The peak/off-peak badge rendered into the conversation session header.
     * Only visible while the session's current model is a DeepSeek flash/pro
     * model; recomputes the billing period every 30 seconds so the marker
     * flips at window boundaries.
     */
    function PeakBadge({ t, directory, load }) {
      if (!directory) return null;
      const state = import_react.default.useSyncExternalStore(
        (fn) => directory.subscribe(fn),
        () => directory.getSnapshot()
      );
      const [period, setPeriod] = import_react.default.useState(() => currentPeriod(new Date()));
      import_react.default.useEffect(() => {
        if (typeof load === "function") load();
        const id = setInterval(() => setPeriod(currentPeriod(new Date())), 30000);
        return () => clearInterval(id);
      }, []);
      const current = state?.current;
      if (!isDeepseekModel(current?.provider, current?.model)) return null;
      const tip = `${t("tip." + period)} \u00B7 ${t("tip.now", { time: formatBeijingClock(new Date()) })} \u00B7 ${t("tip.next", { countdown: formatCountdown(nextTransitionInMinutes(new Date())) })}`;
      return import_react.default.createElement("span", {
        title: tip,
        style: {
          whiteSpace: "nowrap",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: "18px",
          padding: "1px 8px",
          borderRadius: 999,
          color: period === "peak" ? "#ffffff" : "#0f7b3d",
          background: period === "peak" ? "#e5484d" : "#d9f2e2",
          border: period === "peak" ? "1px solid #e5484d" : "1px solid #7fd6a8",
          cursor: "help",
          fontVariantNumeric: "tabular-nums"
        }
      }, t("badge." + period));
    }

    var inject = ["slots", "locale", "modelDirectories"];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "peak-indicator: dictionaries");
      ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
        name: "conversation.session.header.actions",
        id: "peak-indicator",
        order: 20,
        locale: NS,
        inject: (sessionId) => {
          try {
            const directory = ctx.modelDirectories.directoryFor(sessionId);
            return {
              directory: directory.store,
              load: () => directory.load().catch(() => {})
            };
          } catch {
            return { directory: null };
          }
        }
      }, PeakBadge));
    }
    var client_default = { apply, inject };
    //#endregion

    return module.exports;
  }
});
