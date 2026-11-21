"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {clean,record,read,clear,csv,KEY,LIMIT}=require("../lib/read-journal");

function store(){
  const values=new Map();
  return {
    getItem:key=>values.get(key)||null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key)
  };
}
function snapshot(overrides={}){
  const now=Date.now();
  const votes=[1,1,1,1,0,0,0,0].map((dir,i)=>({name:"Check "+(i+1),dir}));
  return {
    version:1,symbol:"BTC/USD",intervalMinutes:5,feedSource:"KRAKEN",
    observedAt:new Date(now-10000).toISOString(),
    candleClosedAt:new Date(now-90000).toISOString(),
    closePrice:56000.25,score:4,bias:"BULLISH",votes,
    ema:{"9":55998,"20":55990,"50":55920,"200":55300},
    ...overrides
  };
}
test("accepts a fresh verified-source chart read without inventing outcomes",()=>{
  const row=clean(snapshot());
  assert.equal(row.type,"observed_chart_read");
  assert.equal(row.ema[200],55300);
  assert.equal(row.contract,null);
  assert.equal(row.outcome,null);
  assert.equal(row.trade,null);
  assert.equal(row.calibratedProbability,null);
});
test("saves one read per actual candle per symbol and interval",()=>{
  const db=store();
  const r=snapshot();
  assert.equal(record(r,db).saved,true);
  assert.equal(record({...r,observedAt:new Date(Date.now()-1000).toISOString()},db).reason,"already_recorded");
  assert.equal(read(db).length,1);
  assert.equal(read(db)[0].score,4);
  assert.equal(clear(db),true);
  assert.equal(read(db).length,0);
});
test("rejects demo, invalid source, malformed factors, stale or future chart",()=>{
  const r=snapshot();
  assert.equal(clean({...r,feedSource:"PRACTICE"}),null);
  assert.equal(clean({...r,feedSource:"FAKE"}),null);
  assert.equal(clean({...r,score:5}),null);
  assert.equal(clean({...r,votes:r.votes.slice(0,6)}),null);
  assert.equal(clean({...r,observedAt:new Date(Date.now()-13*60000).toISOString()}),null);
  assert.equal(clean({...r,observedAt:new Date(Date.now()+30000).toISOString()}),null);
  const past=new Date(Date.now()-10*60000).toISOString();
  assert.equal(clean({...r,candleClosedAt:past}),null);
});
test("15-minute chart still accepts a completed candle ten minutes later",()=>{
  const r=snapshot({
    intervalMinutes:15,
    candleClosedAt:new Date(Date.now()-10*60000).toISOString()
  });
  assert.notEqual(clean(r),null);
});
test("includes verified contract identity but never stale or future quotes",()=>{
  const r=snapshot();
  const now=Date.now();
  const base={venue:"us",id:"2739886",slug:"cpc-btc-updown-5m-verified",
    intervalMinutes:5,target:56421.11,
    startsAt:new Date(now-120000).toISOString(),
    endsAt:new Date(now+180000).toISOString(),
    upAsk:0.56,downAsk:0.46,
    quoteCheckedAt:new Date(now-12000).toISOString()};
  const ok=clean({...r,contract:base});
  assert.equal(ok.contract.id,"2739886");
  assert.equal(ok.contract.quote.upAsk,0.56);
  assert.equal(ok.contract.quote.downAsk,0.46);
  const localDb=store();
  assert.equal(record({...r,contract:base},localDb).saved,true);
  const restored=read(localDb)[0];
  assert.equal(restored.contract.quote.upAsk,0.56);
  assert.equal(restored.contract.quote.downAsk,0.46);
  const stale=clean({...r,contract:{...base,quoteCheckedAt:new Date(now-30000).toISOString()}});
  assert.equal(stale.contract.quote,undefined);
  const invalid=clean({...r,contract:{...base,id:"=IMPORTXML('x')"}});
  assert.equal(invalid.contract,null);
  const wrong=clean({...r,contract:{...base,intervalMinutes:15}});
  assert.equal(wrong.contract,null);
});
test("CSV is explicit about unverified outcomes and contains only validated rows",()=>{
  const r=clean(snapshot());
  const output=csv([r,{untrusted:"hello"}]);
  assert.match(output,/NOT_VERIFIED/);
  assert.match(output,/NO_TRADE_DATA/);
  assert.equal(output.split("\r\n").filter(Boolean).length,2);
});
test("caps stored history at 150 most recent observations",()=>{
  const db=store();
  const records=Array.from({length:LIMIT+6},(_,i)=>{
    const observed=Date.now()-i*5*60000;
    return snapshot({
      observedAt:new Date(observed).toISOString(),
      candleClosedAt:new Date(observed-30000).toISOString(),
      closePrice:56000+i,
    });
  }).reverse();
  for(const item of records)assert.equal(record(item,db).saved,true);
  assert.equal(read(db).length,LIMIT);
  assert.equal(read(db)[0].closePrice,56000);
});
