"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {PALETTE,series}=require("../lib/ema");

test("LFGI EMA colors are exact and chart-period specific",()=>{
  assert.deepEqual({...PALETTE},{9:"#22C55E",20:"#FACC15",50:"#F97316",200:"#EF4444"});
  assert.equal(Object.isFrozen(PALETTE),true);
});
test("EMA uses previous result and does not peek into future closes",()=>{
  const prices=[10,13,19,15,16,18];
  const calculated=series(prices,2);
  assert.equal(calculated[0],10);
  assert.ok(Math.abs(calculated[1]-12)<1e-10);
  assert.ok(Math.abs(calculated[2]-16.666666666666668)<1e-10);
  assert.deepEqual(series(prices.slice(0,4),2),calculated.slice(0,4));
});
test("constant price has constant EMA for every LFGI period",()=>{
  for(const span of [9,20,50,200])assert.ok(series(Array(320).fill(100),span).every(v=>v===100));
});
test("invalid prices and invalid EMA periods fail closed",()=>{
  for(const values of [[],[1,NaN],[0,2],[-2,5],[1,"2"],null])
    assert.throws(()=>series(values,9),TypeError);
  for(const span of [0,-1,2.5,"9",null])assert.throws(()=>series([1,2],span),TypeError);
});
test("chart includes all four actual calculated lines, not legend only",()=>{
  const script=fs.readFileSync(path.join(__dirname,"../app.js"),"utf8");
  const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
  assert.match(script,/e200=emaSeries\(c,200\)/);
  assert.match(script,/return \{score,bias,votes,support,resistance,rsi,e9,e20,e50,e200/);
  assert.match(script,/\[a\.e200,colors\.ema200\]/);
  for(const span of [9,20,50,200])assert.ok(html.includes('class="leg-ema'+span+'"'));
  assert.ok(html.indexOf("/lib/ema.js")<html.indexOf("/app.js"));
});
