import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Context } from '@deepseek-ai/cordis';
import { evaluatePluginCompatibility } from '@deepseek-ai/dsh-app-boot';
import SessionStore from '@deepseek-ai/dsh-session';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import plugin, { Config, createPeakCostProjection } from '../lib/index.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));

test('rc.2 passes the official compatibility gate without exemptions; untested hosts are refused', () => {
  assert.equal(evaluatePluginCompatibility(manifest, {}, '0.2.1-rc.2'), undefined);
  for (const version of ['0.1.1-rc.2', '0.2.0-rc.2', '0.2.1-rc.1', '0.2.2-rc.1']) {
    assert.deepEqual(evaluatePluginCompatibility(manifest, {}, version).requirements, { 'engines.dsh': '0.2.1-rc.2' });
  }
});

test('Zod 4 validates populated projection state and wire views after JSON persistence', () => {
  const unit = createPeakCostProjection(Config['~standard'].validate({}).value);
  let state = unit.init();
  assert.deepEqual(unit.stateSchema.parse(JSON.parse(JSON.stringify(state))), state);
  state = unit.apply(state, { type:'request/header', data:{header:{config:{provider:'deepseek-official',model:'deepseek-flash'}}} });
  state = unit.apply(state, { type:'assistant/message', time:Date.parse('2026-10-19T01:00:00Z'), data:{turn:1,step:1,message:{id:'m1'},usage:{inputTokens:100,outputTokens:100,cacheReadTokens:50}} });
  const persisted = unit.stateSchema.parse(JSON.parse(JSON.stringify(state)));
  const wire = unit.wire.viewSchema.parse(unit.wire.view(persisted));
  assert.equal(wire.messageCosts.m1.model, 'deepseek-flash');
  assert.ok(wire.totalCost > 0);
  assert.equal(unit.wire.viewSchema.safeParse({...wire, byModel:{bad:{cost:'invalid'}}}).success, false);
});

test('official registry drives the plugin projection and removes it on plugin disposal', async () => {
  const ctx = new Context();
  try {
    await ctx.plugin(SessionStore);
    await ctx.plugin(SessionProjectionRegistry);
    const fiber = ctx.plugin(plugin, {});
    await fiber.await();
    const session = ctx.sessions.create();
    assert.equal(ctx.sessionProjections.snapshot(session).values.peakCost.totalCost, 0);
    session.append('request/header', {header:{config:{provider:'deepseek-official',model:'deepseek-flash'}}});
    session.append('assistant/message', {turn:1,step:1,stream:[],message:{id:'m1',role:'assistant',content:[{type:'text',text:'test'}]},usage:{inputTokens:100,outputTokens:100}}, {surfaceOp:'append'});
    assert.ok(ctx.sessionProjections.snapshot(session).values.peakCost.totalCost > 0);
    await fiber.dispose();
    assert.equal(ctx.sessionProjections.snapshot(session).values.peakCost, undefined);
  } finally { await ctx.fiber.dispose(); }
});
