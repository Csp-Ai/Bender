"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const handler=require("../api/contract");

function market(now,adjust={}){
  const start=new Date(Math.floor(now/300000)*300000).toISOString();
  const end=new Date(Math.floor(now/300000)*300000+300000).toISOString();
  return {
    id:"m100",slug:"btc-updown-5m-m100",active:true,closed:false,
    assetPriceTerms:{
      marketType:"ASSET_PRICE_MARKET_TYPE_UP_DOWN",asset:{symbol:"btc"},
      horizon:"5m",indexSymbol:"BRTI",priceToBeat:{value:65321.75},
      windowStart:start,windowEnd:end
    },...adjust
  };
}
function response(body,status=200){
  return {ok:status>=200&&status<300,status,async json(){return body;}};
}
function invoke(query){
  let status=200,headers={};
  return handler({method:"GET",query},
    {setHeader(k,v){headers[k]=v;},status(s){status=s;return this;},json(body){return {status,body,headers};}});
}
test("contract metadata appears without waiting for quote endpoints",async()=>{
  const old=global.fetch,calls=[];
  try{
    const now=Date.now();
    global.fetch=async url=>{
      calls.push(String(url));
      return response({markets:[market(now)]});
    };
    const result=await invoke({interval:"5"});
    assert.equal(result.status,200);
    assert.equal(result.body.available,true);
    assert.equal(result.body.market.target,65321.75);
    assert.equal(result.body.state,"CONTRACT_VERIFIED");
    assert.equal(calls.length,1);
    assert.ok(calls[0].includes("/v1/markets?"));
    assert.ok(!calls[0].includes("/bbo"));
    assert.equal(result.headers["Cache-Control"],"no-store, max-age=0");
  }finally{global.fetch=old;}
});
test("rejects expired verified-identity candidates",async()=>{
  const old=global.fetch;
  try{
    const now=Date.now();
    const expired=market(now);
    expired.assetPriceTerms.windowStart=new Date(now-600000).toISOString();
    expired.assetPriceTerms.windowEnd=new Date(now-300000).toISOString();
    global.fetch=async()=>response({markets:[expired]});
    const result=await invoke({interval:"5"});
    assert.equal(result.body.available,false);
    assert.equal(result.body.market,null);
  }finally{global.fetch=old;}
});
test("rejects invalid interval before fetching",async()=>{
  const result=await invoke({interval:"10"});
  assert.equal(result.status,400);
});
