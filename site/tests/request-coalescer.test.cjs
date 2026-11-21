"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createCache}=require("../lib/request-coalescer");

test("coalesces concurrent identical requests and reports source retrieval time",async()=>{
  let clock=100000,called=0;
  const cache=createCache({ttlMs:700,clock:()=>clock});
  let release;
  const loader=()=>new Promise(resolve=>{called++;release=()=>resolve({price:.59});});
  const first=cache.get("market-a",loader);
  const second=cache.get("market-a",loader);
  assert.equal(called,1);
  release();
  const [one,two]=await Promise.all([first,second]);
  assert.equal(one.cacheStatus,"miss");
  assert.equal(two.cacheStatus,"shared");
  assert.equal(one.retrievedAt,two.retrievedAt);
  clock+=400;
  const hit=await cache.get("market-a",()=>{throw Error("must not fetch")});
  assert.equal(hit.cacheStatus,"hit");
  assert.equal(hit.retrievedAt,one.retrievedAt);
  clock+=500;
  const refreshed=await cache.get("market-a",async()=>({price:.60}));
  assert.equal(refreshed.cacheStatus,"miss");
  assert.notEqual(refreshed.retrievedAt,one.retrievedAt);
});
test("failed loader cannot become a cached result",async()=>{
  const cache=createCache({ttlMs:500});
  await assert.rejects(cache.get("market",()=>Promise.reject(Error("HTTP 429"))));
  assert.equal(cache.stats().entries,0);
  assert.equal(cache.stats().inflight,0);
  assert.equal((await cache.get("market",async()=>({ok:true}))).value.ok,true);
});
test("distinct contract or quote URL keys are not conflated",async()=>{
  const cache=createCache({ttlMs:600});
  await cache.get("/markets/5m",async()=>5);
  await cache.get("/markets/15m",async()=>15);
  assert.equal((await cache.get("/markets/5m",async()=>0)).value,5);
  assert.equal((await cache.get("/markets/15m",async()=>0)).value,15);
});
test("cache is bounded and can be reset safely",async()=>{
  const cache=createCache({ttlMs:3000,maxEntries:2});
  for(const key of ["one","two","three"])await cache.get(key,async()=>key);
  assert.ok(cache.stats().entries<=2);
  cache.clear();
  assert.equal(cache.stats().entries,0);
});
test("invalid cache configurations and keys fail",async()=>{
  assert.throws(()=>createCache({ttlMs:10000}),TypeError);
  assert.throws(()=>createCache({maxEntries:0}),TypeError);
  await assert.rejects(createCache().get("",async()=>1),TypeError);
});
