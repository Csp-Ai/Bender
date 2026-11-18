"use strict";
const TYPE="ASSET_PRICE_MARKET_TYPE_UP_DOWN";
const HORIZONS=new Set([5,15]);
const finitePrice=x=>{
  const raw=(x&&typeof x==="object"&&"value" in x)?x.value:x;
  if(raw===null||raw===undefined||raw==="")return null;
  const n=Number(raw);return Number.isFinite(n)&&n>0&&n<1?n:null;
};
const dollars=x=>{
  const raw=(x&&typeof x==="object"&&"value" in x)?x.value:x;
  if(raw===null||raw===undefined||raw==="")return null;
  const n=Number(raw);return Number.isFinite(n)&&n>0?n:null;
};
const timestamp=x=>{
  if(x===undefined||x===null)return null;
  const n=typeof x==="number"?x*1000:Date.parse(x);
  return Number.isFinite(n)?n:null;
};
const intervalOf=x=>{
  const s=String(x||"").toLowerCase();
  if(/(^|[^0-9])15m([^0-9]|$)/.test(s))return 15;
  if(/(^|[^0-9])5m([^0-9]|$)/.test(s))return 5;
  return null;
};
const isBTCUpDown=(m,interval,now)=>{
  if(!m||typeof m!=="object"||m.closed===true||m.active===false)return false;
  const t=m.assetPriceTerms;
  if(!t||t.marketType!==TYPE)return false;
  if(String(t.asset&&t.asset.symbol||"").toLowerCase()!=="btc")return false;
  if(intervalOf(t.horizon)!==interval)return false;
  const start=timestamp(t.windowStart),end=timestamp(t.windowEnd);
  if(start===null||end===null||start>end)return false;
  // Must refer to the current time window, not yesterday's or tomorrow's contract.
  return start<=now+10000&&end>now&&end-now<=interval*60000+10000;
};
function selectMarket(markets,interval,now){
  if(!HORIZONS.has(interval)||!Array.isArray(markets))return null;
  return markets.filter(m=>isBTCUpDown(m,interval,now))
    .sort((a,b)=>timestamp(a.assetPriceTerms.windowEnd)-timestamp(b.assetPriceTerms.windowEnd))[0]||null;
}
function normalizeMarket(m){
  const t=m.assetPriceTerms||{};
  const slug=String(m.slug||"");
  const eventSlug=String(m.eventSlug||m.event?.slug||m.events?.[0]?.slug||slug);
  const safeSlug=/^[a-z0-9-]{5,180}$/.test(eventSlug)?eventSlug:"";
  const index=String(t.indexSymbol||"").slice(0,32);
  return {
    id:String(m.id||""),slug,
    url:safeSlug?"https://polymarket.us/event/"+safeSlug:"https://polymarket.us/category/btc",
    title:String(m.question||m.titleShort||"BTC Up or Down").slice(0,140),
    startsAt:new Date(timestamp(t.windowStart)).toISOString(),
    endsAt:new Date(timestamp(t.windowEnd)).toISOString(),
    target:dollars(t.priceToBeat),
    indexSymbol:index||null,
    marketType:t.marketType,
    source:"Polymarket US"
  };
}
function quotesFromBbo(data){
  const b=data&&typeof data==="object"?(data.marketData||data):{};
  // The US venue's order book is a YES contract. The short-side
  // ask is the cost of buying NO, derived from the YES bid.
  const ask=finitePrice(b.bestAsk);
  const bid=finitePrice(b.bestBid);
  const open=!b.state||b.state==="MARKET_STATE_OPEN";
  return {
    upAsk:open?ask:null,
    downAsk:open&&bid!==null?Math.round((1-bid)*10000)/10000:null,
    bid:open?bid:null,
    ask:open?ask:null,
    open,
    quoteTime:new Date().toISOString()
  };
}
module.exports={TYPE,HORIZONS,finitePrice,dollars,timestamp,intervalOf,isBTCUpDown,selectMarket,normalizeMarket,quotesFromBbo};
