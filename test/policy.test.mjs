// Policy boundary tests for the DeepSeek peak/off-peak billing windows
// (Beijing 09:00-12:00 and 14:00-18:00 are peak; everything else is
// half-price off-peak). Run with: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { currentPeriod } from "../lib/index.js";
import { Config } from "../lib/index.js";

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
