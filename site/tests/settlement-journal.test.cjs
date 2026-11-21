"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {fromResponse,save,read,forRead,clear,normalized}=require("../lib/settlement-journal");
const now=Date.now();
const start=new Date(now-720000).toISOString(),end=new Date(now-420000).toISOString();
const slug="cpc-btc-updown-5m-verified-test";
const id="m1";
const observation={
  symbol:"BTC/USD",intervalMinutes:5,
  observedAt:new Date(now-600000).toISOString(),
  contract:{venue:"us",id,slug,intervalMinutes:5,target:56421.22,startsAt:start,endsAt:end}
};
const body={
  state:"VERIFIED_UP",outcome:"UP",settlement:1,
  checkedAt:new Date(now).toISOString(),
  market:{id,slug,interval:5,target:56421.22,startsAt:start,endsAt:end}
};
function store(){
  const mem=new Map();
  return {getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
}
test("verified settlement joins only with the exact known contract",()=>{
  const result=fromResponse(body,observation);
  assert.ok(result);assert.equal(result.outcome,"UP");
  assert.equal(fromResponse(body,{...observation,contract:{...observation.contract,slug:"other-market"}}),null);
  assert.equal(fromResponse(body,{...observation,contract:{...observation.contract,target:3}}),null);
  assert.equal(fromResponse(body,{...observation,contract:{...observation.contract,endsAt:new Date(now-120000).toISOString()}}),null);
});
test("settlement evidence stored independently from original chart observation",()=>{
  const db=store(),result=fromResponse(body,observation);
  const original=JSON.stringify(observation);
  assert.equal(save(result,observation,db).saved,true);
  assert.equal(forRead(observation,db).outcome,"UP");
  assert.equal(read(db).length,1);
  assert.equal(JSON.stringify(observation),original);
  assert.equal(save(result,observation,db).saved,true);
  assert.equal(read(db).length,1);
  assert.equal(clear(db),true);
  assert.equal(forRead(observation,db),null);
});
test("blocks results claiming a future checked time and non-binary mislabeling",()=>{
  const record=fromResponse(body,observation);
  assert.equal(normalized({...record,checkedAt:new Date(now+60000).toISOString()}),null);
  assert.equal(normalized({...record,state:"VERIFIED_UP",settlement:0}),null);
  assert.equal(normalized({...record,state:"NON_BINARY_SETTLEMENT",outcome:"UP",settlement:0.5}),null);
  const nonbinary=fromResponse({...body,state:"NON_BINARY_SETTLEMENT",outcome:null,settlement:0.5},observation);
  assert.equal(nonbinary.outcome,null);
  assert.equal(nonbinary.state,"NON_BINARY_SETTLEMENT");
});
test("never joins a settlement to a chart read without timely verified market context",()=>{
  const result=fromResponse(body,observation);
  assert.equal(save(result,{...observation,contract:null},store()).saved,false);
  assert.equal(fromResponse(body,{...observation,symbol:"SPY"}),null);
  assert.equal(fromResponse(body,{...observation,observedAt:new Date(now).toISOString()}),null);
});
