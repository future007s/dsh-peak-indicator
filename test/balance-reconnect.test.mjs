import test from 'node:test';
import assert from 'node:assert/strict';
import {createBalanceStore} from '../lib/balance.js';

const wallet=(balance,currency='CNY')=>({balance,currency});
const ready=(value=[],bonusWallets=[])=>({status:'ready',value,bonusWallets});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** One logical account stream the test drives frame by frame. */
function controlledStream(){
  let wake, closed=false, queue=[];
  return {
    dispose(){closed=true;wake?.()},
    frame(status){queue.push({value:{status},accept(){}});wake?.()},
    end(){closed=true;wake?.()},
    async *[Symbol.asyncIterator](){
      while(!closed){
        if(!queue.length)await new Promise(resolve=>{wake=resolve});
        if(queue.length)yield queue.shift();
      }
    },
  };
}

function fixture({throwOnOpen=0,reconnectDelays=[1]}={}){
  const streams=[];let opens=0,reads=0;
  const remote={
    $stream(){
      opens++;
      if(throwOnOpen>0){throwOnOpen--;throw new Error('account stream unavailable')}
      const stream=controlledStream();streams.push(stream);return stream;
    },
    account:{getBalance:async()=>{reads++;return{ok:true,value:ready([wallet('12.34')],[wallet('0.01')])}}},
  };
  const store=createBalanceStore({reconnectDelays});
  const stop=store.connect(remote,()=>({version:'0.2.1-rc.5',locale:'ru',timezoneOffsetSeconds:10800}));
  return {store,stop,streams,remote,get opens(){return opens},get reads(){return reads}};
}

test('a terminated account stream reconnects and restores the balance',async()=>{
  const f=fixture();
  try{
    f.streams[0].frame('credential-stored');await wait(5);
    assert.equal(f.store.getSnapshot().status,'ready');
    assert.equal(f.store.getSnapshot().total,'¥12.35');
    assert.equal(f.reads,1);

    // The logical stream ends (a Host restart, a Client recompose, a transport
    // hiccup). The badge must not latch "unavailable": the store retries.
    f.streams[0].end();await tick();await wait(30);
    assert.equal(f.store.getSnapshot().status,'unavailable');
    assert.equal(f.opens,2);

    f.streams[1].frame('credential-stored');await wait(5);
    assert.equal(f.store.getSnapshot().status,'ready');
    assert.equal(f.store.getSnapshot().total,'¥12.35');
    assert.equal(f.reads,2);
  }finally{f.stop();f.store.dispose()}
});

test('a throw from the stream opener is retried instead of latching unavailable',async()=>{
  const f=fixture({throwOnOpen:1});
  try{
    assert.equal(f.store.getSnapshot().status,'unavailable');
    assert.equal(f.opens,1);
    await wait(30);
    assert.equal(f.opens,2);
    f.streams[0].frame('credential-stored');await wait(5);
    assert.equal(f.store.getSnapshot().status,'ready');
  }finally{f.stop();f.store.dispose()}
});

test('the retry delay grows until a frame arrives',async()=>{
  const f=fixture({throwOnOpen:2,reconnectDelays:[1,60]});
  try{
    // Attempt 1 fails now, attempt 2 fails after ~1ms, attempt 3 opens.
    await wait(5);
    assert.equal(f.opens,2);
    await wait(80);
    assert.equal(f.opens,3);
    f.streams[0].frame('credential-stored');await wait(5);
    assert.equal(f.store.getSnapshot().status,'ready');
  }finally{f.stop();f.store.dispose()}
});

test('reconnect() opens a fresh stream immediately from the unavailable state',async()=>{
  const f=fixture({reconnectDelays:[60000]});
  try{
    f.streams[0].frame('credential-stored');await wait(5);
    f.streams[0].end();await tick();await tick();
    assert.equal(f.store.getSnapshot().status,'unavailable');
    assert.equal(f.opens,1);

    f.store.reconnect();
    assert.equal(f.opens,2);
    f.streams[1].frame('credential-stored');await wait(5);
    assert.equal(f.store.getSnapshot().status,'ready');
  }finally{f.stop();f.store.dispose()}
});

test('stopping the connection cancels a pending retry',async()=>{
  const f=fixture({reconnectDelays:[50]});
  try{
    f.streams[0].end();await tick();await tick();
    assert.equal(f.store.getSnapshot().status,'unavailable');
    f.stop();await wait(90);
    assert.equal(f.opens,1);
  }finally{f.store.dispose()}
});

test('disposing the store cancels a pending retry',async()=>{
  const f=fixture({reconnectDelays:[50]});
  try{
    f.streams[0].end();await tick();await tick();
    f.store.dispose();await wait(90);
    assert.equal(f.opens,1);
  }finally{f.stop();f.store.dispose()}
});

test('reconnecting before connect() is a harmless no-op',()=>{
  const store=createBalanceStore();
  store.reconnect();
  assert.deepEqual(store.getSnapshot(),{status:'unavailable'});
  store.dispose();
});
