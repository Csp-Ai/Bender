"use strict";
// Display-side validation: neither malformed upstream prices nor cached values
// may be presented as indicative contract offers.
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.BenderQuoteSafety=api;
})(typeof window!=="undefined"?window:null,function(){
  const price=value=>
    typeof value==="number"&&Number.isFinite(value)&&value>0&&value<1?value:null;
  function extract(data,now=Date.now()){
    const checked=Date.parse(data?.checkedAt);
    if(!Number.isFinite(checked)||checked>now+5000||now-checked>15000){
      return {fresh:false,upAsk:null,downAsk:null,upLast:null,downLast:null};
    }
    const offers=data?.quotes||{},last=data?.indicative||{};
    return {
      fresh:true,
      upAsk:price(offers.upAsk),downAsk:price(offers.downAsk),
      upLast:price(last.upLast),downLast:price(last.downLast)
    };
  }
  return Object.freeze({price,extract});
});