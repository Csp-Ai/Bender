"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validateMarket,classify}=require("../lib/settlement");
const handle=require("../api/settlement");
const slug="cpc-btc-updown-5m-2026-11-20-2200z",id="2743164";
const terms={marketType:"ASSET_PRICE_MARKET_TYPE_UP_DOWN",asset:{symbol:"btc"},
  horizon:"5m",windowStart:"2026-11-20T22:00:00Z",windowEnd:"2026-11-20T22:05:00Z",
  priceToBeat:{value:"56123.45"},indexSymbol:"BRTI"};
const detail={market:{id,slug,assetPriceTerms:terms,closed:true}};
function request(query){
  let status=200;
  return {req:{method:"GET",query},res:{
    setHeader(){return this;},status(x){status=x;return this;},
    json(body){return {status,body};}}};
}
test("verifies exact BTC US market terms and rejects market substitution",()=>{
  const now=Date.parse("2026-11-20T22:06:00Z");
  const ok=validateMarket(detail,slug,id,5,now);
  assert.equal(ok.id,id);assert.equal(ok.target,56123.45);
  assert.equal(validateMarket(detail,slug,"wrong",5,now),null);
  assert.equal(validateMarket(detail,slug,id,15,now),null);
  assert.equal(ok.indexSymbol,"BRTI");
  assert.equal(validateMarket({market:{...detail.market,assetPriceTerms:{...terms,indexSymbol:"OTHER"}}},slug,id,5,now),null);
  assert.equal(validateMarket(detail,slug,id,5,Date.parse("2026-11-20T22:04:59Z")),null);
  assert.equal(validateMarket({market:{...detail.market,assetPriceTerms:{...terms,asset:{symbol:"eth"}}}},slug,id,5,now),null);
});
test("only exact binary official numeric settlement can be called UP or DOWN",()=>{
  assert.equal(classify({slug,settlement:1},slug).outcome,"UP");
  assert.equal(classify({slug,settlement:0},slug).outcome,"DOWN");
  assert.equal(classify({slug,settlement:0.5},slug).state,"NON_BINARY_SETTLEMENT");
  for(const bad of [null,{},{"slug":slug,settlement:"1"},{slug,settlement:1.01},{slug,settlement:-.1},
    {slug:"wrong",settlement:1}])assert.equal(classify(bad,slug),null);
});
test("backend fetches exact verified market then official settlement",async()=>{
  const old=global.fetch;
  try{
    const calls=[];
    global.fetch=async url=>{
      calls.push(String(url));
      return {ok:true,status:200,json:async()=>calls.length===1?detail:{slug,settlement:1}};
    };
    const {req,res}=request({slug,id,interval:"5"});
    const result=await handle(req,res);
    assert.equal(result.status,200);
    assert.equal(result.body.state,"VERIFIED_UP");
    assert.equal(result.body.market.target,56123.45);
    assert.equal(calls.length,2);
    assert.match(calls[0],/\/v1\/market\/slug\//);
    assert.match(calls[1],/\/settlement$/);
  }finally{global.fetch=old;}
});
test("missing settlement does not fabricate an outcome",async()=>{
  const old=global.fetch;
  try{
    let calls=0;
    global.fetch=async()=>++calls===1?
      {ok:true,status:200,json:async()=>detail}:
      {ok:false,status:404};
    const {req,res}=request({slug,id,interval:"5"});
    const result=await handle(req,res);
    assert.equal(result.body.state,"AWAITING_SETTLEMENT");
    assert.equal(result.body.outcome,null);
  }finally{global.fetch=old;}
});
test("upstream mismatch, malformed slug and network failure fail closed",async()=>{
  const {req,res}=request({slug:"../invalid",id,interval:"5"});
  assert.equal((await handle(req,res)).status,400);
  const old=global.fetch;
  try{
    global.fetch=async()=>{throw Error("offline");};
    const valid=request({slug,id,interval:"5"});
    const result=await handle(valid.req,valid.res);
    assert.equal(result.status,502);
    assert.equal(result.body.outcome,null);
  }finally{global.fetch=old;}
});
