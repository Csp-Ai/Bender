"use strict";
const {selectMarket,normalizeMarket,quotesFromBbo,quotesFromBook,lastTradeContext}=require("../lib/polymarket-us");
const BASE="https://gateway.polymarket.us";
async function getJson(url,signal){
  const response=await fetch(url,{signal,headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Venue returned HTTP "+response.status);
  const body=await response.json();
  if(!body||typeof body!=="object")throw new Error("Unexpected venue response");
  return body;
}
module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Only GET is supported"});
  const timeframe=Number(req.query.interval||5);
  if(![5,15].includes(timeframe))return res.status(400).json({error:"Choose a 5-minute or 15-minute BTC contract"});
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),8500);
  const now=Date.now();
  try {
    const endMin=new Date(now-45*60000).toISOString();
    const endMax=new Date(now+90*60000).toISOString();
    let selected=null,checked=0;
    // Fetch only a narrow expiry window, then *verify* the asset, type and
    // actual window fields. Never infer the contract from a guessed slug.
    for(let page=0;page<4;page++){
      const url=new URL("/v1/markets",BASE);
      url.searchParams.set("limit","100");
      url.searchParams.set("offset",String(page*100));
      url.searchParams.set("active","true");
      url.searchParams.set("closed","false");
      url.searchParams.set("endDateMin",endMin);
      url.searchParams.set("endDateMax",endMax);
      url.searchParams.set("orderBy","endDate");
      url.searchParams.set("orderDirection","asc");
      const data=await getJson(url,ctrl.signal);
      const markets=Array.isArray(data.markets)?data.markets:[];
      checked+=markets.length;
      selected=selectMarket(markets,timeframe,Date.now());
      if(selected||markets.length<100)break;
    }
    res.setHeader("Cache-Control","public, s-maxage=10, stale-while-revalidate=10");
    res.setHeader("X-Content-Type-Options","nosniff");
    if(!selected){
      return res.status(200).json({available:false,interval:timeframe,source:"Polymarket US",
        reason:"No verified active BTC "+timeframe+"-minute Up/Down contract found in the public market feed.",
        categoryUrl:"https://polymarket.us/category/btc",checked,checkedAt:new Date().toISOString()});
    }
    const market=normalizeMarket(selected);
    let quotes=null,quoteWarning=null,indicative=null;
    if(/^[a-z0-9-]{5,180}$/.test(market.slug)){
      try{
        const data=await getJson(new URL("/v1/markets/"+market.slug+"/bbo",BASE),ctrl.signal);
        quotes=quotesFromBbo(data);
        indicative=lastTradeContext(data);
      }catch(e){quoteWarning="Top-of-book quote feed did not respond.";}
      if(!quotes||quotes.upAsk===null||quotes.downAsk===null){
        try{
          const book=await getJson(new URL("/v1/markets/"+market.slug+"/book",BASE),ctrl.signal);
          const best=quotesFromBook(book);
          if(best.upAsk!==null||best.downAsk!==null)quotes=best;
          if(!indicative)indicative=lastTradeContext(book);
        }catch(e){
          quoteWarning="Order-book prices could not be verified.";
        }
      }
    }
    // A recent trade is context only. It is never labeled a buy quote.
    if(!indicative){
      indicative=lastTradeContext(selected);
    }
    if(quotes){
      quotes.source=quotes.source||"best_bid_offer";
      quotes.quoteType="executable_reference";
    }
    const warns=[];
    if(market.target===null)warns.push("Opening target has not been published yet.");
    if(market.indexSymbol!=="BRTI")warns.push("Verify the contract's official reference index and resolution rules.");
    if(!quotes||quotes.upAsk===null||quotes.downAsk===null)warns.push("There is no verified current buy quote. Last trade, if shown, is not an offer.");
    if(quoteWarning)warns.push(quoteWarning);
    return res.status(200).json({
      available:true,interval:timeframe,market,quotes,indicative,warnings:warns,
      currentReferencePrice:null,
      referencePriceStatus:"Not connected: BRTI live index values are not available in Bender yet.",
      chartComparisonAllowed:false,checkedAt:new Date().toISOString()
    });
  }catch(e){
    return res.status(502).json({available:false,error:"The Polymarket US market feed could not be verified right now. Open the official app to check the contract."});
  }finally{clearTimeout(timeout);}
};
