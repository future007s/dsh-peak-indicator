import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeBalance, createBalanceStore} from '../lib/balance.js';
const wallet=(balance,currency='CNY')=>({balance,currency});
const ready=(value=[],bonusWallets=[])=>({status:'ready',value,bonusWallets});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(read) {
 let next, frames=[], closed=false;
 const stream={
  async *[Symbol.asyncIterator]() {while(!closed){if(!frames.length)await new Promise(resolve=>{next=resolve}); if(frames.length)yield frames.shift();}},
  dispose(){closed=true;next?.();}
 };
 const remote={$stream:()=>stream,account:{getBalance:read}};
 const store=createBalanceStore();const stop=store.connect(remote,()=>({version:'0.2.1-rc.2',locale:'zh-CN',timezoneOffsetSeconds:28800}));
 return {store,stop,frame(status){frames.push({value:{status},accept(){}});next?.();}};
}
test('account balance adds CNY recharge and bonus exactly, without adding USD wallets',()=>{
 assert.deepEqual(summarizeBalance(ready([wallet('1234.199999999999999999'),wallet('999','USD')],[wallet('.800000000000000001')])),{status:'ready',total:'¥1,235.00',recharge:'¥1,234.19',bonus:'¥0.80'});
 assert.equal(summarizeBalance(ready([wallet('0E-16')],[wallet('5.0000000000000000')])).total,'¥5.00');
 assert.equal(summarizeBalance(ready([wallet('1e-20')])).total,'<¥0.01');
 assert.equal(summarizeBalance(ready([wallet('-0.12')])).total,'-¥0.12');
});
test('zero, signed-out, failures and missing CNY wallets are different states',()=>{
 assert.equal(summarizeBalance(ready([wallet('0')])).total,'¥0.00');
 assert.equal(summarizeBalance(null).status,'signed-out');
 assert.equal(summarizeBalance({status:'failed'}).status,'failed');
 assert.equal(summarizeBalance(ready([wallet('8','USD')])).status,'no-cny');
 for(const amount of ['NaN','Infinity','private-secret','1e99999'])assert.equal(summarizeBalance(ready([wallet(amount)])).status,'failed');
});
test('balance reads are shared and refresh is explicit, with no calls after sign-out',async()=>{
 let calls=0,resolveRead; const f=fixture(()=>{calls++;return new Promise(resolve=>{resolveRead=resolve})});
 try {
  f.frame('credential-stored');await tick();
  const a=f.store.refresh(),b=f.store.refresh();assert.equal(a,b);assert.equal(calls,1);
  resolveRead({ok:true,value:ready([wallet('12.34')],[wallet('0.01')])});await a;
  assert.equal(f.store.getSnapshot().total,'¥12.35');
  f.frame('signed-out');await tick();assert.equal(f.store.getSnapshot().status,'signed-out');
  await f.store.refresh();assert.equal(calls,1);
 }finally{f.stop();f.store.dispose();}
});
test('late reads from a signed-out account cannot restore its private balance',async()=>{
 let resolveRead;const f=fixture(()=>new Promise(resolve=>{resolveRead=resolve}));
 try {
  f.frame('credential-stored');await tick();
  f.frame('signed-out');await tick();
  resolveRead({ok:true,value:ready([wallet('100')])});await tick();
  assert.deepEqual(f.store.getSnapshot(),{status:'signed-out'});
 }finally{f.stop();f.store.dispose();}
});
test('transport and server failures never manufacture a zero or keep an old amount',async()=>{
 let outcome={ok:true,value:ready([wallet('8')])};const f=fixture(async()=>{if(outcome instanceof Error)throw outcome;return outcome});
 try {
  f.frame('credential-stored');await tick();assert.equal(f.store.getSnapshot().total,'¥8.00');
  outcome={ok:false,error:'private-rpc-error'};await f.store.refresh();assert.deepEqual(f.store.getSnapshot(),{status:'failed'});
  outcome=new Error('offline');await f.store.refresh();assert.deepEqual(f.store.getSnapshot(),{status:'failed'});
  outcome={ok:true,value:null};await f.store.refresh();assert.deepEqual(f.store.getSnapshot(),{status:'signed-out'});
 }finally{f.stop();f.store.dispose();}
});
