import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Context} from '@deepseek-ai/cordis';
const require=createRequire(import.meta.url);
function load(){let client;vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>{client=d.factory(require)}}},Date,setInterval,clearInterval});return client;}
const client=load();
const t=(key,args={})=>(client.zh[key]??key).replace(/\{(\w+)\}/g,(_,k)=>args[k]??'');
const store=value=>({getSnapshot:()=>value,subscribe:()=>()=>{},refresh:async()=>{}});
const ready={status:'ready',total:'¥12.34',recharge:'¥10.00',bonus:'¥2.34'};
function header(provider,balance=store(ready)){
 return renderToStaticMarkup(React.createElement(client.PeakBadge,{t,balance,directory:store({status:'ready',current:null}),useProjection:key=>key==='peakCost'?{currency:'CNY',totalCost:0.28}:{next:provider?{provider,model:'deepseek-flash'}:null,lastUsed:null}}));
}
test('balance is a separate account-qualified badge after the peak badge',()=>{
 const html=header('deepseek-official');
 assert.match(html,/class="dsh-peak-indicator-header"/);
 assert.ok(html.indexOf('class="dsh-peak-indicator-balance"')>html.indexOf('class="dsh-peak-indicator-badge"'));
 assert.match(html,/账户余额 ¥12.34/);assert.match(html,/DSH 登录账户 · 充值 ¥10.00 · 赠金 ¥2.34/);
});
test('account balance remains visible on account, API-key, third-party and unknown routes',()=>{
 for(const provider of ['deepseek-account','deepseek-official','openai',undefined])assert.match(header(provider),/账户余额 ¥12.34/,String(provider));
});
test('loading, login, error and no-wallet states remain visible and do not invent zero balances',()=>{
 for(const [status,text]of [['loading','账户余额加载中…'],['signed-out','账户余额：未登录'],['failed','账户余额：读取失败'],['unavailable','账户余额：暂不可用'],['no-cny','账户余额：无人民币钱包']]){
  const html=header('deepseek-official',store({status}));
  assert.match(html,/dsh-peak-indicator-balance/);assert.ok(html.includes(text));assert.doesNotMatch(html,/¥0\.00/);
  if(status==='signed-out')assert.match(html,/请先在 DSH 设置中登录 DeepSeek 账户/);
 }
 const zero=header('deepseek-official',store({...ready,total:'¥0.00',recharge:'¥0.00',bonus:'¥0.00'}));assert.match(zero,/账户余额 ¥0.00/);
});
test('a missing balance service still renders an explicit badge',()=>{
 const html=renderToStaticMarkup(React.createElement(client.PeakBadge,{t,directory:null,useProjection:key=>key==='peakCost'?{currency:'CNY',totalCost:0.28}:undefined}));
 assert.match(html,/账户余额：暂不可用/);assert.match(html,/DSH 账户余额接口暂不可用/);
});
test('actual client apply connects the optional account RPC and exposes its balance to the header',async()=>{
 const ctx=new Context();const registrations=new Map();let finish,reads=0,metadata;
 const stream={async *[Symbol.asyncIterator](){yield{value:{status:'credential-stored'},accept(){}};await new Promise(resolve=>{finish=resolve})},dispose(){finish?.()}};
 const remote={account:{getBalance:async value=>{reads++;metadata=value;return{ok:true,value:{status:'ready',value:[{currency:'CNY',balance:'10'}],bonusWallets:[{currency:'CNY',balance:'2.34'}]}}}},$stream:()=>stream};
 try{
  await ctx.plugin({name:'balance-test-providers',apply(p){
   p.provide('slots',{inject:(_,fn)=>fn(),register:(options,component)=>{registrations.set(options.name,{options,component});return()=>{}}});
   p.provide('locale',{register:()=>()=>{},getSnapshot:()=>({active:'zh-CN'})});
   p.provide('modelDirectories',{directoryFor:()=>({store:store({current:{provider:'deepseek-official',model:'deepseek-flash'}}),load:async()=>{}})});
   p.provide('remote',remote);p.provide('remote.account',remote.account);
  }});
  const fiber=ctx.plugin({name:'balance-test-client',apply:client.apply,inject:client.inject});await fiber.await();
  await new Promise(resolve=>setImmediate(resolve));
  const props=registrations.get('conversation.session.header.actions').options.inject('fixture');
  assert.equal(props.balance.getSnapshot().status,'ready');assert.equal(props.balance.getSnapshot().total,'¥12.34');assert.equal(reads,1);
  assert.equal(metadata.version,'0.2.1-rc.2');assert.equal(metadata.locale,'zh-CN');
  const html=renderToStaticMarkup(React.createElement(registrations.get('conversation.session.header.actions').component,{...props,t,useProjection:key=>key==='peakCost'?{currency:'CNY',totalCost:0.28}:{next:{provider:'deepseek-official',model:'deepseek-flash'},lastUsed:null}}));
  assert.match(html,/账户余额 ¥12.34/);
 }finally{await ctx.fiber.dispose()}
});
