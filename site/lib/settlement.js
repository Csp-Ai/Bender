"use strict";
// Polymarket US settlement verification helpers. Never infer outcomes from BTC spot.
const {TYPE,intervalOf,timestamp,dollars}=require("./polymarket-us");
const SLUG=/^[a-z0-9][a-z0-9-]{3,179}$/;
const ID=/^[a-zA-Z0-9_-]{1,90}$/;
function validateMarket(raw,slug,id,interval,now=Date.now()){
  const m=raw?.market;
  if(!m||typeof m!=="object"||m.slug!==slug||String(m.id)!==id)return null;
  const t=m.assetPriceTerms||{};
  if(t.marketType!==TYPE||String(t.asset?.symbol||"").toLowerCase()!=="btc"||
    intervalOf(t.horizon)!==interval)return null;
  const begins=timestamp(t.windowStart),ends=timestamp(t.windowEnd);
  const target=dollars(t.priceToBeat);
  if(!Number.isFinite(begins)||!Number.isFinite(ends)||ends-begins!==interval*60000||
    ends>now||!Number.isFinite(target))return null;
  return {id,slug,interval,startsAt:new Date(begins).toISOString(),
    endsAt:new Date(ends).toISOString(),target};
}
function classify(body,slug){
  if(!body||typeof body!=="object"||body.slug!==slug)return null;
  const value=body.settlement;
  // Official SDK returns a numeric YES/Up settlement; 0=Down, 1=Up.
  // Partial, void, absent or malformed outcomes are NOT binary results.
  if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>1)return null;
  if(value===1)return {state:"VERIFIED_UP",outcome:"UP",settlement:1};
  if(value===0)return {state:"VERIFIED_DOWN",outcome:"DOWN",settlement:0};
  return {state:"NON_BINARY_SETTLEMENT",outcome:null,settlement:value};
}
module.exports={SLUG,ID,validateMarket,classify};
