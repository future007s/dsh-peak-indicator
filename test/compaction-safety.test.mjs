import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {Context} from '@deepseek-ai/cordis';
import SessionStore from '@deepseek-ai/dsh-session';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import {BasicCompactionEngine} from '@deepseek-ai/dsh-compaction-basic';
import plugin, {Config} from '../lib/index.js';

const legacy={autoCompact:{enabled:true,contextBudget:100000,retainTokens:15000,referenceWindow:256000,logSavings:true}};

test('old autoCompact config still loads, while the default schema offers no compaction controls',()=>{
 const result=Config['~standard'].validate(legacy);
 assert.equal(result.issues,undefined);
 assert.equal(result.value.currency,'CNY');
 assert.equal(Config['~standard'].validate({}).value.autoCompact,undefined);
});

for(const auto of [true,false]) test(`mount, legacy config, reload and disposal preserve real official compaction policies (auto=${auto})`,async()=>{
 const ctx=new Context();let updates=0,enumerations=0;
 try{
  await ctx.plugin(SessionStore);await ctx.plugin(SessionProjectionRegistry);
  ctx.provide('llm',{});
  ctx.provide('tokenMeter',{measure(){throw Error('Pricing plugin must not infer compaction savings from token drops')}});
  const original={thresholdRatio:0.8,retainRatio:0.16,auto,modelPolicies:[
   {provider:'small',model:'32k',headroomTokens:1024,maxTokens:512},
   {provider:'openai',model:'272k',thresholdRatio:0.7,retainRatio:0.12},
   {provider:'deepseek-account',model:'deepseek-flash',thresholdRatio:0.8}
  ]};
  const engineFiber=ctx.plugin(BasicCompactionEngine,original);await engineFiber.await();
  const engine=ctx.compaction,config=engine.config,before=structuredClone(config);
  const entry={options:{name:'@deepseek-ai/dsh-compaction-basic',config:original},disabled:false,fiber:engineFiber,update:async()=>{updates++}};
  ctx.provide('loader',{*entries(){enumerations++;yield entry}});
  for(let i=0;i<2;i++){
   const fiber=ctx.plugin(plugin,legacy);await fiber.await();
   assert.equal(ctx.compaction.config,config);assert.equal(engine.config,config);
   assert.deepEqual(engine.config,before);assert.equal(entry.options.config,original);
   assert.equal(updates,0);assert.equal(enumerations,0);
   assert.equal(ctx.get('peakCompactStats'),undefined);
   const session=ctx.sessions.create();
   session.append('request/header',{header:{config:{provider:'deepseek-account',model:'deepseek-flash'}}});
   session.append('assistant/message',{turn:1,step:1,stream:[],message:{id:'m',role:'assistant',content:[{type:'text',text:'fixture'}]},usage:{inputTokens:100,outputTokens:100}},{surfaceOp:'append'});
   assert.ok(ctx.sessionProjections.snapshot(session).values.peakCost.totalCost>0);
   await fiber.dispose();
   assert.deepEqual(engine.config,before);assert.equal(entry.options.config,original);assert.equal(updates,0);
  }
 }finally{await ctx.fiber.dispose()}
});

test('browser registers only pricing slots and never requires or registers compaction settings',()=>{
 let client;vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{
  window:{__ModuleLoader__:{load:definition=>{client=definition.factory(createRequire(import.meta.url))}}},Date,setInterval,clearInterval
 });
 const slots=[],injections=[],disposals=[];
 const ctx={
  effect(fn){const dispose=fn();if(typeof dispose==='function')disposals.push(dispose)},
  inject(names){injections.push(...names)},
  locale:{register(){return()=>{}}},
  slots:{inject(name,fn){slots.push(name);fn()},register(){return()=>{}}}
 };
 client.apply(ctx);
 assert.deepEqual(slots,['conversation.session.header.actions','conversation.chat.assistant-actions']);
 assert.equal(Array.from(client.inject).includes('configForms'),false);
 assert.ok(injections.includes('remote.account'));
 for(const dispose of disposals.reverse())dispose();
});
