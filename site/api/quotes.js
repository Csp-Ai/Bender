"use strict";
// Quotes are retrieved separately from market discovery and may be unavailable.
const {quotesFromBbo,quotesFromBook,lastTradeContext}=require("../lib/polymarket-us");
const {createCache}=require("../lib/request-coalescer");
const QUOTE_CACHE=createCache({ttlMs:700,maxEntries:60});
const BASE="https://gateway.polymarket.us";
async function getJson(url,signal){
  return QUOTE_CACHE.get(String(url),async()=>{
    const response=await fetch(url,{signal,headers:{Accept:"application/json"},cache:"no-store"});
    if(!response.ok)throw new Error("Quote feed HTTP "+response.status);
    const body=await response.json();
    if(!body||typeof body!=="object")throw new Error("Invalid quote response");
    return body;
  });
}
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  const slug=String(req.query?.slug||"");
  if(!/^[a-z0-9][a-z0-9-]{3,179}$/.test(slug))
    return res.status(400).json({error:"Invalid market slug"});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
  let quotes=null,indicative=null,warning=null,quotedAt=null,cacheStatus="miss";
  try{
    try{
      const received=await getJson(new URL("/v1/markets/"+slug+"/bbo",BASE),controller.signal);
      const bbo=received.value;
      quotedAt=received.retrievedAt;cacheStatus=received.cacheStatus;
      quotes=quotesFromBbo(bbo);indicative=lastTradeContext(bbo);
      quotes.source="best_bid_offer";
    }catch(_err){warning="Best bid/offer unavailable";}
    if(!quotes||quotes.upAsk===null||quotes.downAsk===null){
      try{
        const received=await getJson(new URL("/v1/markets/"+slug+"/book",BASE),controller.signal);
        const book=received.value;
        const fallback=quotesFromBook(book);
        if(fallback.upAsk!==null||fallback.downAsk!==null){
          quotes=fallback;quotedAt=received.retrievedAt;cacheStatus=received.cacheStatus;
        }else if(!quotedAt){quotedAt=received.retrievedAt;cacheStatus=received.cacheStatus;}
        if(!indicative)indicative=lastTradeContext(book);
      }catch(_err){warning=warning?warning+"; order book unavailable":"Order book unavailable";}
    }
    // quoteTime is server retrieval time, not exchange publication time.
    const hasQuote=!!quotes&&(quotes.upAsk!==null||quotes.downAsk!==null);
    return res.status(200).json({
      slug,source:"Polymarket US",available:hasQuote,state:hasQuote?"QUOTE_AVAILABLE":"AWAITING_QUOTE",
      quotes:hasQuote?quotes:null,indicative,
      checkedAt:quotedAt||new Date().toISOString(),timestampSemantics:"server_retrieval",cacheStatus,
      warning:warning||null,
      disclosure:"Displayed prices are indicative; confirm executable quotes in Polymarket."
    });
  }catch(_err){
    return res.status(502).json({slug,available:false,state:"FEED_UNAVAILABLE",error:"Quote feed unavailable"});
  }finally{clearTimeout(timeout);}
};

// Deterministic test-only reset of ephemeral instance cache.
module.exports._cache=QUOTE_CACHE;
