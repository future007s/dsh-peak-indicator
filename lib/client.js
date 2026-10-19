// dsh-peak-indicator client bundle (hand-built ModuleLoader format, mirrors the
// output shape of the other dsh web plugins). Shows a badge in the conversation
// session header marking whether the DeepSeek API is currently in its peak
// (高峰) or off-peak / half-price (闲时) billing window. Policy per the official
// DeepSeek peak/off-peak pricing scheme effective 2026-08-17 00:00 Beijing time;
// V4.1-Flash prices take effect 2026-09-10 12:00 Beijing time:
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
      modelDisplayName: () => modelDisplayName,
      nextTransitionInMinutes: () => nextTransitionInMinutes,
      zh: () => zh
    });
    module.exports = __toCommonJS(client_exports);
    var import_react = __toESM(require("react"), 1);
    var NS = "peakIndicator";
    var zh = {
      "badge.peak": "\u26A1 \u9AD8\u5CF0",
      "badge.offpeak": "\u{1F319} \u95F2\u65F6",
      "badge.other": "\u{1F33F} \u5176\u4ED6\u6A21\u578B",
      "badge.next": " \u00B7 {countdown} \u540E\u5207\u6362",
      "badge.cost": " \u00B7 \u672C\u4F1A\u8BDD${amount}",
      "turn.cost": "\u672C\u8F6E ${amount}",
      "turn.tip": "\u672C\u8F6E\u5B9E\u9645 token \u6D88\u8017\u8D39\u7528\uFF08\u6309 DeepSeek \u5CF0\u8C37\u4EF7\u683C\u4F30\u7B97\uFF09",
      "tip.peak": "DeepSeek \u9AD8\u5CF0\u65F6\u6BB5\uFF08\u5317\u4EAC\u65F6\u95F4 09:00\u201312:00\u300114:00\u201318:00\uFF09\uFF0C\u6309\u9AD8\u5CF0\u4EF7\u8BA1\u8D39",
      "tip.offpeak": "DeepSeek \u95F2\u65F6\uFF1B\u5468\u516D\u3001\u5468\u65E5\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09\u5168\u5929\u6309\u95F2\u65F6\u4EF7\u8BA1\u8D39",
      "tip.price": "\u8F93\u5165 ${input} \u00B7 \u8F93\u51FA ${output} \u00B7 \u7F13\u5B58\u547D\u4E2D ${cacheHitInput} \uFF08\u6BCF\u767E\u4E07 tokens\uFF09",
      "tip.other": "\u5F53\u524D\u6A21\u578B {model}\uFF08\u975E DeepSeek\uFF09\uFF0C\u6309\u8BE5\u6A21\u578B\u4EF7\u683C\u8BA1\u8D39\uFF08\u65E0\u5CF0\u8C37\uFF09",
      "tip.now": "\u5F53\u524D\u5317\u4EAC\u65F6\u95F4 {time}",
      "tip.next": "{countdown} \u540E\u5207\u6362\u8BA1\u4EF7\u65F6\u6BB5"
    };
    var en = {
      "badge.peak": "\u26A1 Peak",
      "badge.offpeak": "\u{1F319} Off-peak",
      "badge.other": "\u{1F33F} Other",
      "badge.next": " \u00B7 switches in {countdown}",
      "badge.cost": " \u00B7 ${amount} session",
      "turn.cost": "Turn ${amount}",
      "turn.tip": "Actual token cost for this turn (estimated at DeepSeek peak/off-peak rates)",
      "tip.peak": "DeepSeek peak hours (Beijing 09:00\u201312:00, 14:00\u201318:00); peak rates apply",
      "tip.offpeak": "DeepSeek off-peak; all Saturday and Sunday hours (Beijing time) use off-peak rates",
      "tip.price": "Input ${input} \u00B7 Output ${output} \u00B7 Cache hit ${cacheHitInput} (per 1M tokens)",
      "tip.other": "Model {model} (non-DeepSeek) \u00B7 billed at this model's flat rates (no peak/off-peak)",
      "tip.now": "Beijing time {time}",
      "tip.next": "billing window switches in {countdown}"
    };

    Object.assign(zh, {
      "badge.cost": " · 已计价 token ${amount}",
      "turn.tip": "本轮已知单价的 token 费用估算；不含 Search/Fetch 按次费用。",
      "tip.peak": "北京时间工作日 09:00–12:00、14:00–18:00 为高峰，中国法定节假日除外",
      "tip.offpeak": "当前为空闲时段；周末与中国法定节假日全天均为空闲价",
      "tip.other": "当前模型 {model} 未内置单价；仅显式配置 USD 价格的用量会计入估算",
      "tip.cny": "人民币参考：输入 ¥{input} · 输出 ¥{output} · 缓存命中 ¥{cacheHitInput} / 百万 tokens",
      "tip.scope": "统计按美元计价的已知 token 费用，非官方账单",
      "tip.calendar": "当前年份节假日尚未内置，请核对官方节假日规则",
      "tip.toolsFree": "DSH 服务端 Search/Fetch 目前免费；2026-11-01 起按次计费，不包含在此 token 估算中",
      "tip.toolsBilled": "Search/Fetch 每次成功且有结果的调用 $0.00075（¥0.005），不包含在此 token 估算中"
    });
    Object.assign(en, {
      "badge.cost": " · priced tokens ${amount}",
      "turn.tip": "Estimated token cost at known rates; excludes per-request Search/Fetch charges.",
      "tip.peak": "Weekdays Beijing 09:00–12:00 and 14:00–18:00, excluding Chinese public holidays",
      "tip.offpeak": "Off-peak, including all weekends and Chinese public holidays",
      "tip.other": "No built-in rate for {model}; only explicitly configured USD usage is included",
      "tip.cny": "CNY reference: input ¥{input} · output ¥{output} · cache hit ¥{cacheHitInput} / 1M tokens",
      "tip.scope": "Known USD token charges only; not an official invoice",
      "tip.calendar": "Holiday dates for this year are not bundled; check the official calendar",
      "tip.toolsFree": "DSH server Search/Fetch tools are free until 2026-11-01; request charges are excluded here",
      "tip.toolsBilled": "Successful nonempty Search/Fetch requests cost $0.00075 (¥0.005) each, excluded here"
    });

    zh["settings.compact.title"] = "成本与上下文";
    zh["settings.compact.enabled"] = "自动压缩长会话";
    zh["settings.compact.budget"] = "触发预算";
    zh["settings.compact.retain"] = "保留最近";
    zh["settings.compact.hint"] = "推荐 100k：更低预算更省钱，但旧对话会更多依赖摘要。";
    zh["settings.compact.error"] = "保存失败，请重试。";
    en["settings.compact.error"] = "Could not save. Please retry.";
    en["settings.compact.title"] = "Cost & context";
    en["settings.compact.enabled"] = "Auto-compact long sessions";
    en["settings.compact.budget"] = "Trigger budget";
    en["settings.compact.retain"] = "Retain recent";
    en["settings.compact.hint"] = "100k is recommended; lower budgets save more but rely more on summaries.";

    // BEGIN SHARED PRICING
    // Official snapshot checked 2026-10-19. Prices are per 1M tokens.
    // USD: https://api-docs.deepseek.com/quick_start/pricing/
    // CNY: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
    // Model version: https://api-docs.deepseek.com/zh-cn/updates/
    const PRICING_CHECKED_AT = "2026-10-19";
    const DEFAULT_PEAK_WINDOWS = [[9, 12], [14, 18]];
    const BEIJING_OFFSET_MINUTES = 480;
    const OFF_PEAK_DISCOUNT = 0.5;
    const LEGACY_PRICES = {
      "deepseek-flash": { input: 1.0, output: 2.0, cacheHitInput: 0.02 },
      "deepseek-v4-flash": { input: 1.0, output: 2.0, cacheHitInput: 0.02 },
      "deepseek-v4-flash-vision-exp": { input: 1.0, output: 2.0, cacheHitInput: 0.02 },
      "deepseek-v4-pro": { input: 3.0, output: 6.0, cacheHitInput: 0.025 }
    };
    const V4_MODEL_PRICES = {
      "deepseek-flash": { input: 0.44, output: 1.32, cacheHitInput: 0.014 },
      "deepseek-v4-flash": { input: 0.44, output: 1.32, cacheHitInput: 0.014 },
      "deepseek-v4-flash-vision-exp": { input: 0.44, output: 1.32, cacheHitInput: 0.014 },
      "deepseek-v4-pro": { input: 1.32, output: 3.96, cacheHitInput: 0.044 }
    };
    const MODEL_PRICES = {
      "deepseek-flash": { input: 0.30, output: 1.20, cacheHitInput: 0.006 },
      "deepseek-v4-flash": { input: 0.30, output: 1.20, cacheHitInput: 0.006 },
      "deepseek-v4-flash-vision-exp": { input: 0.30, output: 1.20, cacheHitInput: 0.006 },
      "deepseek-v4-pro": { input: 1.32, output: 3.96, cacheHitInput: 0.044 }
    };
    const MODEL_PRICES_CNY = {
      "deepseek-flash": {input: 2, output: 8, cacheHitInput: 0.04},
      "deepseek-v4-pro": {input: 9, output: 27, cacheHitInput: 0.30}
    };
    // No cross-provider CNY estimates in a USD projection. Supply config.prices
    // explicitly in USD for non-DeepSeek routes instead.
    const OTHER_MODEL_PRICES = {};
    const SEARCH_FETCH_PRICING = {
      usdPerSuccessfulRequest: 0.00075,
      cnyPerSuccessfulRequest: 0.005,
      serverToolsBillFrom: "2026-11-01T00:00:00+08:00"
    };
    // Official published 2026 holiday breaks (including announced days off).
    // https://www.gov.cn/zhengce/content/202511/content_7047090.htm
    // Weekend make-up workdays stay off-peak: DeepSeek explicitly excludes weekends.
    const HOLIDAY_YEARS = [2026];
    const CHINA_HOLIDAY_DATES = [
      ["2026-01-01", "2026-01-03"], ["2026-02-15", "2026-02-23"],
      ["2026-04-04", "2026-04-06"], ["2026-05-01", "2026-05-05"],
      ["2026-06-19", "2026-06-21"], ["2026-09-25", "2026-09-27"],
      ["2026-10-01", "2026-10-07"]
    ].flatMap(([start, end]) => {
      const days = [];
      for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));
      return days;
    });
    const DEFAULT_POLICY = {
      peakWindows: DEFAULT_PEAK_WINDOWS,
      offPeakDiscount: OFF_PEAK_DISCOUNT,
      policyEffectiveDate: "2026-08-17T00:00:00+08:00",
      weekendOffPeakEffectiveDate: "2026-08-23T00:00:00+08:00",
      v41FlashEffectiveDate: "2026-09-10T12:00:00+08:00",
      holidayDates: CHINA_HOLIDAY_DATES,
      prices: {}
    };
    function beijingMinutes(now) {
      return (now.getUTCHours() * 60 + now.getUTCMinutes() + BEIJING_OFFSET_MINUTES) % 1440;
    }
    function beijingDay(now) {
      return new Date(now.getTime() + BEIJING_OFFSET_MINUTES * 60000).getUTCDay();
    }
    function beijingDate(now) {
      return new Date(now.getTime() + BEIJING_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
    }
    function canonicalModelId(model) {
      const m = String(model ?? "").toLowerCase();
      if (/^deepseek-(?:flash(?:-\d{4})?|v4\.1-flash(?:-\d{4})?|v4-flash(?:-vision-exp|-\d{4})?)$/.test(m)) return "deepseek-flash";
      if (/^deepseek-v4-pro(?:-\d{4})?$/.test(m)) return "deepseek-v4-pro";
      return null;
    }
    function modelDisplayName(model) {
      const id = canonicalModelId(model);
      return id === "deepseek-flash" ? "DeepSeek-V4.1-Flash-1017" : id === "deepseek-v4-pro" ? "DeepSeek-V4-Pro-0813" : String(model ?? "");
    }
    function isDeepseekModel(provider, model) {
      return String(provider ?? "").toLowerCase().includes("deepseek") && canonicalModelId(model) !== null;
    }
    function billingPeriod(now = new Date(), config = DEFAULT_POLICY) {
      const bj = beijingMinutes(now);
      if (now.getTime() >= Date.parse(config.policyEffectiveDate)
        && (config.holidayDates ?? CHINA_HOLIDAY_DATES).includes(beijingDate(now))) return {period: "offpeak", beijingMinutes: bj};
      if (now.getTime() >= Date.parse(config.weekendOffPeakEffectiveDate)) {
        const day = beijingDay(now);
        if (day === 0 || day === 6) return {period: "offpeak", beijingMinutes: bj};
      }
      const peak = config.peakWindows.some(([a, b]) => bj >= a * 60 && bj < b * 60);
      return {period: peak ? "peak" : "offpeak", beijingMinutes: bj};
    }
    function periodAt(timeMs, config = DEFAULT_POLICY) {
      return billingPeriod(new Date(timeMs), config).period;
    }
    function resolveModelPrice(model, table) {
      const m = String(model ?? "").toLowerCase();
      if (Object.hasOwn(table, m)) return table[m];
      for (const key of Object.keys(table).sort((a, b) => b.length - a.length)) {
        if (m.startsWith(key + "-")) return table[key];
      }
      const canonical = canonicalModelId(m);
      if (canonical && Object.hasOwn(table, canonical)) return table[canonical];
      if (canonical === "deepseek-flash") return table["deepseek-v4-flash"] ?? null;
      return null;
    }
    function effectiveNewPrices(config) { return {...MODEL_PRICES, ...config.prices}; }
    function priceFor(model, period, timeMs, config = DEFAULT_POLICY) {
      const isDS = canonicalModelId(model) !== null;
      if (!isDS) return resolveModelPrice(model, config.prices ?? {});
      if (timeMs < Date.parse(config.policyEffectiveDate)) return resolveModelPrice(model, LEGACY_PRICES);
      const table = timeMs >= Date.parse(config.v41FlashEffectiveDate) ? MODEL_PRICES : V4_MODEL_PRICES;
      const price = resolveModelPrice(model, {...table, ...config.prices});
      if (price === null) return null;
      const factor = period === "offpeak" ? config.offPeakDiscount : 1;
      return {input: price.input * factor, output: price.output * factor, cacheHitInput: price.cacheHitInput * factor};
    }
    function modelPrices(model, period, currency = "USD") {
      if (currency === "USD") return priceFor(model, period, Date.now());
      const price = MODEL_PRICES_CNY[canonicalModelId(model)];
      if (!price) return null;
      const factor = period === "offpeak" ? OFF_PEAK_DISCOUNT : 1;
      return {input: price.input * factor, output: price.output * factor, cacheHitInput: price.cacheHitInput * factor};
    }
    function nextTransitionInMinutes(now = new Date(), config = DEFAULT_POLICY) {
      const origin = Math.floor(now.getTime() / 60000) * 60000;
      const midnight = Date.parse(beijingDate(now) + "T00:00:00+08:00");
      const boundaries = [...new Set([0, ...config.peakWindows.flat().map(x => x * 60)])].sort((a,b) => a-b);
      for (let day = 0; day <= 370; day++) for (const minutes of boundaries) {
        const t = midnight + day * 86400000 + minutes * 60000;
        if (t > origin && periodAt(t - 1, config) !== periodAt(t, config)) return (t - origin) / 60000;
      }
      return null;
    }
    function formatPrice(value) { return String(Math.round(value * 1e4) / 1e4); }
    function formatBeijingClock(now) {
      const bj = beijingMinutes(now);
      return `${String(Math.floor(bj / 60)).padStart(2, "0")}:${String(bj % 60).padStart(2, "0")}`;
    }
    function formatCountdown(minutes) {
      if (minutes === null) return "—";
      const hours = Math.floor(minutes / 60), rest = minutes % 60;
      return hours === 0 ? `${rest} 分钟` : `${hours} 小时 ${rest} 分钟`;
    }
    // END SHARED PRICING
    function currentPeriod(now) { return billingPeriod(now).period; }

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
      const [now, setNow] = import_react.default.useState(() => new Date());
      const period = currentPeriod(now);
      import_react.default.useEffect(() => {
        if (typeof load === "function") load();
        const id = setInterval(() => setNow(new Date()), 30000);
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
        const countdown = formatCountdown(nextTransitionInMinutes(now));
        tip = `${t("tip." + period)}${prices === null ? "" : ` \u00B7 ${t("tip.price", { input: formatPrice(prices.input), output: formatPrice(prices.output), cacheHitInput: formatPrice(prices.cacheHitInput) })}`} \u00B7 ${t("tip.now", { time: formatBeijingClock(now) })}`;
        label = t("badge." + period) + t("badge.next", { countdown }) + costSuffix;
      }
      if (!isOther && current?.model) {
        const cny = modelPrices(current.model, period, "CNY");
        tip += ` · ${modelDisplayName(current.model)}`;
        if (cny) tip += ` · ${t("tip.cny", {input: formatPrice(cny.input), output: formatPrice(cny.output), cacheHitInput: formatPrice(cny.cacheHitInput)})}`;
      }
      tip += ` · ${t("tip.scope")}`;
      if (!HOLIDAY_YEARS.includes(Number(beijingDate(now).slice(0,4)))) tip += ` · ${t("tip.calendar")}`;
      tip += ` · ${t(now.getTime() < Date.parse(SEARCH_FETCH_PRICING.serverToolsBillFrom) ? "tip.toolsFree" : "tip.toolsBilled")}`;
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

    function CompactSettingsRow({ t, scope }) {
      const snapshot = import_react.default.useSyncExternalStore(
        (listener) => scope.subscribe(listener),
        () => scope.getSnapshot(),
        () => scope.getSnapshot()
      );
      const ac = snapshot.value?.autoCompact ?? {};
      const [writeError, setWriteError] = import_react.default.useState(false);
      const writable = snapshot.status === "ready" && snapshot.writable;
      const update = (patch) => scope.mutate(Object.entries(patch).map(([key, value]) => ({
        op: "set", path: ["autoCompact", key], value
      }))).then(ok => setWriteError(!ok)).catch(() => setWriteError(true));
      const budget = ac.contextBudget ?? 100000;
      const retain = ac.retainTokens ?? 15000;
      return (0, import_react.default.createElement)("div", { style: { borderBottom: "1px solid var(--dsw-alias-border-l2)", padding: "16px 0" } },
        (0, import_react.default.createElement)("div", { style: { color: "var(--dsw-alias-label-primary)", fontSize: 14, marginBottom: 10 } }, t("settings.compact.title")),
        (0, import_react.default.createElement)("label", { style: { display: "flex", gap: 8, alignItems: "center", fontSize: 13 } },
          (0, import_react.default.createElement)("input", { type: "checkbox", checked: Boolean(ac.enabled), disabled: !writable, onChange: (e) => update({ enabled: e.target.checked }) }),
          t("settings.compact.enabled")),
        (0, import_react.default.createElement)("div", { style: { display: "flex", gap: 10, marginTop: 10, alignItems: "center", fontSize: 13 } },
          (0, import_react.default.createElement)("label", null, t("settings.compact.budget")),
          (0, import_react.default.createElement)("select", { value: budget, disabled: !writable, onChange: (e) => update({ contextBudget: Number(e.target.value) }) },
            [60000, 100000, 150000, 200000].map((n) => (0, import_react.default.createElement)("option", { key: n, value: n }, `${Math.round(n / 1000)}k`))),
          (0, import_react.default.createElement)("label", null, t("settings.compact.retain")),
          (0, import_react.default.createElement)("select", { value: retain, disabled: !writable, onChange: (e) => update({ retainTokens: Number(e.target.value) }) },
            [8000, 15000, 30000].map((n) => (0, import_react.default.createElement)("option", { key: n, value: n }, `${Math.round(n / 1000)}k`)))),
        (0, import_react.default.createElement)("div", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12, marginTop: 8 } }, t("settings.compact.hint")),
        writeError ? (0, import_react.default.createElement)("div", { role: "alert" }, t("settings.compact.error")) : null);
    }
    var inject = ["slots", "locale", "modelDirectories", "configForms"];
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
      const scope = ctx.configForms.get("peak-indicator");
      ctx.effect(() => ctx.configForms.whileServed(["peak-indicator"], () => {
        const disposeBundle = ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
          name: "plugins.bundle.config",
          id: "peak-indicator-compaction",
          key: "dsh-peak-indicator",
          locale: NS,
          inject: () => ({ scope })
        }, CompactSettingsRow));
        const disposeGeneral = ctx.slots.inject("settings.general.item", () => ctx.slots.register({
          name: "settings.general.item",
          id: "peak-indicator-compaction-general",
          order: 40,
          locale: NS,
          inject: () => ({ scope })
        }, CompactSettingsRow));
        return () => { disposeBundle(); disposeGeneral(); };
      }), "peak-indicator: settings forms");
    }
    var client_default = { apply, inject };
    //#endregion

    return module.exports;
  }
});
