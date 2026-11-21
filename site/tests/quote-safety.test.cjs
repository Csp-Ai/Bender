"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {price,extract}=require("../lib/quote-safety");
const NOW=Date.now(),SLUG="btc-updown-5m-good";
const snapshot=(offers={upAsk:.57,downAsk:.44},extra={})=>({
  slug:SLUG,source:"Polymarket US",timestampSemantics:"server_retrieval",
  available:true,state:"QUOTE_AVAILABLE",checkedAt:new Date(NOW).toISOString(),
  quotes:{source:"best_bid_offer",...offers},indicative:null,...extra
});
test("only positive finite prices below 1 can render",()=>{
 for(const n of [.01,.57,.99])assert.equal(price(n),n);
 for(const n of [0,1,1.4,-.3,NaN,Infinity,-Infinity,null,undefined,".57",{},true])assert.equal(price(n),null);
});
test("accepts matched, sourced, fresh BBO or book",()=>{
 assert.deepEqual(extract(snapshot(),NOW,SLUG),{fresh:true,upAsk:.57,downAsk:.44,upLast:null,downLast:null});
 assert.equal(extract(snapshot({upAsk:.56,downAsk:null},{quotes:{source:"order_book",upAsk:.56,downAsk:null}}),NOW,SLUG).upAsk,.56);
});
test("contradictory availability, state and market fail closed",()=>{
 const bad=[
 {available:false},{state:"AWAITING_QUOTE"},{slug:"btc-updown-5m-another"},
 {source:"Kraken"},{timestampSemantics:"exchange_timestamp"},{quotes:{source:"untrusted",upAsk:.57}},
 {quotes:{source:"best_bid_offer",upAsk:1.4,downAsk:.42}},
 {quotes:{source:"best_bid_offer",upAsk:-.4,downAsk:.42}},
 {quotes:{source:"best_bid_offer",upAsk:.57,downAsk:"0.44"}},
 {quotes:null},{checkedAt:new Date(NOW-50000).toISOString()},{checkedAt:new Date(NOW+30000).toISOString()},
 {checkedAt:"unparseable"}
 ];
 for(const change of bad)assert.equal(extract(snapshot({},change),NOW,SLUG).fresh,false,JSON.stringify(change));
 assert.equal(extract(snapshot(),NOW,"btc-updown-5m-wrong").fresh,false);
});
test("pending book never presents executable-looking offers",()=>{
 const pending=snapshot(null,{available:false,state:"AWAITING_QUOTE",quotes:null,
  indicative:{source:"last_trade",isExecutable:false,upLast:.6,downLast:.4}});
 const x=extract(pending,NOW,SLUG);
 assert.deepEqual(x,{fresh:true,upAsk:null,downAsk:null,upLast:.6,downLast:.4});
 assert.equal(extract({...pending,quotes:{upAsk:.57}},NOW,SLUG).fresh,false);
 assert.equal(extract({...pending,indicative:{source:"last_trade",isExecutable:true,upLast:.6}},NOW,SLUG).upLast,null);
});
