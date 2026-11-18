"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {assess,regularStockHours}=require("../lib/candle-time");
const z=x=>Date.parse(x);
test("5-minute candle timestamp means opening, so close is 5 minutes later",()=>{
  const info=assess(z("2026-11-18T07:10:00Z")/1000,5,z("2026-11-18T07:20:00Z"));
  assert.equal(new Date(info.closeMs).toISOString(),"2026-11-18T07:15:00.000Z");
  assert.equal(info.status,"FRESH");
});
test("5-minute chart warns when one new completed candle is missing",()=>{
  const info=assess(z("2026-11-18T07:10:00Z")/1000,5,z("2026-11-18T07:20:50Z"));
  assert.equal(info.status,"DELAYED");assert.equal(info.behind,1);
});
test("15-minute candle starting 12:00 Arizona closes 12:15",()=>{
  const info=assess(z("2026-11-18T07:00:00Z")/1000,15,z("2026-11-18T07:21:00Z"));
  assert.equal(new Date(info.closeMs).toISOString(),"2026-11-18T07:15:00.000Z");
  assert.equal(info.status,"FRESH");
});
test("future candle is rejected",()=>{
  assert.equal(assess(z("2026-11-18T07:30:00Z")/1000,5,z("2026-11-18T07:21:00Z")).status,"FUTURE");
});
test("SPY after US market closes is not called a fresh live quote",()=>{
  const now=z("2026-11-18T07:21:00Z");
  assert.equal(regularStockHours(now),false);
  assert.equal(assess(z("2026-11-17T20:45:00Z")/1000,15,now,true).status,"MARKET_CLOSED");
});
test("SPY during regular market hours warns on lag",()=>{
  const now=z("2026-11-18T16:41:00Z");
  assert.equal(regularStockHours(now),true);
  const info=assess(z("2026-11-18T16:20:00Z")/1000,5,now,true);
  assert.equal(info.status,"DELAYED");
});
