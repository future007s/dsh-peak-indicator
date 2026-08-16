// dsh-peak-indicator host plugin.
//
// Provides:
//  1. The `peakCost` session projection (key "peakCost") that replays the
//     session log and accumulates actual token usage into costs, priced with
//     the price list in effect at each event's own timestamp: the flat legacy
//     DeepSeek prices before 2026-08-17, and the peak/off-peak 2026-08-17
//     price list (with the window in effect at the event's time) from then on.
//  2. Pure helpers (currentPeriod, periodAt, priceFor, ...) exported for the
//     browser half and the test suite.
//
// Policy (official DeepSeek announcement, effective 2026-08-17 00:00 Beijing):
//   before 2026-08-17: flat legacy prices (no peak/off-peak)
//   from   2026-08-17: peak = Beijing 09:00-12:00 and 14:00-18:00
//                      offpeak = every other minute, billed at half the peak price
import z from "@deepseek-ai/schemastery";
import { z as zod } from "zod";

/** Default peak windows, Beijing hours (start inclusive, end exclusive). */
const DEFAULT_PEAK_WINDOWS = [[9, 12], [14, 18]];
/** Beijing is UTC+8, no DST. */
const BEIJING_OFFSET_MINUTES = 8 * 60;
/** Off-peak price ratio vs. peak. */
const OFF_PEAK_DISCOUNT = 0.5;
/** Flat legacy prices per 1M tokens (CNY) in effect before 2026-08-17. */
const LEGACY_PRICES = {
  "deepseek-v4-flash": { input: 1.0, output: 2.0, cacheHitInput: 0.02 },
  "deepseek-v4-pro": { input: 3.0, output: 6.0, cacheHitInput: 0.025 }
};
/** Peak prices per 1M tokens (CNY), DeepSeek official list effective 2026-08-17. */
const MODEL_PRICES = {
  "deepseek-v4-flash": { input: 3.0, output: 9.0, cacheHitInput: 0.1 },
  "deepseek-v4-pro": { input: 9.0, output: 27.0, cacheHitInput: 0.3 }
};

/** Host configuration: all fields optional; policy defaults track the official announcement. */
const Config = z.object({
  peakWindows: z.array(z.tuple([z.number(), z.number()])).default(DEFAULT_PEAK_WINDOWS),
  beijingOffsetMinutes: z.number().default(BEIJING_OFFSET_MINUTES),
  offPeakDiscount: z.number().default(OFF_PEAK_DISCOUNT),
  policyEffectiveDate: z.string().default("2026-08-17T00:00:00+08:00"),
  prices: z.dict(z.object({
    input: z.number(),
    output: z.number(),
    cacheHitInput: z.number()
  })).default({})
});

/** Minutes since Beijing midnight for `now`. */
function beijingMinutes(now) {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + BEIJING_OFFSET_MINUTES) % 1440;
}

/**
 * Resolve the billing period for a moment in time.
 * @returns period ("peak" | "offpeak") plus the Beijing minute of day.
 */
function currentPeriod(now, config) {
  const bj = beijingMinutes(now);
  const peak = config.peakWindows.some(([startHour, endHour]) => bj >= startHour * 60 && bj < endHour * 60);
  return { period: peak ? "peak" : "offpeak", beijingMinutes: bj };
}

/** Billing period at a Unix-millisecond timestamp. */
function periodAt(timeMs, config) {
  return currentPeriod(new Date(timeMs), config).period;
}

/** Peak price entry for a model id in a table, or null when unknown. */
function resolveModelPrice(model, table) {
  const m = String(model ?? "").toLowerCase();
  let entry = table[m];
  if (entry === void 0) {
    for (const [key, candidate] of Object.entries(table)) {
      if (m.includes(key.replace("deepseek-v4-", ""))) {
        entry = candidate;
        break;
      }
    }
  }
  return entry ?? null;
}

/** New-scheme (2026-08-17+) price table with user overrides applied. */
function effectiveNewPrices(config) {
  return { ...MODEL_PRICES, ...config.prices };
}

/**
 * Effective input/output/cache-hit prices per 1M tokens for a model at a
 * moment in time: the flat legacy table before the policy effective date,
 * and the peak/off-peak table (window factor applied) from then on.
 */
function priceFor(model, period, timeMs, config) {
  if (timeMs < Date.parse(config.policyEffectiveDate)) {
    return resolveModelPrice(model, LEGACY_PRICES);
  }
  const peak = resolveModelPrice(model, effectiveNewPrices(config));
  if (peak === null) return null;
  const factor = period === "offpeak" ? config.offPeakDiscount : 1;
  return {
    input: peak.input * factor,
    output: peak.output * factor,
    cacheHitInput: peak.cacheHitInput * factor
  };
}

/** Projection value schema (validated by the session-projection registry). */
const projectionSchema = zod.object({
  currency: zod.string(),
  totalCost: zod.number().nonnegative(),
  byModel: zod.record(zod.object({
    uncachedInputTokens: zod.number().int().nonnegative(),
    outputTokens: zod.number().int().nonnegative(),
    cacheReadTokens: zod.number().int().nonnegative(),
    cacheWriteTokens: zod.number().int().nonnegative(),
    cost: zod.number().nonnegative()
  }).strict()),
  messageCosts: zod.record(zod.object({
    provider: zod.string(),
    model: zod.string(),
    turn: zod.number().int().nonnegative(),
    cost: zod.number().nonnegative()
  }).strict())
}).strict();

