"use strict";
// Final display-side integrity gate. No conflicting source, state or market
// response may render as a live offer. Timestamps are Bender retrieval times.
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.BenderQuoteSafety=api;
})(typeof window!=="undefined"?window:null,function(){
  const validSlug=s=>typeof s==="string"&&/^[a-z0-9][a-z0-9-]{3,179}$/.test(s);
  const price=value=>typeof value==="number"&&Number.isFinite(value)&&value>0&&value<1?value:null;
  const empty=()=>({fresh:false,upAsk:null,downAsk:null,upLast:null,downLast:null});
  function extract(data,now=Date.now(),expectedSlug=null){
    if(!data||typeof data!=="object"||
       !validSlug(data.slug)||
       (expectedSlug!==null&&data.slug!==expectedSlug)||
       data.source!=="Polymarket US"||
       data.timestampSemantics!=="server_retrieval")return empty();
    const checked=Date.parse(data.checkedAt);
    if(!Number.isFinite(checked)||checked>now+5000||now-checked>12000)return empty();
    const available=data.available===true&&data.state==="QUOTE_AVAILABLE";
    const pending=data.available===false&&data.state==="AWAITING_QUOTE";
    if(!available&&!pending)return empty();
    const quotes=data.quotes;
    if(pending&&quotes!==null&&quotes!==undefined)return empty();
    if(available&&(!quotes||typeof quotes!=="object"||
       !["best_bid_offer","order_book"].includes(quotes.source)))return empty();
    if(available&&(["upAsk","downAsk"].some(key=>
      quotes[key]!==undefined&&quotes[key]!==null&&price(quotes[key])===null)))return empty();
    const upAsk=available?price(quotes.upAsk):null;
    const downAsk=available?price(quotes.downAsk):null;
    if(available&&upAsk===null&&downAsk===null)return empty();
    const indicative=data.indicative;
    let upLast=null,downLast=null;
    if(indicative&&indicative.source==="last_trade"&&indicative.isExecutable===false){
      upLast=price(indicative.upLast);
      downLast=price(indicative.downLast);
    }
    return {fresh:true,upAsk,downAsk,upLast,downLast};
  }
  return Object.freeze({price,extract});
});