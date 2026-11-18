"use strict";
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.BenderCandleTime=api;
})(typeof window!=="undefined"?window:null,function(){
  const MINUTE=60000;
  const GRACE_MS=35000;
  function regularStockHours(nowMs){
    const parts=new Intl.DateTimeFormat("en-US",{
      timeZone:"America/New_York",weekday:"short",hour:"2-digit",
      minute:"2-digit",hourCycle:"h23"
    }).formatToParts(new Date(nowMs));
    const value=x=>parts.find(p=>p.type===x)?.value;
    const day=value("weekday");
    if(day==="Sat"||day==="Sun")return false;
    const mins=Number(value("hour"))*60+Number(value("minute"));
    return Number.isFinite(mins)&&mins>=570&&mins<960;
  }
  function assess(startSeconds,intervalMinutes,nowMs=Date.now(),isSpy=false){
    const interval=Number(intervalMinutes);
    const start=Number(startSeconds);
    if(![5,15].includes(interval)||!Number.isFinite(start)||start<=0||!Number.isFinite(nowMs))
      return {status:"INVALID",closeMs:null,behind:0,ageMs:null};
    const duration=interval*MINUTE;
    const closeMs=start*1000+duration;
    const ageMs=nowMs-closeMs;
    if(ageMs< -2000)return {status:"FUTURE",closeMs,behind:0,ageMs};
    const marketClosed=isSpy&&!regularStockHours(nowMs);
    if(marketClosed)return {status:"MARKET_CLOSED",closeMs,behind:0,ageMs};
    const shouldHaveClosed=Math.floor((nowMs-GRACE_MS)/duration)*duration;
    const behind=Math.max(0,Math.floor((shouldHaveClosed-closeMs)/duration));
    return {status:behind>0?"DELAYED":"FRESH",closeMs,behind,ageMs};
  }
  return {assess,regularStockHours,GRACE_MS};
});
