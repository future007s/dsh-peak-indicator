import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {Config, createPeakCostProjection} from '../lib/index.js';
import {billingPeriod, priceFor, modelPrices, modelDisplayName, canonicalModelId, nextTransitionInMinutes, SEARCH_FETCH_PRICING} from '../lib/pricing.js';
const config=Config['~standard'].validate({}).value;
const peak=Date.parse('2026-10-19T01:00:00Z');
const require=createRequire(import.meta.url);
let client;
vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js', import.meta.url),'utf8'),{
  window:{__ModuleLoader__:{load:definition=>{client=definition.factory(require);}}}, Date, setInterval, clearInterval
});

test('official current API IDs, dated names and retired Flash aliases use the published USD rates',()=>{
  for(const model of ['deepseek-flash','deepseek-v4-flash','deepseek-v4-flash-vision-exp','deepseek-v4.1-flash','DeepSeek-V4.1-Flash-1017']) {
    assert.equal(canonicalModelId(model),'deepseek-flash');
    assert.equal(modelDisplayName(model),'DeepSeek-V4.1-Flash-1017');
    assert.deepEqual(priceFor(model,'peak',peak,config),{input:0.3,output:1.2,cacheHitInput:0.006});
    assert.deepEqual(priceFor(model,'offpeak',peak,config),{input:0.15,output:0.6,cacheHitInput:0.003});
    assert.deepEqual(JSON.parse(JSON.stringify(client.modelPrices(model,'peak'))),{input:0.3,output:1.2,cacheHitInput:0.006});
  }
  assert.equal(modelDisplayName('DeepSeek-V4-Pro-0813'),'DeepSeek-V4-Pro-0813');
  assert.deepEqual(priceFor('DeepSeek-V4-Pro-0813','peak',peak,config),{input:1.32,output:3.96,cacheHitInput:0.044});
  assert.deepEqual(priceFor('deepseek-v4-pro','offpeak',peak,config),{input:0.66,output:1.98,cacheHitInput:0.022});
});

test('CNY reference rates are the official CNY schedule, not a conversion of USD',()=>{
  assert.deepEqual(modelPrices('deepseek-flash','peak','CNY'),{input:2,output:8,cacheHitInput:0.04});
  assert.deepEqual(modelPrices('deepseek-flash','offpeak','CNY'),{input:1,output:4,cacheHitInput:0.02});
  assert.deepEqual(modelPrices('deepseek-v4-pro','peak','CNY'),{input:9,output:27,cacheHitInput:0.3});
  assert.deepEqual(modelPrices('deepseek-v4-pro','offpeak','CNY'),{input:4.5,output:13.5,cacheHitInput:0.15});
});

test('holidays and weekend makeup workdays are off-peak in both Host and browser',()=>{
  for(const iso of ['2026-09-25T01:00:00Z','2026-10-01T01:00:00Z','2026-10-07T07:00:00Z','2026-10-10T01:00:00Z']) {
    const now=new Date(iso);
    assert.equal(billingPeriod(now,config).period,'offpeak');
    assert.equal(client.currentPeriod(now),'offpeak');
  }
  const thursday=new Date('2026-10-08T01:00:00Z');
  assert.equal(billingPeriod(thursday,config).period,'peak');
  assert.equal(client.currentPeriod(thursday),'peak');
});

test('countdown skips the full National Day break and resumes at the next actual peak boundary',()=>{
  const holiday=new Date('2026-10-01T02:00:00Z');
  assert.equal(nextTransitionInMinutes(holiday),10020);
  assert.equal(client.nextTransitionInMinutes(holiday),10020);
  assert.equal(nextTransitionInMinutes(new Date('2026-10-08T00:59:59Z')),1);
});

test('unknown routes and old CNY guesses cannot contaminate a USD session total',()=>{
  assert.equal(priceFor('gpt-4o','peak',peak,config),null);
  assert.equal(priceFor('deepseek-imaginary-pro','peak',peak,config),null);
  assert.equal(client.modelPrices('gpt-4o','peak'),null);
  const unit=createPeakCostProjection(config);
  let state=unit.apply(unit.init(),{type:'request/header',data:{header:{config:{provider:'openai',model:'gpt-4o'}}}});
  state=unit.apply(state,{type:'assistant/message',time:peak,data:{turn:1,step:1,message:{id:'m'},usage:{inputTokens:1000000,outputTokens:1000000}}});
  assert.equal(unit.wire.view(state).totalCost,0);
  assert.deepEqual(unit.wire.view(state).byModel,{});
});

test('Search and Fetch request metadata keeps its own billing date and does not join token cost',()=>{
  assert.equal(SEARCH_FETCH_PRICING.usdPerSuccessfulRequest,0.00075);
  assert.equal(SEARCH_FETCH_PRICING.cnyPerSuccessfulRequest,0.005);
  assert.equal(Date.parse(SEARCH_FETCH_PRICING.serverToolsBillFrom),Date.parse('2026-10-31T16:00:00Z'));
  assert.match(client.zh['tip.toolsBilled'],/不包含/);
});
