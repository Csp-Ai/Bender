"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {selectMarket,normalizeMarket,quotesFromBbo,intervalOf}=require("../lib/polymarket-us");
const NOW=Date.parse("2026-11-18T05:52:00Z");
const sample=(horizon="5m",adjust={})=>({
  id:"42",slug:"btc-updown-5m-2026-11-18-0550z",question:"BTC Up or Down 5m",active:true,closed:false,
  assetPriceTerms:{marketType:"ASSET_PRICE_MARKET_TYPE_UP_DOWN",asset:{symbol:"btc"},horizon,
    windowStart:"2026-11-18T05:50:00Z",windowEnd:"2026-11-18T05:55:00Z",
    indexSymbol:"BRTI",priceToBeat:{value:64575.06,currency:"USD"}},
  ...adjust
});
test("selects a verified current 5-minute BTC contract",()=>{
  const m=selectMarket([sample()],5,NOW);
  assert.ok(m);assert.equal(normalizeMarket(m).target,64575.06);
});
test("never matches a 15m window as a 5m contract",()=>{
  assert.equal(selectMarket([sample("15m")],5,NOW),null);
});
test("rejects expired windows",()=>{
  assert.equal(selectMarket([sample()],5,Date.parse("2026-11-18T06:00:00Z")),null);
});
test("rejects other assets and types",()=>{
  assert.equal(selectMarket([sample("5m",{assetPriceTerms:{...sample().assetPriceTerms,asset:{symbol:"eth"}}})],5,NOW),null);
  assert.equal(selectMarket([sample("5m",{assetPriceTerms:{...sample().assetPriceTerms,marketType:"ASSET_PRICE_MARKET_TYPE_RANGE"}})],5,NOW),null);
});
test("missing price to beat remains null",()=>{
  const m=sample();m.assetPriceTerms.priceToBeat=null;
  assert.equal(normalizeMarket(m).target,null);
});
test("quotes use YES ask and inverse YES bid, not a forecast",()=>{
  const q=quotesFromBbo({marketData:{bestAsk:{value:.97},bestBid:{value:.96},state:"MARKET_STATE_OPEN"}});
  assert.equal(q.upAsk,.97);assert.equal(q.downAsk,.04);
});
test("missing or closed quotes never fabricate odds",()=>{
  assert.equal(quotesFromBbo({marketData:{}}).upAsk,null);
  assert.equal(quotesFromBbo({marketData:{bestAsk:{value:.9},bestBid:{value:.89},state:"MARKET_STATE_CLOSED"}}).downAsk,null);
});
test("horizon matching is strict",()=>{
  assert.equal(intervalOf("5m"),5);assert.equal(intervalOf("15m"),15);assert.equal(intervalOf("1h"),null);
});

test("normalizes rolling BTC routes to durable official category pages",()=>{
  const five=normalizeMarket(sample());
  assert.equal(five.url,"https://polymarket.us/category/bitcoin-5m");
  const fifteen=normalizeMarket(sample("15m"));
  assert.equal(fifteen.url,"https://polymarket.us/category/bitcoin-15m");
  assert.ok(!five.url.includes("/event/"));
});

test("does not verify a BTC market with a shortened or inconsistent window",()=>{
  const short=sample("5m",{assetPriceTerms:{...sample().assetPriceTerms,windowEnd:"2026-11-18T05:53:00Z"}});
  assert.equal(selectMarket([short],5,NOW),null);
  const long=sample("5m",{assetPriceTerms:{...sample().assetPriceTerms,windowEnd:"2026-11-18T06:05:00Z"}});
  assert.equal(selectMarket([long],5,NOW),null);
  const backward=sample("5m",{assetPriceTerms:{...sample().assetPriceTerms,windowEnd:"2026-11-18T05:49:00Z"}});
  assert.equal(selectMarket([backward],5,NOW),null);
});
test("market lookup rejects missing or malformed identifiers before verification",()=>{
  assert.equal(selectMarket([sample("5m",{id:""})],5,NOW),null);
  assert.equal(selectMarket([sample("5m",{slug:""})],5,NOW),null);
  assert.equal(selectMarket([sample("5m",{slug:"../untrusted-market"})],5,NOW),null);
});

test("unfamiliar or absent settlement index and missing price target are never verified",()=>{
  for(const index of ["", "CHAINLINK", "BRTI2", null]){
    const m=sample("5m",{assetPriceTerms:{...sample().assetPriceTerms,indexSymbol:index}});
    assert.equal(selectMarket([m],5,NOW),null);
  }
  const noTarget=sample("5m",{assetPriceTerms:{...sample().assetPriceTerms,priceToBeat:null}});
  assert.equal(selectMarket([noTarget],5,NOW),null);
});
