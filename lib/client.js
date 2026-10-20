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
      BalanceBadge: () => BalanceBadge,
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
      badgeTooltip: () => badgeTooltip,
      modelDisplayName: () => modelDisplayName,
      nextTransitionInMinutes: () => nextTransitionInMinutes,
      zh: () => zh
    });
    module.exports = __toCommonJS(client_exports);
    var import_react = __toESM(require("react"), 1);
    var NS = "peakIndicator";
    var zh = {
      "badge.peak": "⚡ 高峰", "badge.offpeak": "🌙 闲时", "badge.other": "🌿 其它模型",
      "badge.next": " · {countdown} 后切换", "badge.cost": " · {symbol}{amount}",
      "turn.cost": "本轮 {symbol}{amount}", "turn.tip": "本轮 Token 费用估算",
      "tip.price": "输入 {symbol}{input} · 输出 {symbol}{output} · 缓存 {symbol}{cacheHitInput} / 百万 tokens",
      "tip.scope": "按已知 Token 估算，不含搜索/抓取费",
      "tip.unknown": "暂未取得模型单价", "tip.loading": "模型加载中"
    };
    var en = {
      "badge.peak": "⚡ Peak", "badge.offpeak": "🌙 Off-peak", "badge.other": "🌿 Other",
      "badge.next": " · switches in {countdown}", "badge.cost": " · {symbol}{amount}",
      "turn.cost": "Turn {symbol}{amount}", "turn.tip": "Estimated token cost for this turn",
      "tip.price": "Input {symbol}{input} · Output {symbol}{output} · Cache {symbol}{cacheHitInput} / 1M tokens",
      "tip.scope": "Known tokens only; excludes Search/Fetch",
      "tip.unknown": "Model rate unavailable", "tip.loading": "Loading model"
    };

    Object.assign(zh, {
      "balance.amount": "余额 {amount}", "balance.tip": "充值 {recharge} · 赠金 {bonus}，点击刷新",
      "balance.loading": "余额加载中…", "balance.signed-out": "余额：未登录", "balance.failed": "余额暂不可用",
      "balance.unavailable": "余额暂不可用", "balance.no-cny": "暂无人民币钱包", "balance.retry": "点击刷新账户余额"
    });
    Object.assign(en, {
      "balance.amount": "Balance {amount}", "balance.tip": "Recharge {recharge} · Bonus {bonus}; click to refresh",
      "balance.loading": "Loading balance…", "balance.signed-out": "Balance: signed out", "balance.failed": "Balance unavailable",
      "balance.unavailable": "Balance unavailable", "balance.no-cny": "No CNY wallet", "balance.retry": "Click to refresh account balance"
    });

    // BEGIN SHARED PRICING
    // Official snapshot checked 2026-10-20. Prices are per 1M tokens.
    // USD: https://api-docs.deepseek.com/quick_start/pricing/
    // CNY: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
    // Model version: https://api-docs.deepseek.com/zh-cn/updates/
    const PRICING_CHECKED_AT = "2026-10-20";
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
    // Official historical CNY peak rates, effective 2026-08-17.
    // https://api-docs.deepseek.com/zh-cn/img/v4_260813_price_cn.png
    const V4_MODEL_PRICES_CNY = {
      "deepseek-flash": {input: 3, output: 9, cacheHitInput: 0.10},
      "deepseek-v4-pro": {input: 9, output: 27, cacheHitInput: 0.30}
    };
    const CURRENCY_SYMBOLS = {CNY: "¥", USD: "$"};
    const MODEL_PRICES_CNY = {
      "deepseek-flash": {input: 2, output: 8, cacheHitInput: 0.04},
      "deepseek-v4-pro": {input: 9, output: 27, cacheHitInput: 0.30}
    };
    // Currency-specific custom rates never cross the selected currency boundary.
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
      currency: "CNY",
      peakWindows: DEFAULT_PEAK_WINDOWS,
      offPeakDiscount: OFF_PEAK_DISCOUNT,
      policyEffectiveDate: "2026-08-17T00:00:00+08:00",
      weekendOffPeakEffectiveDate: "2026-08-23T00:00:00+08:00",
      v41FlashEffectiveDate: "2026-09-10T12:00:00+08:00",
      holidayDates: CHINA_HOLIDAY_DATES,
      prices: {},
      pricesCny: {}
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
    function effectiveNewPrices(config = DEFAULT_POLICY) {
      return config.currency === "USD" ? {...MODEL_PRICES, ...config.prices} : {...MODEL_PRICES_CNY, ...config.pricesCny};
    }
    function priceFor(model, period, timeMs, config = DEFAULT_POLICY) {
      const currency = config.currency ?? "CNY";
      const overrides = currency === "USD" ? config.prices ?? {} : config.pricesCny ?? {};
      const custom = resolveModelPrice(model, overrides);
      if (canonicalModelId(model) === null) return custom;
      if (timeMs < Date.parse(config.policyEffectiveDate)) {
        // Earlier CNY promotions changed several times. Do not convert the old
        // USD snapshot or invent an incomplete CNY timeline. Explicit overrides
        // can price these records; the built-in CNY schedule starts on Aug 17.
        return custom ?? (currency === "USD" ? resolveModelPrice(model, LEGACY_PRICES) : null);
      }
      const current = timeMs >= Date.parse(config.v41FlashEffectiveDate);
      const table = currency === "USD" ? (current ? MODEL_PRICES : V4_MODEL_PRICES)
        : (current ? MODEL_PRICES_CNY : V4_MODEL_PRICES_CNY);
      const price = custom ?? resolveModelPrice(model, table);
      if (price === null) return null;
      const factor = period === "offpeak" ? config.offPeakDiscount : 1;
      return {input: price.input * factor, output: price.output * factor, cacheHitInput: price.cacheHitInput * factor};
    }
    function modelPrices(model, period, currency = "CNY") {
      return priceFor(model, period, Date.now(), {...DEFAULT_POLICY, currency});
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

    function badgeTooltip(model, period, currency, t) {
      const prices = modelPrices(model, period, currency);
      return [model ? modelDisplayName(model) : t("tip.loading"),
        prices ? t("tip.price", {symbol: CURRENCY_SYMBOLS[currency], input: formatPrice(prices.input),
          output: formatPrice(prices.output), cacheHitInput: formatPrice(prices.cacheHitInput)}) : t("tip.unknown"),
        t("tip.scope")].join("\n");
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
    // BEGIN SHARED BALANCE
    // Account balance uses DSH's authenticated Host RPC; credentials never enter the browser.
    function decimalParts(text) {
      const match = /^([+-]?)(\d*\.?\d+|\d+\.?)(?:e([+-]?\d+))?$/i.exec(text);
      if (!match) throw new Error("Invalid wallet amount");
      const [whole, fraction = ""] = match[2].split(".");
      const exponent = Number(match[3] ?? 0);
      if (Math.abs(exponent) > 400 || fraction.length > 400 || whole.length > 400) throw new Error("Wallet amount out of range");
      let units = BigInt((whole || "0") + fraction) * (match[1] === "-" ? -1n : 1n);
      let scale = fraction.length - exponent;
      if (scale < 0) { units *= 10n ** BigInt(-scale); scale = 0; }
      return {units, scale};
    }
    function sumWallets(wallets) {
      const parts = wallets.map(wallet => decimalParts(wallet.balance));
      const scale = Math.max(0, ...parts.map(part => part.scale));
      return {units: parts.reduce((sum, part) => sum + part.units * 10n ** BigInt(scale - part.scale), 0n), scale};
    }
    function formatWallet({units, scale}) {
      const negative = units < 0n;
      const abs = negative ? -units : units;
      const cents = scale > 2 ? abs / 10n ** BigInt(scale - 2) : abs * 10n ** BigInt(2 - scale);
      if (abs !== 0n && cents === 0n) return negative ? "-<¥0.01" : "<¥0.01";
      const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return `${negative ? "-" : ""}¥${whole}.${(cents % 100n).toString().padStart(2, "0")}`;
    }
    function summarizeBalance(result) {
      if (result === null) return {status: "signed-out"};
      if (result?.status !== "ready") return {status: "failed"};
      try {
        const recharge = result.value.filter(wallet => wallet.currency === "CNY");
        const bonus = result.bonusWallets.filter(wallet => wallet.currency === "CNY");
        if (!recharge.length && !bonus.length) return {status: "no-cny"};
        return {status: "ready", total: formatWallet(sumWallets([...recharge, ...bonus])),
          recharge: formatWallet(sumWallets(recharge)), bonus: formatWallet(sumWallets(bonus))};
      } catch { return {status: "failed"}; }
    }

    // One shared store across session headers. Account changes invalidate outstanding reads.
    function createBalanceStore() {
      let snapshot = {status: "unavailable"};
      let remote, metadata, revision = 0, pending, disposed = false, signedIn = false;
      const listeners = new Set();
      const publish = value => { if (!disposed) { snapshot = value; for (const listener of listeners) listener(); } };
      const refresh = () => {
        if (disposed || !remote || !signedIn) return Promise.resolve();
        if (pending) return pending;
        const generation = revision;
        publish({status: "loading"});
        const task = Promise.resolve().then(() => remote.account.getBalance(metadata())).then(result => {
          if (!disposed && generation === revision) publish(result.ok ? summarizeBalance(result.value) : {status: "failed"});
        }).catch(() => { if (!disposed && generation === revision) publish({status: "failed"}); });
        pending = task;
        task.finally(() => { if (pending === task) pending = undefined; });
        return task;
      };
      const accountChanged = view => {
        revision++; pending = undefined;
        signedIn = view?.status === "credential-stored";
        publish({status: signedIn ? "loading" : "signed-out"});
        if (signedIn) void refresh();
      };
      return {
        getSnapshot: () => snapshot,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        refresh,
        connect(api, getMetadata) {
          remote = api; metadata = getMetadata;
          const stream = api.$stream({name: "account", open: signal => api.account.watch(signal), ended: () => new Error("Account stream ended")});
          let connected = true;
          void (async () => {
            try {
              for await (const frame of stream) {
                if (!connected || disposed) break;
                accountChanged(frame.value);
                frame.accept();
              }
            } catch { /* The next watch snapshot refreshes after reconnection. */ }
            if (connected && !disposed) { revision++; pending = undefined; signedIn = false; publish({status: "unavailable"}); }
          })();
          const timer = setInterval(() => { void refresh(); }, 60000);
          return () => { connected = false; revision++; pending = undefined; signedIn = false; remote = undefined; clearInterval(timer); publish({status: "unavailable"}); return stream.dispose(); };
        },
        dispose() { disposed = true; revision++; listeners.clear(); }
      };
    }
    // END SHARED BALANCE

    function BalanceBadge({ t, balance, provider }) {
      const snapshot = import_react.default.useSyncExternalStore(balance.subscribe, balance.getSnapshot, balance.getSnapshot);
      if (provider !== "deepseek-account") return null;
      const ready = snapshot.status === "ready";
      const label = ready ? t("balance.amount", {amount: snapshot.total}) : t("balance." + snapshot.status);
      const tip = ready ? t("balance.tip", {recharge: snapshot.recharge, bonus: snapshot.bonus}) : t("balance.retry");
      return import_react.default.createElement("button", {
        type: "button", className: "dsh-peak-indicator-balance", title: tip,
        onClick: () => { void balance.refresh(); }, disabled: snapshot.status === "loading",
        style: {marginLeft: 6, padding: "1px 8px", borderRadius: 999, border: "1px solid var(--dsw-alias-border-l2, #cbd5e1)",
          background: "transparent", color: "var(--dsw-alias-label-primary, inherit)", fontSize: 12,
          whiteSpace: "nowrap", lineHeight: "18px", cursor: "pointer", fontVariantNumeric: "tabular-nums"}
      }, label);
    }

    function PeakBadge({ t, directory, load, useProjection, balance }) {
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
      const currency = projection?.currency === "USD" ? "USD" : "CNY";
      const knownCurrency = projection?.currency === "USD" || projection?.currency === "CNY";
      const totalCost = knownCurrency && typeof projection.totalCost === "number" ? projection.totalCost : 0;
      const costSuffix = totalCost > 0 ? t("badge.cost", {symbol: CURRENCY_SYMBOLS[currency], amount: totalCost.toFixed(2)}) : "";
      const tip = badgeTooltip(current?.model, period, currency, t);
      const label = (isOther ? t("badge.other") : t("badge." + period)
        + t("badge.next", {countdown: formatCountdown(nextTransitionInMinutes(now))})) + costSuffix;
      const neutral = isOther;
      const [hovered, setHovered] = import_react.default.useState(false);
      const [tooltipPos, setTooltipPos] = import_react.default.useState(null);
      const showTooltip = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltipPos({ top: rect.bottom + 6, left: rect.left });
        setHovered(true);
      };
      return import_react.default.createElement(import_react.default.Fragment, null, import_react.default.createElement("span", {
        style: { position: "relative", display: "inline-flex" },
        onMouseEnter: showTooltip,
        onMouseLeave: () => setHovered(false)
      },
        import_react.default.createElement("span", {
          className: "dsh-peak-indicator-badge",
          "aria-label": tip,
          tabIndex: 0,
          onFocus: showTooltip,
          onBlur: () => setHovered(false),
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
              role: "tooltip",
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
                whiteSpace: "pre-line",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.28)",
                pointerEvents: "none"
              }
            }, tip)
          : null
      ), balance ? import_react.default.createElement(BalanceBadge, {t, balance, provider: current?.provider}) : null);
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
      if (projection.currency !== "CNY" && projection.currency !== "USD") return null;
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
      }, t("turn.cost", {symbol: CURRENCY_SYMBOLS[projection.currency], amount: cost.toFixed(2)}));
    }

    var inject = ["slots", "locale", "modelDirectories"];
    function apply(ctx) {
      const balance = createBalanceStore();
      ctx.effect(() => () => balance.dispose(), "peak-indicator: balance store");
      ctx.inject(["remote", "remote.account"], accountCtx => {
        accountCtx.effect(() => balance.connect(accountCtx.remote, () => ({
          version: "0.2.1-rc.2", locale: ctx.locale.getSnapshot().active,
          timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60
        })), "peak-indicator: account balance");
      });
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
              balance,
              directory: directory.store,
              load: () => directory.load().catch(() => {})
            };
          } catch {
            return { directory: null, balance };
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
