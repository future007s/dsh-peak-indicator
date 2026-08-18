// Policy boundary tests for the DeepSeek peak/off-peak billing windows
// (Beijing 09:00-12:00 and 14:00-18:00 are peak; everything else is
// half-price off-peak). Run with: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { currentPeriod, Config } from "../lib/index.js";
import { createPeakCostProjection } from "../lib/index.js";

const config = Config["~standard"].validate({}).value;

function at(iso) {
  return new Date(iso);
}

test("peak windows (Beijing 09:00-12:00, 14:00-18:00)", () => {
  assert.equal(currentPeriod(at("2026-08-17T01:00:00Z"), config).period, "peak"); // 09:00 BJ, window start
  assert.equal(currentPeriod(at("2026-08-17T03:59:00Z"), config).period, "peak"); // 11:59 BJ
  assert.equal(currentPeriod(at("2026-08-17T04:00:00Z"), config).period, "offpeak"); // 12:00 BJ, window end (exclusive)
  assert.equal(currentPeriod(at("2026-08-17T06:00:00Z"), config).period, "peak"); // 14:00 BJ, window start
  assert.equal(currentPeriod(at("2026-08-17T09:59:00Z"), config).period, "peak"); // 17:59 BJ
  assert.equal(currentPeriod(at("2026-08-17T10:00:00Z"), config).period, "offpeak"); // 18:00 BJ, window end (exclusive)
});

test("off-peak outside the windows", () => {
  assert.equal(currentPeriod(at("2026-08-16T17:00:00Z"), config).period, "offpeak"); // 01:00 BJ
  assert.equal(currentPeriod(at("2026-08-17T05:00:00Z"), config).period, "offpeak"); // 13:00 BJ
  assert.equal(currentPeriod(at("2026-08-17T15:00:00Z"), config).period, "offpeak"); // 23:00 BJ
});

// ---- peakCost projection: real token usage priced at the rates in effect
// at each event's own timestamp (peak = 3x input / 9x output / 0.1 cache-hit
// per 1M tokens for flash; off-peak is half) ----

const PEAK_AT = "2026-08-17T01:00:00Z"; // 09:00 BJ 8/17 -> peak (new price list)
const OFFPEAK_AT = "2026-08-17T05:00:00Z"; // 13:00 BJ 8/17 -> off-peak (new price list)
const LEGACY_AT = "2026-08-16T10:00:00Z"; // 18:00 BJ 8/16 -> before the 8/17 policy: flat legacy prices

function runProjection(events) {
  const unit = createPeakCostProjection(config);
  let state = unit.init();
  for (const event of events) state = unit.apply(state, event);
  return { view: unit.view(state), state };
}

function headerEvent(provider, model) {
  return {
    type: "request/header",
    time: Date.parse(PEAK_AT),
    data: { header: { config: { provider, model } } }
  };
}

function messageEvent(time, turn, step, id, usage) {
  return {
    type: "assistant/message",
    time: Date.parse(time),
    data: { turn, step, message: { id }, usage }
  };
}

