"use strict";
// Fast, quote-independent BTC contract discovery. Never infer a contract from a slug.
const {selectMarket,normalizeMarket}=require("../lib/polymarket-us");
const BASE="https://gateway.polymarket.us";
const WINDOWS=new Set([5,15]);
async function getJson(url,signal){
  const response=await fetch(url,{signal,headers:{Accept:"application/json"},cache:"no-store"});
  if(!response.ok)throw new Error("Market feed HTTP "+response.status);
  const body=await response.json();
  if(!body||typeof body!=="object")throw new Error("Invalid market response");
  return body;
}
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method!=="GET")return res.status(405).json({available:false,error:"GET only"});
  const interval=Number(req.query?.interval||5);
  if(!WINDOWS.has(interval))return res.status(400).json({available:false,error:"Invalid BTC timeframe"});
  const started=Date.now(),controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7000);
  let checked=0;
  try{
    const endMin=new Date(started-30*60000).toISOString();
    const endMax=new Date(started+30*60000).toISOString();
    let selected=null;
    for(let page=0;page<4;page++){
      const url=new URL("/v1/markets",BASE);
      for(const [k,v] of Object.entries({
        limit:100,offset:page*100,active:true,closed:false,endDateMin:endMin,
        endDateMax:endMax,orderBy:"endDate",orderDirection:"asc"
      }))url.searchParams.set(k,String(v));
      const data=await getJson(url,controller.signal);
      const markets=Array.isArray(data.markets)?data.markets:[];
      checked+=markets.length;
      selected=selectMarket(markets,interval,Date.now());
      if(selected||markets.length<100)break;
    }
    return res.status(200).json({
      available:!!selected,interval,market:selected?normalizeMarket(selected):null,
      state:selected?"CONTRACT_VERIFIED":"AWAITING_CONTRACT",
      checked,checkedAt:new Date().toISOString(),lookupMs:Date.now()-started,
      source:"Polymarket US",
      message:selected?null:"No currently verified BTC contract. Discovery is separate from quote retrieval."
    });
  }catch(_err){
    return res.status(502).json({available:false,interval,state:"FEED_UNAVAILABLE",
      error:"Contract discovery unavailable; check the official market.",
      checkedAt:new Date().toISOString(),lookupMs:Date.now()-started});
  }finally{clearTimeout(timeout);}
};
