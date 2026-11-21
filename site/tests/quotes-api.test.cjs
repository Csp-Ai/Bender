"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const handler=require("../api/quotes");
// Request caches survive between tests in one Node process.
test.beforeEach(()=>handler._cache.clear());
const SLUG="btc-updown-5m-verified-test";
const reply=(body,status=200)=>({ok:status>=200&&status<300,status,async json(){return body;}});
function invoke(slug){
  let code=200;
  return handler({method:"GET",query:{slug}},
    {setHeader(){},status(s){code=s;return this;},json(body){return {status:code,body};}});
}
test("quote retrieval remains independent and labelled server time",async()=>{
  const old=global.fetch;
  try{
    global.fetch=async url=>{
      assert.ok(String(url).includes("/bbo"));
      return reply({marketData:{bestAsk:{value:.57},bestBid:{value:.55},state:"MARKET_STATE_OPEN"}});
    };
    const r=await invoke(SLUG);
    assert.equal(r.body.state,"QUOTE_AVAILABLE");
    assert.equal(r.body.quotes.upAsk,.57);
    assert.equal(r.body.quotes.downAsk,.45);
    assert.equal(r.body.timestampSemantics,"server_retrieval");
  }finally{global.fetch=old;}
});
test("missing order book does not invent offers",async()=>{
  const old=global.fetch;
  try{
    global.fetch=async()=>reply({marketData:{}});
    const r=await invoke(SLUG);
    assert.equal(r.body.available,false);
    assert.equal(r.body.quotes,null);
    assert.equal(r.body.state,"AWAITING_QUOTE");
  }finally{global.fetch=old;}
});
test("book fallback supplies offers without waiting for another contract lookup",async()=>{
  const old=global.fetch;
  try{
    global.fetch=async url=>String(url).includes("/bbo")
      ?reply({marketData:{}})
      :reply({marketData:{bids:[{price:.4}],asks:[{price:.6}],state:"MARKET_STATE_OPEN"}});
    const r=await invoke(SLUG);
    assert.equal(r.body.available,true);
    assert.equal(r.body.quotes.upAsk,.6);
    assert.equal(r.body.quotes.downAsk,.6);
  }finally{global.fetch=old;}
});
test("invalid slug blocked before external network requests",async()=>{
  const r=await invoke("../attack");
  assert.equal(r.status,400);
});
