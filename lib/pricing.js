// Official snapshot checked 2026-10-19. Prices are per 1M tokens.
// USD: https://api-docs.deepseek.com/quick_start/pricing/
// CNY: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
// Model version: https://api-docs.deepseek.com/zh-cn/updates/
export const PRICING_CHECKED_AT = "2026-10-19";
export const DEFAULT_PEAK_WINDOWS = [[9, 12], [14, 18]];
export const BEIJING_OFFSET_MINUTES = 480;
export const OFF_PEAK_DISCOUNT = 0.5;
export const LEGACY_PRICES = {
  "deepseek-flash": { input: 1.0, output: 2.0, cacheHitInput: 0.02 },
  "deepseek-v4-flash": { input: 1.0, output: 2.0, cacheHitInput: 0.02 },
  "deepseek-v4-flash-vision-exp": { input: 1.0, output: 2.0, cacheHitInput: 0.02 },
  "deepseek-v4-pro": { input: 3.0, output: 6.0, cacheHitInput: 0.025 }
};
export const V4_MODEL_PRICES = {
  "deepseek-flash": { input: 0.44, output: 1.32, cacheHitInput: 0.014 },
  "deepseek-v4-flash": { input: 0.44, output: 1.32, cacheHitInput: 0.014 },
  "deepseek-v4-flash-vision-exp": { input: 0.44, output: 1.32, cacheHitInput: 0.014 },
  "deepseek-v4-pro": { input: 1.32, output: 3.96, cacheHitInput: 0.044 }
};
export const MODEL_PRICES = {
  "deepseek-flash": { input: 0.30, output: 1.20, cacheHitInput: 0.006 },
  "deepseek-v4-flash": { input: 0.30, output: 1.20, cacheHitInput: 0.006 },
  "deepseek-v4-flash-vision-exp": { input: 0.30, output: 1.20, cacheHitInput: 0.006 },
  "deepseek-v4-pro": { input: 1.32, output: 3.96, cacheHitInput: 0.044 }
};
export const MODEL_PRICES_CNY = {
  "deepseek-flash": {input: 2, output: 8, cacheHitInput: 0.04},
  "deepseek-v4-pro": {input: 9, output: 27, cacheHitInput: 0.30}
};
// No cross-provider CNY estimates in a USD projection. Supply config.prices
// explicitly in USD for non-DeepSeek routes instead.
export const OTHER_MODEL_PRICES = {};
export const SEARCH_FETCH_PRICING = {
  usdPerSuccessfulRequest: 0.00075,
  cnyPerSuccessfulRequest: 0.005,
  serverToolsBillFrom: "2026-11-01T00:00:00+08:00"
};
// Official published 2026 holiday breaks (including announced days off).
// https://www.gov.cn/zhengce/content/202511/content_7047090.htm
// Weekend make-up workdays stay off-peak: DeepSeek explicitly excludes weekends.
export const HOLIDAY_YEARS = [2026];
export const CHINA_HOLIDAY_DATES = [
  ["2026-01-01", "2026-01-03"], ["2026-02-15", "2026-02-23"],
  ["2026-04-04", "2026-04-06"], ["2026-05-01", "2026-05-05"],
  ["2026-06-19", "2026-06-21"], ["2026-09-25", "2026-09-27"],
  ["2026-10-01", "2026-10-07"]
].flatMap(([start, end]) => {
  const days = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));
  return days;
});
export const DEFAULT_POLICY = {
  peakWindows: DEFAULT_PEAK_WINDOWS,
  offPeakDiscount: OFF_PEAK_DISCOUNT,
  policyEffectiveDate: "2026-08-17T00:00:00+08:00",
  weekendOffPeakEffectiveDate: "2026-08-23T00:00:00+08:00",
  v41FlashEffectiveDate: "2026-09-10T12:00:00+08:00",
  holidayDates: CHINA_HOLIDAY_DATES,
  prices: {}
};
export function beijingMinutes(now) {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + BEIJING_OFFSET_MINUTES) % 1440;
}
export function beijingDay(now) {
  return new Date(now.getTime() + BEIJING_OFFSET_MINUTES * 60000).getUTCDay();
}
export function beijingDate(now) {
  return new Date(now.getTime() + BEIJING_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
}
export function canonicalModelId(model) {
  const m = String(model ?? "").toLowerCase();
  if (/^deepseek-(?:flash(?:-\d{4})?|v4\.1-flash(?:-\d{4})?|v4-flash(?:-vision-exp|-\d{4})?)$/.test(m)) return "deepseek-flash";
  if (/^deepseek-v4-pro(?:-\d{4})?$/.test(m)) return "deepseek-v4-pro";
  return null;
}
export function modelDisplayName(model) {
  const id = canonicalModelId(model);
  return id === "deepseek-flash" ? "DeepSeek-V4.1-Flash-1017" : id === "deepseek-v4-pro" ? "DeepSeek-V4-Pro-0813" : String(model ?? "");
}
export function isDeepseekModel(provider, model) {
  return String(provider ?? "").toLowerCase().includes("deepseek") && canonicalModelId(model) !== null;
}
export function billingPeriod(now = new Date(), config = DEFAULT_POLICY) {
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
export function periodAt(timeMs, config = DEFAULT_POLICY) {
  return billingPeriod(new Date(timeMs), config).period;
}
export function resolveModelPrice(model, table) {
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
export function effectiveNewPrices(config) { return {...MODEL_PRICES, ...config.prices}; }
export function priceFor(model, period, timeMs, config = DEFAULT_POLICY) {
  const isDS = canonicalModelId(model) !== null;
  if (!isDS) return resolveModelPrice(model, config.prices ?? {});
  if (timeMs < Date.parse(config.policyEffectiveDate)) return resolveModelPrice(model, LEGACY_PRICES);
  const table = timeMs >= Date.parse(config.v41FlashEffectiveDate) ? MODEL_PRICES : V4_MODEL_PRICES;
  const price = resolveModelPrice(model, {...table, ...config.prices});
  if (price === null) return null;
  const factor = period === "offpeak" ? config.offPeakDiscount : 1;
  return {input: price.input * factor, output: price.output * factor, cacheHitInput: price.cacheHitInput * factor};
}
export function modelPrices(model, period, currency = "USD") {
  if (currency === "USD") return priceFor(model, period, Date.now());
  const price = MODEL_PRICES_CNY[canonicalModelId(model)];
  if (!price) return null;
  const factor = period === "offpeak" ? OFF_PEAK_DISCOUNT : 1;
  return {input: price.input * factor, output: price.output * factor, cacheHitInput: price.cacheHitInput * factor};
}
export function nextTransitionInMinutes(now = new Date(), config = DEFAULT_POLICY) {
  const origin = Math.floor(now.getTime() / 60000) * 60000;
  const midnight = Date.parse(beijingDate(now) + "T00:00:00+08:00");
  const boundaries = [...new Set([0, ...config.peakWindows.flat().map(x => x * 60)])].sort((a,b) => a-b);
  for (let day = 0; day <= 370; day++) for (const minutes of boundaries) {
    const t = midnight + day * 86400000 + minutes * 60000;
    if (t > origin && periodAt(t - 1, config) !== periodAt(t, config)) return (t - origin) / 60000;
  }
  return null;
}
export function formatPrice(value) { return String(Math.round(value * 1e4) / 1e4); }
export function formatBeijingClock(now) {
  const bj = beijingMinutes(now);
  return `${String(Math.floor(bj / 60)).padStart(2, "0")}:${String(bj % 60).padStart(2, "0")}`;
}
export function formatCountdown(minutes) {
  if (minutes === null) return "—";
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours === 0 ? `${rest} 分钟` : `${hours} 小时 ${rest} 分钟`;
}
