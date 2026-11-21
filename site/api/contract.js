"use strict";
// Fast, quote-independent BTC contract discovery. Never infer a contract from a slug.
const {selectMarket,normalizeMarket}=require("../lib/polymarket-us");
const {createCache}=require("../lib/request-coalescer");
const PAGE_CACHE=createCache({ttlMs:1000,maxEntries:40});
const {rateLimitError}=require("../lib/upstream-rate-limit");
let limitedUntil=0;
const BASE="https://gateway.polymarket.us";
const WINDOWS=new Set([5,15]);
async function getJson(url,signal){
  return PAGE_CACHE.get(String(url),async()=>{
    const response=await fetch(url,{signal,headers:{Accept:"application/json"},cache:"no-store"});
    const blocked=rateLimitError(response);
    if(blocked)throw blocked;
    if(!response.ok)throw new Error("Market feed HTTP "+response.status);
    const body=await response.json();
    if(!body||typeof body!=="object")throw new Error("Invalid market response");
    return body;
  });
}
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method!=="GET")return res.status(405).json({available:false,error:"GET only"});
  const interval=Number(req.query?.interval||5);
  if(!WINDOWS.has(interval))return res.status(400).json({available:false,error:"Invalid BTC timeframe"});
  const started=Date.now();
  if(Date.now()<limitedUntil)return res.status(503).json({available:false,interval,state:"RATE_LIMITED",
    retryAfterSec:Math.max(1,Math.ceil((limitedUntil-Date.now())/1000)),checkedAt:new Date().toISOString(),
    error:"Polymarket US temporarily rate limited"});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7000);
  let checked=0,metadataRetrievedAt=null,cacheStatus="miss";
  try{
    // Quantize only the upstream search query, not the contract boundary
    // comparison: identical requests can share one short-lived API snapshot.
    const queryAt=Math.floor(started/1000)*1000;
    const endMin=new Date(queryAt-45*60000).toISOString();
    const endMax=new Date(queryAt+90*60000).toISOString();
    let selected=null;
    for(let page=0;page<4;page++){
      const url=new URL("/v1/markets",BASE);
      for(const [k,v] of Object.entries({
        limit:100,offset:page*100,active:true,closed:false,endDateMin:endMin,
        endDateMax:endMax,orderBy:"endDate",orderDirection:"asc"
      }))url.searchParams.set(k,String(v));
      const pageResult=await getJson(url,controller.signal);
      const data=pageResult.value;
      metadataRetrievedAt=pageResult.retrievedAt;
      if(pageResult.cacheStatus!=="miss")cacheStatus=pageResult.cacheStatus;
      const markets=Array.isArray(data.markets)?data.markets:[];
      checked+=markets.length;
      selected=selectMarket(markets,interval,Date.now());
      if(selected||markets.length<100)break;
    }
    return res.status(200).json({
      available:!!selected,interval,market:selected?normalizeMarket(selected):null,
      state:selected?"CONTRACT_VERIFIED":"AWAITING_CONTRACT",
      checked,checkedAt:new Date().toISOString(),metadataRetrievedAt,cacheStatus,
      lookupMs:Date.now()-started,
      source:"Polymarket US",
      message:selected?null:"No currently verified BTC contract. Discovery is separate from quote retrieval."
    });
  }catch(_err){
    if(_err?.code==="RATE_LIMITED"){
      limitedUntil=Date.now()+_err.retryAfterSec*1000;
      return res.status(503).json({available:false,interval,state:"RATE_LIMITED",
        retryAfterSec:_err.retryAfterSec,checkedAt:new Date().toISOString(),lookupMs:Date.now()-started,
        error:"Polymarket US temporarily rate limited"});
    }
    return res.status(502).json({available:false,interval,state:"FEED_UNAVAILABLE",
      error:"Contract discovery unavailable; check the official market.",
      checkedAt:new Date().toISOString(),lookupMs:Date.now()-started});
  }finally{clearTimeout(timeout);}
};

// Exposed only for deterministic unit-test setup; never returned by API.
module.exports._cache=PAGE_CACHE;

module.exports._resetRateLimit=()=>{limitedUntil=0;};
