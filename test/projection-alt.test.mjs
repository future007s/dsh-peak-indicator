import test from 'node:test';
import assert from 'node:assert/strict';
import plugin, { Config, createPeakCostProjection } from '../lib/index.js';

const config = values => Config['~standard'].validate(values).value;

test('the host registers both currency projections', () => {
  const registered = [];
  const ctx = { sessionProjections: { register(definition) { registered.push(definition); return () => {}; } } };
  plugin.apply(ctx, config({}));
  assert.deepEqual(registered.map(unit => unit.key), ['peakCost', 'peakCostAlt']);
  assert.deepEqual(registered.map(unit => unit.init().currency), ['CNY', 'USD']);
});

test('an explicit profile currency becomes the primary projection', () => {
  const registered = [];
  const ctx = { sessionProjections: { register(definition) { registered.push(definition); return () => {}; } } };
  plugin.apply(ctx, config({ currency: 'USD' }));
  assert.deepEqual(registered.map(unit => unit.init().currency), ['USD', 'CNY']);
});

test('a registry that refuses the alternate key keeps the primary projection working', () => {
  let calls = 0;
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => { warnings.push(args); };
  try {
    const ctx = { sessionProjections: { register() { calls += 1; if (calls === 2) throw new Error('registry full'); return () => {}; } } };
    assert.doesNotThrow(() => plugin.apply(ctx, config({})));
    assert.equal(calls, 2);
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('createPeakCostProjection keeps peakCost as its default key and accepts a custom one', () => {
  assert.equal(createPeakCostProjection(config({})).key, 'peakCost');
  assert.equal(createPeakCostProjection(config({}), 'peakCostAlt').key, 'peakCostAlt');
});
