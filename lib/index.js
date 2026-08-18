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
/**
 * Approximate flat prices per 1M tokens (CNY) for common non-DeepSeek models.
 * These are best-effort public rates — override or add models via the plugin
 * `config.prices` (any model id). Non-DeepSeek models have no peak/off-peak.
 */
const OTHER_MODEL_PRICES = {
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
  })).default({}),
  /**
   * Auto-compaction cost guard: maps a context budget onto the compaction
   * service's trigger threshold so long sessions compact early (cheaper
   * cache re-reads), and logs the estimated savings. Off by default.
   */
  autoCompact: z.object({
    enabled: z.boolean().default(false),
    /** Compact when the session context exceeds this many tokens. */
    contextBudget: z.number().default(100000),
    /** Recent tokens kept after a compaction (delegated to the service). */
    retainTokens: z.number().default(15000),
    /** Model context window used to derive the trigger ratio. */
    referenceWindow: z.number().default(256000),
    logSavings: z.boolean().default(true)
  }).default({})
});

/**
 * Map a token budget onto the compaction service's trigger ratio
 * (threshold = contextWindow * ratio), clamped to a sane range.
 */
function compactionRatioForBudget(budgetTokens, referenceWindow) {
  const ratio = budgetTokens / Math.max(1, referenceWindow);
  return Math.min(0.9, Math.max(0.05, ratio));
}

/**
 * Estimated per-step savings (CNY) of removing `removedTokens` from the
 * context: those tokens would otherwise be re-sent (uncached) on every
 * following step, priced at the model's input rate.
 */
function estimateCompactSavings(removedTokens, price) {
  return (removedTokens * (price?.input ?? 0)) / 1e6;
}

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

/** Whether a model id is a DeepSeek flash/pro model (peak/off-peak applies). */
function isDeepseekModel(provider, model) {
  const p = String(provider ?? "").toLowerCase();
  const m = String(model ?? "").toLowerCase();
  return p.includes("deepseek") && (m.includes("flash") || m.includes("pro"));
}

/**
 * Resolve a price entry for a model id in a table: exact id first, then the
 * longest prefix (handles dated variants like gpt-4o-2024-08-06), then the
 * DeepSeek suffix alias ("deepseek-v4-flash" -> "flash"). Null when unknown.
 */
function resolveModelPrice(model, table) {
  const m = String(model ?? "").toLowerCase();
  if (m.length === 0) return null;
  if (table[m] !== void 0) return table[m];
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (m.startsWith(key)) return table[key];
  }
  for (const key of keys) {
    const alias = key.replace("deepseek-v4-", "");
    if (alias !== key && m.includes(alias)) return table[key];
  }
  return null;
}

/** New-scheme (2026-08-17+) DeepSeek price table with user overrides applied. */
function effectiveNewPrices(config) {
  return { ...MODEL_PRICES, ...config.prices };
}

/**
 * Effective input/output/cache-hit prices per 1M tokens for a model at a
 * moment in time:
 *   DeepSeek flash/pro: flat legacy table before the policy effective date,
 *   then the peak/off-peak table (window factor applied).
 *   Any other model: flat price from the other-model table (no peak/off-peak).
 */
function priceFor(model, period, timeMs, config) {
  const m = String(model ?? "").toLowerCase();
  const isDS = m.includes("deepseek") && (m.includes("flash") || m.includes("pro"));
  if (isDS) {
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
  return resolveModelPrice(model, { ...OTHER_MODEL_PRICES, ...config.prices });
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
    period: zod.string(),
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
              period,
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
    stateVersion: 3
  };
}

var name = "peak-indicator";
var inject = ["sessionProjections", "compaction", "tokenMeter"];
function apply(ctx, config) {
  ctx.sessionProjections.register(createPeakCostProjection(config));
  const ac = config.autoCompact;
  if (!ac.enabled) return;
  const engine = ctx.compaction;
  if (engine !== void 0 && engine.config !== void 0) {
    engine.config.thresholdRatio = compactionRatioForBudget(ac.contextBudget, ac.referenceWindow);
    if (ac.retainTokens > 0) engine.config.retainTokens = ac.retainTokens;
    ctx.logger?.info(`peak-indicator: auto-compact enabled — compact at ~${ac.contextBudget} tokens (ratio ${engine.config.thresholdRatio.toFixed(3)}), retain ~${engine.config.retainTokens}`);
  }
  /** Per-session compaction stats for the savings log. */
  const statsBySession = /* @__PURE__ */ new Map();
  ctx.on("agent/pre-step", async ({ agent }, next) => {
    try {
      const session = agent?.session;
      const meter = ctx.tokenMeter;
      if (session === void 0 || meter === void 0) return next();
      const total = meter.measure(session).totalTokens;
      const rec = statsBySession.get(session.id) ?? { lastTokens: void 0, compactCount: 0, removedTokens: 0, savedPerStep: 0 };
      if (typeof rec.lastTokens === "number" && total < rec.lastTokens - 1000) {
        const removed = rec.lastTokens - total;
        rec.compactCount += 1;
        rec.removedTokens += removed;
        const model = agent.options?.model;
        const provider = agent.options?.provider;
        const price = priceFor(model, periodAt(Date.now(), config), Date.now(), config);
        const perStep = estimateCompactSavings(removed, price);
        rec.savedPerStep += perStep;
        if (ac.logSavings) ctx.logger?.info(`peak-indicator: compaction detected — removed ~${removed.toLocaleString()} tokens (${rec.compactCount} total), ~¥${perStep.toFixed(4)} saved per following step`);
      }
      rec.lastTokens = total;
      statsBySession.set(session.id, rec);
    } catch (error) {
      ctx.logger?.warn(`peak-indicator: auto-compact tracking failed: ${error.message ?? error}`);
    }
    return next();
  });
  ctx.provide("peakCompactStats", {
    get: (sessionId) => statsBySession.get(sessionId)
  });
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
  compactionRatioForBudget,
  createPeakCostProjection,
  currentPeriod,
  effectiveNewPrices,
  estimateCompactSavings,
  isDeepseekModel,
  periodAt,
  plugin as default,
  priceFor,
  resolveModelPrice
};
