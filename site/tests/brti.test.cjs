"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {parseBrti,distance}=require("../lib/brti");
const now=1795000000000;
const fixture=(time=now-2000)=>({payload:{latest_values:{BRTI:{value:"64624.32",time}}}});
test("authorized provider response parses",()=>assert.equal(parseBrti(fixture(),now).price,64624.32));
test("reject stale, future and seconds timestamps",()=>{
  assert.equal(parseBrti(fixture(now-16000),now),null);
  assert.equal(parseBrti(fixture(now+6000),now),null);
  assert.equal(parseBrti(fixture(1795000000),now),null);
});
test("reject repeated and invalid prices",()=>{
  assert.equal(parseBrti({},now),null);
  const x=fixture();x.payload.latest_values.BRTI.repeatOfPreviousValue=true;
  assert.equal(parseBrti(x,now),null);
  const y=fixture();y.payload.latest_values.BRTI.value="oops";
  assert.equal(parseBrti(y,now),null);
});
test("only computes deltas from two verified numbers",()=>{
  assert.ok(Math.abs(distance(64624.32,64575.06)-49.26)<1e-6);
  assert.equal(distance(null,64575.06),null);
  assert.equal(distance(64624.32,0),null);
});
