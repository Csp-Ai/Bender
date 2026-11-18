"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {parseKalshiBrti,distance}=require("../lib/brti");
const now=1795000000000;
const fixture=(time=now-2000)=>({data:{payload:{latest_values:{BRTI:{value:"64624.32",time}}}}});
test("valid recent BRTI reading from Kalshi passthrough",()=>{
  const result=parseKalshiBrti(fixture(),now);
  assert.equal(result.price,64624.32);
  assert.equal(result.source,"CF Benchmarks BRTI via Kalshi");
});
test("rejects delayed, future and second-based readings",()=>{
  assert.equal(parseKalshiBrti(fixture(now-16000),now),null);
  assert.equal(parseKalshiBrti(fixture(now+6000),now),null);
  assert.equal(parseKalshiBrti(fixture(1795000000),now),null);
});
test("rejects missing, malformed, or repeated feed values",()=>{
  assert.equal(parseKalshiBrti({},now),null);
  const bad=fixture();bad.data.payload.latest_values.BRTI.value="invalid";
  assert.equal(parseKalshiBrti(bad,now),null);
  const repeated=fixture();repeated.data.payload.latest_values.BRTI.repeatOfPreviousValue=true;
  assert.equal(parseKalshiBrti(repeated,now),null);
});
test("compares only valid official values against the published target",()=>{
  assert.ok(Math.abs(distance(64624.32,64575.06)-49.26)<0.00001);
  assert.equal(distance(null,64575.06),null);
  assert.equal(distance(64624.32,0),null);
});
