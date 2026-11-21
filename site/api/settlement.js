"use strict";
// Read-only official US settlement verification. Does not calculate BRTI from spot.
const {SLUG,ID,validateMarket,classify}=require("../lib/settlement");
const BASE="https://gateway.polymarket.us";
async function fetchJson(path,signal){
  const r=await fetch(BASE+path,{signal,headers:{Accept:"application/json"},cache:"no-store"});
  if(r.status===404||r.status===409||r.status===422)return {notReady:true};
  if(!r.ok)throw new Error("Upstream HTTP "+r.status);
  const data=await r.json();
  if(!data||typeof data!=="object")throw new Error("Malformed settlement response");
  return {data};
}
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method!=="GET")return res.status(405).json({state:"INVALID_REQUEST",error:"GET only"});
  const slug=String(req.query?.slug||""),id=String(req.query?.id||"");
  const interval=Number(req.query?.interval);
  if(!SLUG.test(slug)||!ID.test(id)||![5,15].includes(interval))
    return res.status(400).json({state:"INVALID_REQUEST",error:"Invalid market identity"});
  const checkedAt=new Date().toISOString();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    // Verify the exact market, including BTC asset, contract horizon, target,
    // chronological window, and ID, before accepting any settlement record.
    const info=await fetchJson("/v1/market/slug/"+encodeURIComponent(slug),controller.signal);
    if(info.notReady)return res.status(200).json({
      state:"MARKET_NOT_FOUND",checkedAt,source:"Polymarket US",outcome:null});
    const market=validateMarket(info.data,slug,id,interval);
    if(!market)return res.status(200).json({
      state:"NOT_VERIFIABLE",checkedAt,source:"Polymarket US",outcome:null,
      reason:"Official market identity, terms, or expiry could not be verified"});
    const settled=await fetchJson("/v1/markets/"+encodeURIComponent(slug)+"/settlement",controller.signal);
    if(settled.notReady)return res.status(200).json({
      state:"AWAITING_SETTLEMENT",market,checkedAt,source:"Polymarket US",outcome:null});
    const classified=classify(settled.data,slug);
    if(!classified)return res.status(200).json({
      state:"NOT_VERIFIABLE",market,checkedAt,source:"Polymarket US",outcome:null,
      reason:"Settlement payload could not be verified"});
    return res.status(200).json({
      ...classified,market,checkedAt,source:"Polymarket US",
      provenance:{marketEndpoint:"/v1/market/slug/{slug}",
        settlementEndpoint:"/v1/markets/{slug}/settlement",
        timestampType:"bender_retrieval_not_official_settlement_time"},
      disclosure:"Official binary contract result, not a trading P&L or proof of predictive edge."
    });
  }catch(_err){
    return res.status(502).json({state:"FEED_UNAVAILABLE",outcome:null,
      checkedAt,source:"Polymarket US",error:"Settlement feed unavailable. No result inferred."});
  }finally{clearTimeout(timer);}
};
