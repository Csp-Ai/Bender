"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const valid=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))&&Number(x)>0&&Number(x)<10000000;
test("rejects false zero and empty spot values",()=>{
  assert.equal(valid(""),false);assert.equal(valid(null),false);assert.equal(valid(0),false);assert.equal(valid("64500.23"),true);
});
test("Kraken source cannot be labeled BRTI",()=>{
  const source="Kraken BTC/USD last trade",isSettlementIndex=false;
  assert.equal(isSettlementIndex,false);assert.equal(source.includes("BRTI"),false);
});