test("peakCost: flash 100 in + 100 out at peak prices to 0.0012 CNY", () => {
  const { view } = runProjection([
    headerEvent("deepseek-official", "deepseek-v4-flash"),
    messageEvent(PEAK_AT, 1, 1, "m1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })
  ]);
  assert.ok(Math.abs(view.totalCost - 0.0012) < 1e-9);
  assert.ok(Math.abs(view.messageCosts.m1.cost - 0.0012) < 1e-9);
  assert.equal(view.currency, "CNY");
});

test("peakCost: same usage at off-peak costs half (0.0006 CNY)", () => {
  const { view } = runProjection([
    headerEvent("deepseek-official", "deepseek-v4-flash"),
    messageEvent(OFFPEAK_AT, 1, 1, "m1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })
  ]);
  assert.ok(Math.abs(view.totalCost - 0.0006) < 1e-9);
});

test("peakCost: usage before 2026-08-17 is priced at flat legacy rates", () => {
  const { view } = runProjection([
    headerEvent("deepseek-official", "deepseek-v4-flash"),
    // legacy flat: input 1 / output 2 / cache-hit 0.02 per 1M, no off-peak discount
    messageEvent(LEGACY_AT, 1, 1, "m1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 1000, cacheWriteTokens: 0 })
  ]);
  // (100*1 + 100*2 + 1000*0.02)/1e6 = (100 + 200 + 20)/1e6 = 0.00032
  assert.ok(Math.abs(view.totalCost - 0.00032) < 1e-12);
  // same usage at legacy off-peak time (18:00 BJ would be off-peak under the new
  // scheme) must NOT be discounted: still 0.00032
  const legacyOffpeak = runProjection([
    headerEvent("deepseek-official", "deepseek-v4-flash"),
    messageEvent("2026-08-16T10:00:00Z", 1, 1, "m1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 1000, cacheWriteTokens: 0 })
  ]);
  assert.ok(Math.abs(legacyOffpeak.view.totalCost - 0.00032) < 1e-12);
});

test("peakCost: cache-read tokens priced at the cache-hit rate", () => {
  const { view } = runProjection([
    headerEvent("deepseek-official", "deepseek-v4-flash"),
    messageEvent(PEAK_AT, 1, 1, "m1", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 100, cacheWriteTokens: 0 })
  ]);
  // 100 x 0.1 / 1e6 = 0.00001
  assert.ok(Math.abs(view.totalCost - 1e-5) < 1e-12);
});

test("peakCost: chunk usage and message usage of the same turn are counted once", () => {
  const { view } = runProjection([
    headerEvent("deepseek-official", "deepseek-v4-flash"),
    { type: "assistant/chunk", time: Date.parse(PEAK_AT), data: { turn: 1, step: 1, chunk: { type: "usage", usage: { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 } } } },
    messageEvent(PEAK_AT, 1, 1, "m1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })
  ]);
  const bucket = view.byModel["deepseek-official/deepseek-v4-flash"];
  assert.equal(bucket.uncachedInputTokens, 100);
  assert.equal(bucket.outputTokens, 100);
  assert.ok(Math.abs(view.totalCost - 0.0012) < 1e-9);
});

test("peakCost: two turns accumulate, per-message costs stay separate", () => {
  const { view } = runProjection([
    headerEvent("deepseek-official", "deepseek-v4-pro"),
    messageEvent(PEAK_AT, 1, 1, "m1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }),
    messageEvent(OFFPEAK_AT, 2, 1, "m2", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })
  ]);
  // pro peak: (100*9 + 100*27)/1e6 = 0.0036 ; pro off-peak: (100*4.5 + 100*13.5)/1e6 = 0.0018
  assert.ok(Math.abs(view.messageCosts.m1.cost - 0.0036) < 1e-9);
  assert.ok(Math.abs(view.messageCosts.m2.cost - 0.0018) < 1e-9);
  assert.ok(Math.abs(view.totalCost - 0.0054) < 1e-9);
});

test("peakCost: per-message entries carry the owning turn for client-side turn aggregation", () => {
  const { view } = runProjection([
    headerEvent("deepseek-official", "deepseek-v4-flash"),
    messageEvent(PEAK_AT, 7, 1, "s1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }),
    messageEvent(PEAK_AT, 7, 2, "s2", { inputTokens: 50, outputTokens: 25, cacheReadTokens: 0, cacheWriteTokens: 0 })
  ]);
  assert.equal(view.messageCosts.s1.turn, 7);
  assert.equal(view.messageCosts.s2.turn, 7);
  // both steps of turn 7: 0.0012 + (50*3 + 25*9)/1e6 = 0.0012 + 0.000375 = 0.001575
  const turn7Total = Object.values(view.messageCosts).filter((e) => e.turn === 7).reduce((a, e) => a + e.cost, 0);
  assert.ok(Math.abs(turn7Total - 0.001575) < 1e-9);
  assert.ok(Math.abs(view.totalCost - 0.001575) < 1e-9);
});

test("peakCost: non-DeepSeek models priced flat with no peak/off-peak discount", () => {
  const { view } = runProjection([
    headerEvent("openai", "gpt-4o"),
    messageEvent(PEAK_AT, 1, 1, "m1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }),
    messageEvent(OFFPEAK_AT, 2, 1, "m2", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })
  ]);
  // gpt-4o flat: (100*18 + 100*72)/1e6 = 0.009; identical at peak and off-peak times
  assert.ok(Math.abs(view.messageCosts.m1.cost - 0.009) < 1e-12);
  assert.ok(Math.abs(view.messageCosts.m2.cost - 0.009) < 1e-12);
  assert.ok(Math.abs(view.totalCost - 0.018) < 1e-12);
});

test("peakCost: custom model priced via config.prices", () => {
  const cfg = Config["~standard"].validate({
    prices: { "acme-large": { input: 5, output: 10, cacheHitInput: 1 } }
  }).value;
  const unit = createPeakCostProjection(cfg);
  let state = unit.init();
  state = unit.apply(state, { type: "request/header", time: Date.parse(PEAK_AT), data: { header: { config: { provider: "acme", model: "acme-large" } } } });
  state = unit.apply(state, messageEvent(PEAK_AT, 1, 1, "m1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }));
  const view = unit.view(state);
  // (100*5 + 100*10)/1e6 = 0.0015
  assert.ok(Math.abs(view.totalCost - 0.0015) < 1e-12);
});


test("peakCost: each message records the period of its own timestamp", () => {
  const { view } = runProjection([
    headerEvent("deepseek-official", "deepseek-v4-flash"),
    messageEvent(PEAK_AT, 1, 1, "m1", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }),
    messageEvent(OFFPEAK_AT, 2, 1, "m2", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }),
    messageEvent(LEGACY_AT, 3, 1, "m3", { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 })
  ]);
  assert.equal(view.messageCosts.m1.period, "peak");
  assert.equal(view.messageCosts.m2.period, "offpeak");
  assert.equal(view.messageCosts.m3.period, "offpeak"); // 18:00 BJ window is off-peak, even under legacy flat pricing
});
