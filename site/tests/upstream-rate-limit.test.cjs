"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {retryAfterSeconds,rateLimitError}=require("../lib/upstream-rate-limit");
const quote=require("../api/quotes");
const contract=require("../api/contract");
function response(){let code=200;return{setHeader(){return this},status(n){code=n;return this},json(body){return{status:code,body}}}}
const limited={ok:false,status:429,headers:{get:key=>key==="retry-after"?"15":null}};
test("Retry-After seconds or HTTP dates are bounded to 2-60 seconds",()=>{
 assert.equal(retryAfterSeconds("14"),14);
 assert.equal(retryAfterSeconds("0"),2);
 assert.equal(retryAfterSeconds("900"),60);
 assert.equal(retryAfterSeconds("bad"),8);
 const now=Date.UTC(2026,10,20);
 assert.equal(retryAfterSeconds(new Date(now+12000).toUTCString(),now),12);
 assert.equal(rateLimitError(limited).retryAfterSec,15);
 assert.equal(rateLimitError({status:503}),null);
});
test("429 on a quote suppresses book fallback and future upstream hammering",async()=>{
 quote._cache.clear();quote._resetRateLimit();
 const old=global.fetch;let calls=0;
 try{
   global.fetch=async()=>{calls++;return limited;};
   const req={method:"GET",query:{slug:"btc-updown-5m-rate-limit"}};
   const first=await quote(req,response());
   const second=await quote(req,response());
   assert.equal(first.status,503);
   assert.equal(first.body.state,"RATE_LIMITED");
   assert.equal(first.body.retryAfterSec,15);
   assert.equal(second.status,503);
   assert.equal(calls,1);
 }finally{global.fetch=old;quote._cache.clear();quote._resetRateLimit();}
});
test("429 on market metadata respects cooldown",async()=>{
 contract._cache.clear();contract._resetRateLimit();
 const old=global.fetch;let calls=0;
 try{
   global.fetch=async()=>{calls++;return limited;};
   const req={method:"GET",query:{interval:"5"}};
   const first=await contract(req,response());
   const second=await contract(req,response());
   assert.equal(first.status,503);
   assert.equal(first.body.state,"RATE_LIMITED");
   assert.equal(second.status,503);
   assert.equal(calls,1);
 }finally{global.fetch=old;contract._cache.clear();contract._resetRateLimit();}
});