/** CNY cost for a usage record at the given per-1M prices. */
function priceUsage(price, usage) {
  const input = price?.input ?? 0;
  const output = price?.output ?? 0;
  const cacheHitInput = price?.cacheHitInput ?? 0;
  return (usage.inputTokens * input + usage.outputTokens * output + (usage.cacheReadTokens ?? 0) * cacheHitInput) / 1e6;
}

/**
 * Create the "peakCost" session projection: replays request/header and usage
 * events, prices each event's tokens at the rates in effect at its own time,
 * and exposes the session total, per-model buckets and per-message costs.
 */
function createPeakCostProjection(config) {
  return {
    key: "peakCost",
    schema: projectionSchema,
    init: () => ({
      provider: void 0,
      model: void 0,
      byModel: {},
      messageCosts: {},
      last: null
    }),
    apply: (state, event) => {
      if (event.type === "request/header") {
        const headerConfig = event.data.header.config;
        if (typeof headerConfig !== "object" || headerConfig === null) return state;
        const provider = headerConfig.provider;
        const model = headerConfig.model;
        if (typeof provider !== "string" || typeof model !== "string" || provider.length === 0 || model.length === 0) return state;
        if (state.provider === provider && state.model === model) return state;
        return { ...state, provider, model };
      }
      let turn;
      let step;
      let usage;
      let messageId;
      if (event.type === "assistant/chunk" && event.data.chunk.type === "usage") {
        turn = event.data.turn;
        step = event.data.step;
        usage = event.data.chunk.usage;
      } else if (event.type === "assistant/message" && event.data.usage !== void 0) {
        turn = event.data.turn;
        step = event.data.step;
        usage = event.data.usage;
        messageId = event.data.message?.id;
      } else {
        return state;
      }
      const provider = state.provider;
      const model = state.model;
      const modelKey = typeof provider === "string" && typeof model === "string" ? `${provider}/${model}` : model ?? "unknown";
      const period = periodAt(event.time ?? Date.now(), config);
      const price = priceFor(model, period, event.time ?? Date.now(), config);
      if (price === null) return state;
      const cost = priceUsage(price, usage);
      const previous = state.last !== null && state.last.turn === turn && state.last.step === step ? state.last.buckets : void 0;
      const previousCost = previous === void 0 ? 0 : priceUsage(price, {
        inputTokens: previous.uncachedInputTokens,
        outputTokens: previous.outputTokens,
        cacheReadTokens: previous.cacheReadTokens,
        cacheWriteTokens: previous.cacheWriteTokens
      });
      const prior = state.byModel[modelKey];
      const nextBucket = {
        uncachedInputTokens: (prior?.uncachedInputTokens ?? 0) - (previous?.uncachedInputTokens ?? 0) + usage.inputTokens,
        outputTokens: (prior?.outputTokens ?? 0) - (previous?.outputTokens ?? 0) + usage.outputTokens,
        cacheReadTokens: (prior?.cacheReadTokens ?? 0) - (previous?.cacheReadTokens ?? 0) + (usage.cacheReadTokens ?? 0),
        cacheWriteTokens: (prior?.cacheWriteTokens ?? 0) - (previous?.cacheWriteTokens ?? 0) + (usage.cacheWriteTokens ?? 0),
        cost: Math.max(0, (prior?.cost ?? 0) - previousCost + cost)
      };
      return {
        ...state,
        last: {
          turn,
          step,
          buckets: {
            uncachedInputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens ?? 0,
            cacheWriteTokens: usage.cacheWriteTokens ?? 0
          }
        },
        byModel: {
          ...state.byModel,
          [modelKey]: nextBucket
        },
        ...messageId !== void 0 ? {
          messageCosts: {
            ...state.messageCosts,
            [messageId]: {
              provider,
              model,
              turn,
              cost
            }
          }
        } : {}
      };
    },
    view: (state) => {
      let totalCost = 0;
      const byModel = {};
      for (const [key, bucket] of Object.entries(state.byModel)) {
        byModel[key] = {
          uncachedInputTokens: bucket.uncachedInputTokens,
          outputTokens: bucket.outputTokens,
          cacheReadTokens: bucket.cacheReadTokens,
          cacheWriteTokens: bucket.cacheWriteTokens,
          cost: bucket.cost
        };
        totalCost += bucket.cost;
      }
      return {
        currency: "CNY",
        totalCost,
        byModel,
        messageCosts: state.messageCosts
      };
    },
    stateVersion: 2
  };
}

var name = "peak-indicator";
var inject = ["sessionProjections"];
function apply(ctx, config) {
  ctx.sessionProjections.register(createPeakCostProjection(config));
}
var plugin = { apply, inject, name, Config };

export {
  BEIJING_OFFSET_MINUTES,
  Config,
  DEFAULT_PEAK_WINDOWS,
  LEGACY_PRICES,
  MODEL_PRICES,
  OFF_PEAK_DISCOUNT,
  beijingMinutes,
  createPeakCostProjection,
  currentPeriod,
  effectiveNewPrices,
  periodAt,
  plugin as default,
  priceFor,
  resolveModelPrice
};
