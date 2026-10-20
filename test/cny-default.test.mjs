import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {Config, createPeakCostProjection} from '../lib/index.js';
import {priceFor, modelPrices} from '../lib/pricing.js';
const peak=Date.parse('2026-10-20T09:00:00+08:00');
const cfg=extra=>Config['~standard'].validate(extra??{}).value;
function fold(config, time=peak, model='deepseek-flash') {
 const unit=createPeakCostProjection(config);
 let state=unit.apply(unit.init(),{type:'request/header',data:{header:{config:{provider:'deepseek-official',model}}}});
 state=unit.apply(state,{type:'assistant/message',time,data:{turn:1,step:1,message:{id:'m'},usage:{inputTokens:1000000,outputTokens:1000000,cacheReadTokens:500000}}});
 return {unit,state,view:unit.wire.view(state)};
}

test('default session and per-message charges use CNY token rates, not a relabelled USD total',()=>{
 const config=cfg();assert.equal(config.currency,'CNY');
 const {view,unit,state}=fold(config);
 assert.equal(view.currency,'CNY');assert.ok(Math.abs(view.totalCost-10.02)<1e-12);
 assert.ok(Math.abs(view.messageCosts.m.cost-10.02)<1e-12);
 assert.equal(view.byModel['deepseek-official/deepseek-flash'].cost,view.totalCost);
 assert.equal(unit.stateSchema.parse(JSON.parse(JSON.stringify(state))).currency,'CNY');
 assert.deepEqual(modelPrices('deepseek-flash','peak'),{input:2,output:8,cacheHitInput:0.04});
});

test('CNY peak, off-peak, Pro and historical V4 rates replay in their original price windows',()=>{
 assert.ok(Math.abs(fold(cfg(),Date.parse('2026-10-20T13:00:00+08:00')).view.totalCost-5.01)<1e-12);
 assert.ok(Math.abs(fold(cfg(),peak,'DeepSeek-V4-Pro-0813').view.totalCost-36.15)<1e-12);
 assert.ok(Math.abs(fold(cfg(),Date.parse('2026-08-17T09:00:00+08:00')).view.totalCost-12.05)<1e-12);
 assert.equal(priceFor('deepseek-flash','peak',Date.parse('2026-08-16T09:00:00+08:00'),cfg()),null);
});

test('explicit USD remains USD and currency-specific caches cannot be accepted as the other currency',()=>{
 const cny=fold(cfg()),usd=fold(cfg({currency:'USD'}));
 assert.equal(usd.view.currency,'USD');assert.ok(Math.abs(usd.view.totalCost-1.503)<1e-12);
 assert.notEqual(cny.unit.stateVersion,usd.unit.stateVersion);
 assert.equal(cny.unit.stateSchema.safeParse(usd.state).success,false);
 assert.equal(cny.unit.wire.viewSchema.safeParse(usd.view).success,false);
 assert.equal(usd.unit.stateSchema.safeParse(cny.state).success,false);
});

test('legacy USD overrides do not become CNY; CNY overrides require pricesCny',()=>{
 const legacy=cfg({prices:{'deepseek-flash':{input:99,output:99,cacheHitInput:99}}});
 assert.deepEqual(priceFor('deepseek-v4-flash','peak',peak,legacy),{input:2,output:8,cacheHitInput:0.04});
 const custom=cfg({pricesCny:{'deepseek-flash':{input:4,output:10,cacheHitInput:0.2},'my-model':{input:1,output:3,cacheHitInput:0}}});
 assert.deepEqual(priceFor('deepseek-v4.1-flash-1017','peak',peak,custom),{input:4,output:10,cacheHitInput:0.2});
 assert.deepEqual(priceFor('my-model','offpeak',peak,custom),{input:1,output:3,cacheHitInput:0});
});

test('the browser tooltip uses three short CNY lines, without duplicated USD or billing paragraphs',()=>{
 let client;
 vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>{client=d.factory(createRequire(import.meta.url));}}},Date,setInterval,clearInterval});
 const t=(key,args={})=>(client.zh[key]??key).replace(/\{(\w+)\}/g,(_,name)=>args[name]??'');
 const tip=client.badgeTooltip('DeepSeek-V4.1-Flash-1017','offpeak','CNY',t);
 assert.equal(tip.split('\n').length,3);assert.ok(tip.length<120);
 assert.match(tip,/输入 ¥1 · 输出 ¥4 · 缓存 ¥0.02/);
 assert.doesNotMatch(tip,/\$|美元|2026-11|目前免费|北京时间/);
 assert.match(t('turn.cost',{symbol:'¥',amount:'5.01'}),/本轮 ¥5.01/);
});
