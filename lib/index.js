// dsh-peak-indicator host plugin.
//
// Provides:
//  1. The `peakCost` session projection (key "peakCost") that replays the
//     session log and accumulates actual token usage into costs, priced with
//     the price list in effect at each event's own timestamp: the USD-only flat legacy
//     DeepSeek prices before 2026-08-17, the V4 peak/off-peak price list from
//     2026-08-17, and the V4.1-Flash price list from 2026-09-10 onward.
//  2. Pure helpers (currentPeriod, periodAt, priceFor, ...) exported for the
//     browser half and the test suite.
//
// Policy (official DeepSeek price page):
//   before 2026-08-17: USD-only flat legacy prices; CNY requires explicit overrides
//   from   2026-08-17: peak = Beijing 09:00-12:00 and 14:00-18:00
//                      offpeak = every other minute, billed at half the peak price
//   from   2026-08-23: Saturday and Sunday (Beijing time) are off-peak all day
//   from   2026-09-10 12:00 Beijing: V4.1-Flash prices apply to Flash aliases
import z from "@deepseek-ai/schemastery";
import { z as zod } from "zod";

import {
  DEFAULT_PEAK_WINDOWS, BEIJING_OFFSET_MINUTES, OFF_PEAK_DISCOUNT,
  LEGACY_PRICES, MODEL_PRICES, OTHER_MODEL_PRICES, CHINA_HOLIDAY_DATES,
  beijingMinutes, beijingDay, billingPeriod as currentPeriod, isDeepseekModel,
  periodAt, effectiveNewPrices, priceFor, resolveModelPrice
} from "./pricing.js";

/** Host configuration: all fields optional; policy defaults track the official announcement. */
const Config = z.object({
  currency: z.union([z.const("CNY"), z.const("USD")]).default("CNY"),
  peakWindows: z.array(z.tuple([z.number(), z.number()])).default(DEFAULT_PEAK_WINDOWS),
  beijingOffsetMinutes: z.number().default(BEIJING_OFFSET_MINUTES),
  offPeakDiscount: z.number().default(OFF_PEAK_DISCOUNT),
  policyEffectiveDate: z.string().default("2026-08-17T00:00:00+08:00"),
  weekendOffPeakEffectiveDate: z.string().default("2026-08-23T00:00:00+08:00"),
  v41FlashEffectiveDate: z.string().default("2026-09-10T12:00:00+08:00"),
  holidayDates: z.array(z.string()).default(CHINA_HOLIDAY_DATES),
  prices: z.dict(z.object({
    input: z.number(),
    output: z.number(),
    cacheHitInput: z.number()
  })).default({}),
  pricesCny: z.dict(z.object({
    input: z.number(),
    output: z.number(),
    cacheHitInput: z.number()
  })).default({})
});

/** Projection value schema (validated by the session-projection registry). */
const projectionSchema = zod.object({
  currency: zod.string(),
  totalCost: zod.number().nonnegative(),
  byModel: zod.record(zod.string(), zod.object({
    uncachedInputTokens: zod.number().int().nonnegative(),
    outputTokens: zod.number().int().nonnegative(),
    cacheReadTokens: zod.number().int().nonnegative(),
    cacheWriteTokens: zod.number().int().nonnegative(),
    cost: zod.number().nonnegative()
  }).strict()),
  messageCosts: zod.record(zod.string(), zod.object({
    provider: zod.string(),
    model: zod.string(),
    turn: zod.number().int().nonnegative(),
    period: zod.string(),
    cost: zod.number().nonnegative()
  }).strict())
}).strict();

/** Internal fold state persisted by the session-projection cache. */
const projectionStateSchema = zod.object({
  provider: zod.string().nullable(),
  model: zod.string().nullable(),
  byModel: zod.record(zod.string(), zod.object({
    uncachedInputTokens: zod.number().int().nonnegative(),
    outputTokens: zod.number().int().nonnegative(),
    cacheReadTokens: zod.number().int().nonnegative(),
    cacheWriteTokens: zod.number().int().nonnegative(),
    cost: zod.number().nonnegative()
  }).strict()),
  messageCosts: zod.record(zod.string(), zod.object({
    provider: zod.string(),
    model: zod.string(),
    turn: zod.number().int().nonnegative(),
    period: zod.string(),
    cost: zod.number().nonnegative()
  }).strict()),
  last: zod.object({
    turn: zod.number().int().nonnegative(),
    step: zod.number().int().nonnegative(),
    buckets: zod.object({
      uncachedInputTokens: zod.number().int().nonnegative(),
      outputTokens: zod.number().int().nonnegative(),
      cacheReadTokens: zod.number().int().nonnegative(),
      cacheWriteTokens: zod.number().int().nonnegative()
    }).strict()
  }).strict().nullable()
}).strict();

/** Selected-currency cost for a usage record at the given per-1M prices. */
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
  const currency = config.currency ?? "CNY";
  const stateSchema = projectionStateSchema.extend({currency: zod.literal(currency)}).strict();
  const viewSchema = projectionSchema.extend({currency: zod.literal(currency)}).strict();
  return {
    key: "peakCost",
    // Kept for DSH releases that used the pre-rc.2 projection field name.
    schema: viewSchema,
    stateSchema,
    init: () => ({
      currency,
      provider: null,
      model: null,
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
              period,
              cost
            }
          }
        } : {}
      };
    },
    wire: {
      viewSchema,
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
          currency: state.currency,
          totalCost,
          byModel,
          messageCosts: state.messageCosts
        };
      }
    },
    // Kept as a read-side alias for older DSH releases and the pure-fold test
    // harness. rc.2 uses wire.view above.
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
        currency: state.currency,
        totalCost,
        byModel,
        messageCosts: state.messageCosts
      };
    },
    // rc.2 requires explicit internal-state and wire schemas. Bump so old
    // cache rows are never treated as valid under the new projection contract.
    stateVersion: currency === "CNY" ? 8 : 7
  };
}

var name = "peak-indicator";
// Pricing is observational: no Loader, token-meter, compaction or agent hooks.
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
  OTHER_MODEL_PRICES,
  beijingMinutes,
  beijingDay,
  createPeakCostProjection,
  currentPeriod,
  effectiveNewPrices,
  isDeepseekModel,
  periodAt,
  plugin as default,
  priceFor,
  resolveModelPrice
};
