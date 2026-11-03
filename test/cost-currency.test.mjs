import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(){let client;vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>{client=d.factory(require)}}},Date,setInterval,clearInterval});return client;}
const client=load();
const t=(key,args={})=>(client.en[key]??key).replace(/\{(\w+)\}/g,(_,name)=>args[name]??'');
const valueStore=value=>({getSnapshot:()=>value,subscribe:()=>()=>{},refresh:async()=>{}});
const walletStore=currency=>({getSnapshot:()=>currency,subscribe:()=>()=>{}});
const directory=valueStore({status:'ready',current:{provider:'deepseek-official',model:'deepseek-flash'}});
const primary={currency:'CNY',totalCost:1.1,byModel:{},messageCosts:{m1:{provider:'deepseek-official',model:'deepseek-flash',turn:1,period:'peak',cost:1.1}}};
const alternate={currency:'USD',totalCost:2.2,byModel:{},messageCosts:{m1:{provider:'deepseek-official',model:'deepseek-flash',turn:1,period:'peak',cost:2.2}}};
function useProjection(key){return {'peakCost':primary,'peakCostAlt':alternate,'modelSelection':{next:{provider:'deepseek-official',model:'deepseek-flash'},lastUsed:null}}[key];}
function badge(currency){return renderToStaticMarkup(React.createElement(client.PeakBadge,{t,directory,load:()=>{},useProjection,balance:valueStore({status:'unavailable'}),currency:walletStore(currency)}));}
test('the badge picks the projection that matches the funded wallet currency',()=>{
 const usd=badge('USD');
 assert.match(usd,/\$2\.20/);
 assert.doesNotMatch(usd,/¥1\.10/);
 const cny=badge('CNY');
 assert.match(cny,/¥1\.10/);
 assert.doesNotMatch(cny,/\$2\.20/);
 const unknown=badge(undefined);
 assert.match(unknown,/¥1\.10/);
});
test('the per-turn chip follows the same wallet currency',()=>{
 const chip=currency=>renderToStaticMarkup(React.createElement(client.TurnCost,{messageId:'m1',useProjection,t,currency:walletStore(currency)}));
 assert.match(chip('USD'),/\$2\.20/);
 assert.doesNotMatch(chip('USD'),/¥1\.10/);
 assert.match(chip('CNY'),/¥1\.10/);
 assert.match(chip(undefined),/¥1\.10/);
});
