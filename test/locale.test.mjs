import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(){let client;vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>{client=d.factory(require)}}},Date,setInterval,clearInterval});return client;}
const client=load();
const CN_DESCRIPTION='DeepSeek 峰谷时段、人民币 Token 费用估算与账户余额 for DSH Web / Desktop';

function fallbackTranslate(localeId){
 const chain=[localeId,'en'];
 return (key)=>{
  for(const id of chain){const dict=client[id];if(dict&&Object.prototype.hasOwnProperty.call(dict,key))return dict[key];}
  return key;
 };
}

test('zh dictionary is the upstream Chinese copy',()=>{
 assert.equal(client.zh['badge.peak'],'⚡ 高峰');
 assert.equal(client.zh['badge.offpeak'],'🌙 闲时');
 assert.equal(client.zh['badge.next'],' · {countdown} 后切换');
 assert.equal(client.zh['unit.hour'],'小时');
 assert.equal(client.zh['unit.minute'],'分钟');
});

test('ru dictionary covers every key with Russian copy',()=>{
 assert.equal(Object.keys(client.ru).length,Object.keys(client.en).length);
 assert.equal(client.ru['badge.peak'],'⚡ Пик');
 assert.equal(client.ru['badge.offpeak'],'🌙 Вне пика');
 assert.equal(client.ru['unit.hour'],'ч');
 assert.equal(client.ru['unit.minute'],'мин');
 for(const key of Object.keys(client.en))assert.ok(typeof client.ru[key]==='string'&&client.ru[key].length>0,key);
});

test('translation follows the active language; unknown languages fall back to en',()=>{
 assert.equal(fallbackTranslate('zh')('badge.offpeak'),'🌙 闲时');
 assert.equal(fallbackTranslate('ru')('badge.offpeak'),'🌙 Вне пика');
 assert.equal(fallbackTranslate('en')('badge.offpeak'),'🌙 Off-peak');
 assert.equal(fallbackTranslate('ko')('badge.offpeak'),'🌙 Off-peak');
 assert.equal(fallbackTranslate('ja')('badge.peak'),'⚡ Peak');
});

test('countdown keeps the upstream Chinese wording for zh and localizes others',()=>{
 const zh=fallbackTranslate('zh'),ru=fallbackTranslate('ru'),en=fallbackTranslate('en'),ko=fallbackTranslate('ko');
 assert.equal(client.formatCountdown(644,zh),'10 小时 44 分钟');
 assert.equal(client.formatCountdown(45,zh),'45 分钟');
 assert.equal(client.formatCountdown(644,ru),'10 ч 44 мин');
 assert.equal(client.formatCountdown(644,en),'10 h 44 min');
 assert.equal(client.formatCountdown(644,ko),'10 h 44 min');
 assert.equal(client.formatCountdown(null,ru),'—');
});

test('apply registers zh, en and ru dictionaries and tolerates an already-owned locale',()=>{
 const registrations=[];
 const locale={getSnapshot:()=>({active:'zh'}),register:(ns,id,dict)=>{registrations.push({ns,id,dict});return()=>{};}};
 const ctx={locale,effect:fn=>fn(),inject(){},slots:{inject(){}}};
 client.apply(ctx);
 assert.deepEqual(registrations.map(r=>[r.ns,r.id]),[['peakIndicator','zh'],['peakIndicator','en'],['peakIndicator','ru']]);
 assert.equal(registrations[2].dict['badge.peak'],'⚡ Пик');
 const tolerant={getSnapshot:()=>({active:'zh'}),register:(ns,id)=>{if(id==='ru')throw new Error('locale namespace "peakIndicator" already has locale "ru"');return()=>{};}};
 const tolerantCtx={locale:tolerant,effect:fn=>fn(),inject(){},slots:{inject(){}}};
 assert.doesNotThrow(()=>client.apply(tolerantCtx));
});

test('the package one-liner is Russian only while ru is active',()=>{
 class FakeLocale{
  constructor(){this.active='ru';}
  getSnapshot(){return {active:this.active};}
  register(){return()=>{};}
  resolveText(text){return text;}
 }
 const locale=new FakeLocale();
 const ctx={locale,effect:fn=>fn(),inject(){},slots:{inject(){}}};
 client.apply(ctx);
 assert.match(locale.resolveText(CN_DESCRIPTION),/Пиковые и непиковые часы/);
 locale.active='zh';
 assert.equal(locale.resolveText(CN_DESCRIPTION),CN_DESCRIPTION);
 locale.active='en';
 assert.equal(locale.resolveText(CN_DESCRIPTION),CN_DESCRIPTION);
});
