import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function client(file=new URL('../lib/client.js',import.meta.url)){
 let result;vm.runInNewContext(fs.readFileSync(file,'utf8'),{window:{__ModuleLoader__:{load:d=>{result=d.factory(require)}}},Date,setInterval,clearInterval});return result;
}
function store(value){return{getSnapshot:()=>value,subscribe:()=>()=>{}}}
function render({directoryState={status:'error',current:null},selection={next:{provider:'deepseek-account',model:'deepseek-flash'},lastUsed:null}}={}){
 const mod=client();const queried=[];
 const t=(key,args={})=>(mod.zh[key]??key).replace(/\{(\w+)\}/g,(_,k)=>args[k]??'');
 const markup=renderToStaticMarkup(React.createElement(mod.PeakBadge,{t,directory:store(directoryState),useProjection:key=>{queried.push(key);return key==='modelSelection'?selection:{currency:'CNY',totalCost:0.28}},balance:{...store({status:'ready',total:'¥12.34',recharge:'¥10.00',bonus:'¥2.34'}),refresh:async()=>{}}}));
 return{markup,queried};
}
test('a known session model renders prices and account balance even if the advisory catalog fails',()=>{
 const {markup,queried}=render();
 assert.ok(queried.includes('modelSelection'),'must subscribe to the durable session model selection');
 assert.match(markup,/DeepSeek-V4.1-Flash-1017/);
 assert.match(markup,/输入 ¥[12] · 输出 ¥[48]/);
 assert.match(markup,/余额 ¥12.34/);
 assert.doesNotMatch(markup,/模型加载中|暂未取得模型单价/);
});
test('a new durable selection overrides a stale directory and last-used model',()=>{
 const {markup}=render({directoryState:{status:'ready',current:{provider:'deepseek-account',model:'deepseek-flash'}},selection:{next:{provider:'deepseek-official',model:'deepseek-v4-pro'},lastUsed:{provider:'deepseek-account',model:'deepseek-flash'}}});
 assert.match(markup,/DeepSeek-V4-Pro-0813/);assert.match(markup,/账户余额 ¥12.34/);
});
test('an unknown model after a catalog failure is unavailable, not permanently loading',()=>{
 const {markup}=render({selection:null});
 assert.doesNotMatch(markup,/模型加载中/);assert.match(markup,/当前模型暂不可用/);assert.match(markup,/账户余额 ¥12.34/);
});
test('a fresh session can still use the model directory default',()=>{
 const {markup}=render({directoryState:{status:'ready',current:{provider:'deepseek-account',model:'deepseek-flash'}},selection:{next:null,lastUsed:null}});
 assert.match(markup,/DeepSeek-V4.1-Flash-1017/);assert.match(markup,/余额 ¥12.34/);
});
