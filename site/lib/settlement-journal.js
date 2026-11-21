"use strict";
/**
 * Read-only local cache for official Polymarket US contract settlements.
 * Kept separate from the immutable original chart observation.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.BenderSettlements=api;
})(typeof window!=="undefined"?window:null,function(root){
  const KEY="bender.verifiedSettlements.v1";
  const ID=/^[A-Za-z0-9_-]{1,90}$/,SLUG=/^[a-z0-9-]{4,180}$/;
  const STATES=new Set(["VERIFIED_UP","VERIFIED_DOWN","NON_BINARY_SETTLEMENT"]);
  function storage(){
    try{return root?.localStorage||null;}catch(_){return null;}
  }
  function ms(value){
    if(typeof value!=="string"||!/([Zz]|[+-]\d{2}:\d{2})$/.test(value))return NaN;
    return Date.parse(value);
  }
  function identity(obj){
    return [obj.venue,obj.id,obj.slug,obj.intervalMinutes].join("|");
  }
  function normalized(raw){
    if(!raw||typeof raw!=="object"||raw.venue!=="us"||
       !ID.test(raw.id)||!SLUG.test(raw.slug)||![5,15].includes(raw.intervalMinutes)||
       typeof raw.target!=="number"||!Number.isFinite(raw.target)||raw.target<=0||
       !STATES.has(raw.state))return null;
    const start=ms(raw.startsAt),end=ms(raw.endsAt),checked=ms(raw.checkedAt);
    if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(checked)||
       end-start!==raw.intervalMinutes*60000||end>checked||
       checked>Date.now()+5000)return null;
    const expected=raw.state==="VERIFIED_UP"?"UP":raw.state==="VERIFIED_DOWN"?"DOWN":null;
    if(raw.outcome!==expected)return null;
    if(typeof raw.settlement!=="number"||!Number.isFinite(raw.settlement)||
       raw.settlement<0||raw.settlement>1||
       (expected==="UP"&&raw.settlement!==1)||
       (expected==="DOWN"&&raw.settlement!==0)||
       (expected===null&&(raw.settlement===0||raw.settlement===1)))return null;
    return {
      version:1,venue:"us",id:raw.id,slug:raw.slug,intervalMinutes:raw.intervalMinutes,
      target:raw.target,
      startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString(),
      checkedAt:new Date(checked).toISOString(),
      source:"Polymarket US public settlement endpoint",
      state:raw.state,outcome:raw.outcome,settlement:raw.settlement,
      type:"exchange_settlement_not_user_trade"
    };
  }
  function matchMarket(result,observation){
    const m=observation?.contract;
    return !!m&&observation.symbol==="BTC/USD"&&
      result.id===m.id&&result.slug===m.slug&&
      result.venue==="us"&&result.intervalMinutes===observation.intervalMinutes&&
      m.intervalMinutes===result.intervalMinutes&&
      Math.abs(result.target-m.target)<0.005&&
      ms(result.startsAt)===ms(m.startsAt)&&ms(result.endsAt)===ms(m.endsAt)&&
      ms(observation.observedAt)>=ms(m.startsAt)&&ms(observation.observedAt)<ms(m.endsAt);
  }
  function fromResponse(body,observation){
    const m=body?.market;
    if(!m||typeof m!=="object")return null;
    const result=normalized({
      venue:"us",id:m.id,slug:m.slug,intervalMinutes:m.interval,
      startsAt:m.startsAt,endsAt:m.endsAt,target:m.target,
      checkedAt:body.checkedAt,state:body.state,
      outcome:body.outcome,settlement:body.settlement
    });
    return result&&matchMarket(result,observation)?result:null;
  }
  function read(db=storage()){
    if(!db)return [];
    try{
      const raw=JSON.parse(db.getItem(KEY)||"[]");
      if(!Array.isArray(raw))return [];
      const seen=new Set(),out=[];
      for(const item of raw){
        const record=normalized(item);
        if(!record)continue;
        const key=identity(record);
        if(seen.has(key))continue;
        seen.add(key);out.push(record);
      }
      return out.sort((a,b)=>ms(b.checkedAt)-ms(a.checkedAt)).slice(0,150);
    }catch(_){return [];}
  }
  function save(result,observation,db=storage()){
    const entry=normalized(result);
    if(!entry||!matchMarket(entry,observation))
      return {saved:false,reason:"unverified_or_mismatched"};
    if(!db)return {saved:false,reason:"storage_unavailable"};
    const previous=read(db);
    const keep=previous.filter(x=>identity(x)!==identity(entry));
    const next=[entry,...keep].sort((a,b)=>ms(b.checkedAt)-ms(a.checkedAt)).slice(0,150);
    try{db.setItem(KEY,JSON.stringify(next));return {saved:true,entry};}
    catch(_){return {saved:false,reason:"storage_unavailable"};}
  }
  function forRead(observation,db=storage()){
    if(!observation?.contract)return null;
    return read(db).find(x=>matchMarket(x,observation))||null;
  }
  function clear(db=storage()){
    if(!db)return false;
    try{db.removeItem(KEY);return true;}catch(_){return false;}
  }
  return Object.freeze({KEY,normalized,matchMarket,fromResponse,read,save,forRead,clear});
});
