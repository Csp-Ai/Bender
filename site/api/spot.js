"use strict";
// Public, read-only live BTC/USD spot snapshot. NOT the CF Benchmarks BRTI settlement index.
function validPrice(raw){
  const n=Number(raw);
  return raw!==null&&raw!==undefined&&raw!==""&&Number.isFinite(n)&&n>0&&n<10000000?n:null;
}
async function fromKraken(signal){
  const url=new URL("https://api.kraken.com/0/public/Ticker");
  url.searchParams.set("pair","XBTUSD");
  const r=await fetch(url,{signal,headers:{"Accept":"application/json"}});
  if(!r.ok)throw new Error("Kraken HTTP error");
  const data=await r.json();
  if(!Array.isArray(data.error)||data.error.length)throw new Error("Kraken feed error");
  const entries=Object.entries(data.result||{});
  if(entries.length!==1)throw new Error("Unknown Kraken ticker");
  const price=validPrice(entries[0][1]?.c?.[0]);
  if(price===null)throw new Error("Invalid Kraken price");
  return {price,source:"Kraken BTC/USD last trade",sourceCode:"KRAKEN",
    sampledAt:new Date().toISOString(),isSettlementIndex:false};
}
async function fromCoinbase(signal){
  const r=await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot",
    {signal,headers:{"Accept":"application/json"}});
  if(!r.ok)throw new Error("Coinbase HTTP error");
  const d=await r.json();
  if(d.data?.currency!=="USD"||d.data?.base!=="BTC")throw new Error("Unexpected pair");
  const price=validPrice(d.data?.amount);
  if(price===null)throw new Error("Invalid Coinbase price");
  return {price,source:"Coinbase BTC/USD spot",sourceCode:"COINBASE",
    sampledAt:new Date().toISOString(),isSettlementIndex:false};
}
module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Use GET"});
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),9000);
  res.setHeader("Cache-Control","public, s-maxage=3, stale-while-revalidate=3");
  res.setHeader("X-Content-Type-Options","nosniff");
  try{
    let quote;
    try{quote=await fromKraken(ctrl.signal);}
    catch(e){quote=await fromCoinbase(ctrl.signal);}
    return res.status(200).json({available:true,...quote,
      warning:"Spot is a live market estimate. Polymarket US settles this BTC contract using BRTI minute averages, not this spot quote."});
  }catch(e){
    return res.status(503).json({available:false,error:"Live spot quotes are temporarily unreachable; no fake price is shown."});
  }finally{clearTimeout(t);}
};
