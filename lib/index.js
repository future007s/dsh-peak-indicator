// dsh-peak-indicator host plugin.
// Provides the `peakIndicator` service: given a moment in time, report whether
// the DeepSeek API is currently in its peak (高峰) or off-peak (闲时) billing
// window, per the official DeepSeek peak/off-peak pricing scheme effective
// 2026-08-17 00:00 Beijing time:
//   peak    = Beijing 09:00-12:00 and 14:00-18:00
//   offpeak = every other minute, billed at half the peak price
// The browser half (lib/client.js) shows the badge in the conversation header;
// it hardcodes the same policy so it works with zero configuration.
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";

/** Default peak windows, Beijing hours (start inclusive, end exclusive). */
const DEFAULT_PEAK_WINDOWS = [[9, 12], [14, 18]];
/** Beijing is UTC+8, no DST. */
const BEIJING_OFFSET_MINUTES = 8 * 60;
/** Off-peak price ratio vs. peak. */
const OFF_PEAK_DISCOUNT = 0.5;

/** Host configuration: all fields optional, policy defaults track the official announcement. */
const Config = z.object({
  peakWindows: z.array(z.tuple([z.number(), z.number()])).default(DEFAULT_PEAK_WINDOWS),
  beijingOffsetMinutes: z.number().default(BEIJING_OFFSET_MINUTES),
  offPeakDiscount: z.number().default(OFF_PEAK_DISCOUNT),
  policyEffectiveDate: z.string().default("2026-08-17T00:00:00+08:00")
});

/** Minutes since Beijing midnight for `now`. */
function beijingMinutes(now) {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + BEIJING_OFFSET_MINUTES) % 1440;
}

/**
 * Resolve the billing period for a moment in time.
 * @param now - the moment to evaluate.
 * @param config - effective plugin config.
 * @returns period ("peak" | "offpeak") plus the Beijing minute of day.
 */
function currentPeriod(now, config) {
  const bj = beijingMinutes(now);
  const peak = config.peakWindows.some(([startHour, endHour]) => bj >= startHour * 60 && bj < endHour * 60);
  return { period: peak ? "peak" : "offpeak", beijingMinutes: bj };
}

/**
 * Owns the DeepSeek billing-period readout.
 * @service peakIndicator
 */
var PeakIndicator = class extends Service {
  static Config = Config;
  config;
  constructor(ctx, config) {
    super(ctx, "peakIndicator");
    this.config = config;
  }
  /**
   * Current billing period.
   * @param now - evaluation moment, defaults to now.
   */
  current(now = new Date()) {
    return currentPeriod(now, this.config);
  }
};

export { BEIJING_OFFSET_MINUTES, Config, DEFAULT_PEAK_WINDOWS, OFF_PEAK_DISCOUNT, PeakIndicator, beijingMinutes, currentPeriod };
export default PeakIndicator;
