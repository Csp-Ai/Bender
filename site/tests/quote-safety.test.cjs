"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {price,extract}=require("../lib/quote-safety");
const now=Date.now();
const snapshot=(offers={},last={})=>({
  checkedAt:new Date(now).toISOString(),quotes:offers,indicative:last
});
test("accepts only finite contract prices strictly between 0 and 1",()=>{
  for(const n of [.01,.57,.99])assert.equal(price(n),n);
  for(const n of [0,1,1.4,-.3,NaN,Infinity,-Infinity,null,undefined,".57",{},true])
    assert.equal(price(n),null);
});
test("normalizes independent valid up/down asks",()=>{
  assert.deepEqual(extract(snapshot({upAsk:.57,downAsk:.44}),now),{
    fresh:true,upAsk:.57,downAsk:.44,upLast:null,downLast:null
  });
});
test("malformed prices cannot appear as buy offers",()=>{
  const parsed=extract(snapshot({upAsk:1.4,downAsk:-.4},{upLast:1.2,downLast:0}),now);
  assert.equal(parsed.fresh,true);
  assert.equal(parsed.upAsk,null);
  assert.equal(parsed.downAsk,null);
  assert.equal(parsed.upLast,null);
  assert.equal(parsed.downLast,null);
});
test("rejects stale or future quote responses as a whole",()=>{
  const q=snapshot({upAsk:.58,downAsk:.43});
  assert.equal(extract({...q,checkedAt:new Date(now-30000).toISOString()},now).fresh,false);
  assert.equal(extract({...q,checkedAt:new Date(now+30000).toISOString()},now).fresh,false);
  assert.equal(extract({...q,checkedAt:"not-a-date"},now).fresh,false);
  assert.equal(extract({...q,checkedAt:null},now).fresh,false);
});
test("accepts only validated last trade context when actual asks are absent",()=>{
  const q=extract(snapshot({}, {upLast:.6,downLast:.4}),now);
  assert.equal(q.upAsk,null);
  assert.equal(q.downAsk,null);
  assert.equal(q.upLast,.6);
  assert.equal(q.downLast,.4);
});
