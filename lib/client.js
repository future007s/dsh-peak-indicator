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
      TurnCost: () => TurnCost,
      apply: () => apply,
      beijingMinutes: () => beijingMinutes,
      currentPeriod: () => currentPeriod,
      default: () => client_default,
      en: () => en,
      formatPrice: () => formatPrice,
      inject: () => inject,
      isDeepseekModel: () => isDeepseekModel,
      modelPrices: () => modelPrices,
      zh: () => zh
    });
    module.exports = __toCommonJS(client_exports);
    var import_react = __toESM(require("react"), 1);
    var NS = "peakIndicator";
    var zh = {
      "badge.peak": "\u26A1 \u9AD8\u5CF0",
      "badge.offpeak": "\u{1F319} \u95F2\u65F6",
      "badge.other": "\u{1F33F} \u5176\u4ED6\u6A21\u578B",
      "badge.cost": " \u00B7 \u672C\u4F1A\u8BDD\u00A5{amount}",
      "turn.cost": "\u672C\u8F6E \u00A5{amount}",
      "turn.tip": "\u672C\u8F6E\u5B9E\u9645 token \u6D88\u8017\u8D39\u7528\uFF08\u6309 DeepSeek \u5CF0\u8C37\u4EF7\u683C\u4F30\u7B97\uFF09",
      "tip.peak": "DeepSeek \u9AD8\u5CF0\u65F6\u6BB5\uFF08\u5317\u4EAC\u65F6\u95F4 09:00\u201312:00\u300114:00\u201318:00\uFF09\uFF0C\u6309\u9AD8\u5CF0\u4EF7\u8BA1\u8D39",
      "tip.offpeak": "DeepSeek \u95F2\u65F6\uFF08\u9AD8\u5CF0\u4EE5\u5916\u65F6\u6BB5\uFF09\uFF0C\u4EF7\u683C\u4E3A\u9AD8\u5CF0\u7684\u4E00\u534A",
      "tip.price": "\u8F93\u5165 \u00A5{input} \u00B7 \u8F93\u51FA \u00A5{output} \u00B7 \u7F13\u5B58\u547D\u4E2D \u00A5{cacheHitInput} \uFF08\u6BCF\u767E\u4E07 tokens\uFF09",
      "tip.other": "\u5F53\u524D\u6A21\u578B {model}\uFF08\u975E DeepSeek\uFF09\uFF0C\u6309\u8BE5\u6A21\u578B\u4EF7\u683C\u8BA1\u8D39\uFF08\u65E0\u5CF0\u8C37\uFF09",
      "tip.now": "\u5F53\u524D\u5317\u4EAC\u65F6\u95F4 {time}",
      "tip.next": "{countdown} \u540E\u5207\u6362\u8BA1\u4EF7\u65F6\u6BB5"
    };
    var en = {
      "badge.peak": "\u26A1 Peak",
      "badge.offpeak": "\u{1F319} Off-peak",
      "badge.other": "\u{1F33F} Other",
      "badge.cost": " \u00B7 \u00A5{amount} session",
      "turn.cost": "Turn \u00A5{amount}",
      "turn.tip": "Actual token cost for this turn (estimated at DeepSeek peak/off-peak rates)",
      "tip.peak": "DeepSeek peak hours (Beijing 09:00\u201312:00, 14:00\u201318:00); peak rates apply",
      "tip.offpeak": "DeepSeek off-peak (outside peak hours); billed at half the peak price",
      "tip.price": "Input \u00A5{input} \u00B7 Output \u00A5{output} \u00B7 Cache hit \u00A5{cacheHitInput} (per 1M tokens)",
      "tip.other": "Model {model} (non-DeepSeek) \u00B7 billed at this model's flat rates (no peak/off-peak)",
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

    /**
     * Peak prices per 1M tokens (CNY) from the DeepSeek official price list
     * effective 2026-08-17 (Beijing time). Off-peak prices are exactly half.
     * Update this table when DeepSeek changes its price list.
     */
    var MODEL_PRICES = {
      "deepseek-v4-flash": { input: 3.0, output: 9.0, cacheHitInput: 0.1 },
      "deepseek-v4-pro": { input: 9.0, output: 27.0, cacheHitInput: 0.3 }
    };
    /**
     * Approximate flat prices per 1M tokens (CNY) for common non-DeepSeek
     * models (no peak/off-peak applies). Best-effort public rates; override
     * via the plugin config `prices`.
     */
    var OTHER_MODEL_PRICES = {
      "gpt-4o": { input: 18, output: 72, cacheHitInput: 9 },
      "gpt-4o-mini": { input: 1.1, output: 4.3, cacheHitInput: 0.55 },
      "gpt-4.1": { input: 16, output: 64, cacheHitInput: 8 },
      "gpt-4.1-mini": { input: 3.6, output: 14.4, cacheHitInput: 1.8 },
      "claude-opus-4": { input: 112.5, output: 562.5, cacheHitInput: 56.25 },
      "claude-sonnet-4": { input: 22.5, output: 112.5, cacheHitInput: 11.25 },
      "claude-sonnet-4-5": { input: 22.5, output: 112.5, cacheHitInput: 11.25 },
      "claude-haiku-4": { input: 7.2, output: 36, cacheHitInput: 3.6 },
      "gemini-2.5-pro": { input: 9.4, output: 56.3, cacheHitInput: 4.7 },
      "gemini-2.5-flash": { input: 2.2, output: 13.3, cacheHitInput: 1.1 },
      "qwen3-max": { input: 8.6, output: 43.2, cacheHitInput: 4.3 },
      "glm-4.6": { input: 7, output: 14, cacheHitInput: 3.5 },
      "kimi-k2": { input: 12, output: 48, cacheHitInput: 6 }
    };
    /** Off-peak price ratio vs. peak (official: idle hours cost half of peak). */
    var OFF_PEAK_FACTOR = 0.5;

    /**
     * Resolve the current token prices for a model during a billing period.
     * DeepSeek flash/pro models follow the peak/off-peak table; every other
     * model uses its flat price (period ignored).
     * @returns input/output/cache-hit prices per 1M tokens, or null when the
     * model has no known price entry.
     */
    function modelPrices(model, period) {
      const m = String(model ?? "").toLowerCase();
      const isDS = m.includes("deepseek") && (m.includes("flash") || m.includes("pro"));
      let table = isDS ? MODEL_PRICES : { ...OTHER_MODEL_PRICES };
      let peak = table[m];
      if (peak === void 0) {
        const keys = Object.keys(table).sort((a, b) => b.length - a.length);
        for (const key of keys) {
          if (m.startsWith(key)) { peak = table[key]; break; }
        }
      }
      if (peak === void 0) return null;
      if (!isDS) {
        return { input: peak.input, output: peak.output, cacheHitInput: peak.cacheHitInput };
      }
      const factor = period === "offpeak" ? OFF_PEAK_FACTOR : 1;
      return {
        input: peak.input * factor,
        output: peak.output * factor,
        cacheHitInput: peak.cacheHitInput * factor
      };
    }

    /** Trim trailing zeros for display (1.5 -> "1.5", 3 -> "3", 0.05 -> "0.05"). */
    function formatPrice(value) {
      return String(Math.round(value * 1e4) / 1e4);
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

    /** No-op store faces for the "directory not available yet" case. */
    var noopSubscribe = () => () => {};
    var noopSnapshot = () => null;

    /**
     * The peak/off-peak badge rendered into the conversation session header.
     * Only hidden when the session's current model is positively known NOT to
     * be a DeepSeek flash/pro model; an unknown or still-loading selection
     * keeps the badge visible so it never silently disappears. The model
     * directory is re-loaded on a short retry loop until the selection lands;
     * the billing period recomputes every 30 seconds.
     */
    function PeakBadge({ t, directory, load, useProjection }) {
      const state = import_react.default.useSyncExternalStore(
        (fn) => directory ? directory.subscribe(fn) : noopSubscribe(),
        () => directory ? directory.getSnapshot() : noopSnapshot()
      );
      const [period, setPeriod] = import_react.default.useState(() => currentPeriod(new Date()));
      import_react.default.useEffect(() => {
        if (typeof load === "function") load();
        const id = setInterval(() => setPeriod(currentPeriod(new Date())), 30000);
        let retries = 0;
        const retryId = setInterval(() => {
          let snap = null;
          try {
            snap = typeof directory?.getSnapshot === "function" ? directory.getSnapshot() : null;
          } catch {
            snap = null;
          }
          if (snap?.current != null || retries >= 8) {
            clearInterval(retryId);
            return;
          }
          if (typeof load === "function") load();
          retries += 1;
        }, 2000);
        return () => {
          clearInterval(id);
          clearInterval(retryId);
        };
      }, []);
      const current = state?.current;
      const isOther = current !== null && current !== void 0 && !isDeepseekModel(current?.provider, current?.model);
      const now = new Date();
      const projection = useProjection("peakCost");
      const totalCost = typeof projection === "object" && projection !== null && typeof projection.totalCost === "number" ? projection.totalCost : 0;
      const costSuffix = totalCost > 0 ? t("badge.cost", { amount: totalCost.toFixed(2) }) : "";
      let tip;
      let label;
      if (isOther) {
        const otherPrices = modelPrices(current?.model, period);
        tip = `${t("tip.other", { model: current?.model ?? "?" })}${otherPrices === null ? "" : ` \u00B7 ${t("tip.price", { input: formatPrice(otherPrices.input), output: formatPrice(otherPrices.output), cacheHitInput: formatPrice(otherPrices.cacheHitInput) })}`} \u00B7 ${t("tip.now", { time: formatBeijingClock(now) })}`;
        label = t("badge.other") + costSuffix;
      } else {
        const prices = modelPrices(current?.model, period);
        tip = `${t("tip." + period)}${prices === null ? "" : ` \u00B7 ${t("tip.price", { input: formatPrice(prices.input), output: formatPrice(prices.output), cacheHitInput: formatPrice(prices.cacheHitInput) })}`} \u00B7 ${t("tip.now", { time: formatBeijingClock(now) })} \u00B7 ${t("tip.next", { countdown: formatCountdown(nextTransitionInMinutes(now)) })}`;
        label = t("badge." + period) + costSuffix;
      }
      const neutral = isOther;
      const [hovered, setHovered] = import_react.default.useState(false);
      const [tooltipPos, setTooltipPos] = import_react.default.useState(null);
      const showTooltip = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltipPos({ top: rect.bottom + 6, left: rect.left });
        setHovered(true);
      };
      return import_react.default.createElement("span", {
        style: { position: "relative", display: "inline-flex" },
        onMouseEnter: showTooltip,
        onMouseLeave: () => setHovered(false)
      },
        import_react.default.createElement("span", {
          title: tip,
          style: {
            whiteSpace: "nowrap",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: "18px",
            padding: "1px 8px",
            borderRadius: 999,
            color: neutral ? "#0f7b3d" : period === "peak" ? "#ffffff" : "#0f7b3d",
            background: neutral || period === "offpeak" ? "#d9f2e2" : "#e5484d",
            border: neutral || period === "offpeak" ? "1px solid #7fd6a8" : "1px solid #e5484d",
            cursor: "help",
            fontVariantNumeric: "tabular-nums"
          }
        }, label),
        hovered && tooltipPos !== null
          ? import_react.default.createElement("div", {
              style: {
                position: "fixed",
                top: tooltipPos.top,
                left: tooltipPos.left,
                zIndex: 9999,
                background: "rgba(17, 24, 39, 0.96)",
                color: "#f3f4f6",
                fontSize: 12,
                lineHeight: "18px",
                padding: "8px 10px",
                borderRadius: 8,
                maxWidth: 380,
                whiteSpace: "normal",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.28)",
                pointerEvents: "none"
              }
            }, tip)
          : null
      );
    }

    /**
     * Per-turn cost chip rendered at the end of each assistant turn (the
     * turn-tail actions row): the actual token cost of the WHOLE turn —
     * every step of the turn is aggregated (a turn often spans several
     * tool-call steps, each with its own usage), so that the turn chip plus
     * the previous session total equals the new session total. Styled as a
     * period-colored pill like the header badge (green off-peak / red peak).
     */
    function TurnCost({ messageId, useProjection, t }) {
      const [period, setPeriod] = import_react.default.useState(() => currentPeriod(new Date()));
      import_react.default.useEffect(() => {
        const id = setInterval(() => setPeriod(currentPeriod(new Date())), 30000);
        return () => clearInterval(id);
      }, []);
      const projection = useProjection("peakCost");
      if (typeof projection !== "object" || projection === null) return null;
      const entry = projection.messageCosts?.[messageId];
      if (typeof entry !== "object" || entry === null) return null;
      const isDS = isDeepseekModel(entry.provider, entry.model);
      // Historical turns keep the color of the period in which they happened;
      // fall back to the live period only when the projection has no record.
      const chipPeriod = typeof entry.period === "string" ? entry.period : period;
      let cost = entry.cost;
      if (typeof entry.turn === "number") {
        cost = 0;
        for (const row of Object.values(projection.messageCosts)) {
          if (row !== null && typeof row === "object" && row.turn === entry.turn) cost += typeof row.cost === "number" ? row.cost : 0;
        }
      }
      if (typeof cost !== "number" || cost <= 0) return null;
      return import_react.default.createElement("span", {
        className: "dsh-peak-indicator-turn-cost",
        title: t("turn.tip"),
        style: {
          whiteSpace: "nowrap",
          marginLeft: 8,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: "18px",
          padding: "1px 8px",
          borderRadius: 999,
          color: !isDS || chipPeriod === "offpeak" ? "#0f7b3d" : "#ffffff",
          background: !isDS || chipPeriod === "offpeak" ? "#d9f2e2" : "#e5484d",
          border: !isDS || chipPeriod === "offpeak" ? "1px solid #7fd6a8" : "1px solid #e5484d",
          fontVariantNumeric: "tabular-nums"
        }
      }, t("turn.cost", { amount: cost.toFixed(2) }));
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
      ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
        name: "conversation.chat.assistant-actions",
        id: "peak-indicator",
        order: 100,
        locale: NS
      }, TurnCost));
    }
    var client_default = { apply, inject };
    //#endregion

    return module.exports;
  }
});
