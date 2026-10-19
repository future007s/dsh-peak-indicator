import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Context } from '@deepseek-ai/cordis';
import { evaluatePluginCompatibility } from '@deepseek-ai/dsh-app-boot';
import SessionStore from '@deepseek-ai/dsh-session';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import plugin, { Config, createPeakCostProjection, installCompactionPolicy } from '../lib/index.js';

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
    ctx.provide('loader', { *entries() {} });
    ctx.provide('tokenMeter', { measure: () => ({totalTokens:0}) });
    const fiber = ctx.plugin(plugin, {autoCompact:{enabled:false}});
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

test('compaction policy preserves preset isolation, unrelated options and restores defaults when disabled', async () => {
  let ac = {enabled:true,contextBudget:100000,referenceWindow:256000,retainTokens:15000};
  const listeners = new Map();
  let updates = 0;
  const original = {thresholdRatio:0.8,retainRatio:0.16,headroomTokens:1234};
  const active = {options:{name:'@deepseek-ai/dsh-compaction-basic',config:original},disabled:false,fiber:{},update:async()=>{updates++;}};
  const disabled = {options:{name:'@deepseek-ai/dsh-compaction-basic'},disabled:true};
  const detached = {options:{name:'@deepseek-ai/dsh-compaction-basic',config:{maxTokens:1024}},disabled:false,fiber:{},update:async()=>{}};
  const ctx = {reflect:{store:{[Symbol('isolated-compaction')]:{name:'compaction',fiber:{entry:detached}}}},loader:{*entries(){yield active;yield disabled;}},on:(name,fn)=>listeners.set(name,fn),effect:()=>{}};
  await installCompactionPolicy(ctx,{autoCompact:{get:()=>ac}});
  assert.equal(active.options.config.thresholdRatio, 0.390625);
  assert.equal(active.options.config.retainTokens, 15000);
  assert.equal(active.options.config.headroomTokens, 1234);
  assert.equal(detached.options.config.retainTokens, 15000);
  assert.equal(detached.options.config.maxTokens, 1024);
  assert.equal('retainRatio' in active.options.config, false);
  assert.equal(disabled.options.config, undefined);
  const future = {options:{name:'@deepseek-ai/dsh-compaction-basic'},disabled:false};
  let continued=false;
  listeners.get('loader/patch-context')(future,()=>{continued=true;});
  assert.equal(continued, true);
  assert.equal(future.options.config.thresholdRatio, 0.390625);
  ac={...ac,enabled:false};
  await listeners.get('loader/volatile-update')();
  assert.equal(active.options.config, original);
  assert.deepEqual(detached.options.config, {maxTokens:1024});
  assert.equal(future.options.config, undefined);
  assert.ok(updates >= 2);
});
