"use strict";
/**
 * Bender Past Reads v1 — browser-local chart observations, not trades or outcomes.
 * No network calls, no external accounts, no backfilled signals.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.BenderReadJournal=api;
})(typeof window!=="undefined"?window:null,function(root){
  const KEY="bender.chartReads.v1";
  const LIMIT=150;
  const VALID_SOURCES=new Set(["KRAKEN","YAHOO_FINANCE","ALPACA_IEX"]);
  const SYMBOLS=new Set(["BTC/USD","SPY"]);
  const BIASES=new Set(["BULLISH","BEARISH","NEUTRAL"]);
  const PERIODS=[9,20,50,200];
  const CLOSE_GRACE_MS=45000;
  function storageOrNull(){
    try{return root?.localStorage||null;}catch(_){return null;}
  }
  function timeMs(value){
    if(typeof value!=="string"||!/([zZ]|[+-]\d{2}:\d{2})$/.test(value))return NaN;
    return Date.parse(value);
  }
  function finite(value){
    return typeof value==="number"&&Number.isFinite(value);
  }
  function clean(raw){
    if(!raw||typeof raw!=="object"||raw.version!==1||!SYMBOLS.has(raw.symbol)||
       ![5,15].includes(raw.intervalMinutes)||!VALID_SOURCES.has(raw.feedSource)||
       !BIASES.has(raw.bias)||!Number.isInteger(raw.score)||raw.score< -8||raw.score>8||
       !finite(raw.closePrice)||raw.closePrice<=0||!Array.isArray(raw.votes)||raw.votes.length!==8)return null;
    const observed=timeMs(raw.observedAt),closed=timeMs(raw.candleClosedAt);
    if(!Number.isFinite(observed)||!Number.isFinite(closed)||observed<closed||
       observed-closed>raw.intervalMinutes*60000+CLOSE_GRACE_MS||observed>Date.now()+5000)return null;
    const votes=[];
    for(const vote of raw.votes){
      if(!vote||typeof vote.name!=="string"||vote.name.length<1||vote.name.length>80||
         ![-1,0,1].includes(vote.dir))return null;
      votes.push({name:vote.name,dir:vote.dir});
    }
    if(votes.reduce((total,v)=>total+v.dir,0)!==raw.score)return null;
    if(!raw.ema||typeof raw.ema!=="object"||
       !PERIODS.every(period=>finite(raw.ema[period])&&raw.ema[period]>0))return null;
    const ema=Object.fromEntries(PERIODS.map(p=>[p,raw.ema[p]]));
    const result={
      version:1,type:"observed_chart_read",symbol:raw.symbol,
      intervalMinutes:raw.intervalMinutes,feedSource:raw.feedSource,
      observedAt:new Date(observed).toISOString(),
      candleClosedAt:new Date(closed).toISOString(),
      closePrice:raw.closePrice,bias:raw.bias,score:raw.score,
      ema,votes,contract:null,
      outcome:null,trade:null,calibratedProbability:null
    };
    // Optional market context is retained only if source and time window are verified.
    const m=raw.contract;
    if(m&&m.venue==="us"&&typeof m.id==="string"&&/^[a-zA-Z0-9_-]{1,90}$/.test(m.id)&&
       typeof m.slug==="string"&&/^[a-z0-9-]{4,180}$/.test(m.slug)&&
       m.intervalMinutes===raw.intervalMinutes&&finite(m.target)&&m.target>0&&
       Number.isFinite(timeMs(m.startsAt))&&Number.isFinite(timeMs(m.endsAt))&&
       timeMs(m.startsAt)<=observed&&timeMs(m.endsAt)>observed){
      result.contract={venue:"us",id:m.id,slug:m.slug,intervalMinutes:m.intervalMinutes,
        target:m.target,startsAt:new Date(timeMs(m.startsAt)).toISOString(),
        endsAt:new Date(timeMs(m.endsAt)).toISOString()};
      // A verified market may have been associated AFTER the chart read.
      // Preserve that provenance; it is not evidence the market was known then.
      const linked=timeMs(m.linkedAt);
      if(Number.isFinite(linked)&&linked>=observed&&linked<=timeMs(m.endsAt)&&linked<=Date.now()+5000)
        result.contract.linkedAt=new Date(linked).toISOString();
      // Accept either a fresh raw market-context snapshot or our own stored
      // canonical quote shape. Validate against the ORIGINAL observation time,
      // not the current time when Past Reads is reopened days later.
      const quotedAt=m.quoteCheckedAt||m.quote?.retrievedAt;
      const upRaw=m.quote?m.quote.upAsk:m.upAsk;
      const downRaw=m.quote?m.quote.downAsk:m.downAsk;
      if(quotedAt&&Number.isFinite(timeMs(quotedAt))&&
         timeMs(quotedAt)<=observed&&observed-timeMs(quotedAt)<=12000){
        const up=finite(upRaw)&&upRaw>0&&upRaw<1?upRaw:null;
        const down=finite(downRaw)&&downRaw>0&&downRaw<1?downRaw:null;
        if(up!==null||down!==null){
          result.contract.quote={upAsk:up,downAsk:down,
            retrievedAt:new Date(timeMs(quotedAt)).toISOString(),
            type:"indicative_ask_not_guaranteed_execution"};
        }
      }
    }
    return result;
  }
  function identity(entry){
    return entry.symbol+"|"+entry.intervalMinutes+"|"+entry.candleClosedAt;
  }
  function read(store=storageOrNull()){
    if(!store)return [];
    try{
      const raw=JSON.parse(store.getItem(KEY)||"[]");
      if(!Array.isArray(raw))return [];
      const seen=new Set(),results=[];
      for(const item of raw){
        const entry=clean(item);
        if(!entry)continue;
        const key=identity(entry);
        if(seen.has(key))continue;
        seen.add(key);results.push(entry);
      }
      return results.sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)).slice(0,LIMIT);
    }catch(_){return [];}
  }
  function record(raw,store=storageOrNull()){
    const entry=clean(raw);
    if(!entry)return {saved:false,reason:"invalid_or_unverified"};
    if(!store)return {saved:false,reason:"storage_unavailable"};
    const all=read(store);
    if(all.some(item=>identity(item)===identity(entry)))return {saved:false,reason:"already_recorded"};
    const entries=[entry,...all].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)).slice(0,LIMIT);
    try{
      store.setItem(KEY,JSON.stringify(entries));
      return {saved:true,count:entries.length,entry};
    }catch(_){return {saved:false,reason:"storage_unavailable"};}
  }
  function linkMarket(market,store=storageOrNull(),linkedAt=new Date().toISOString()){
    // Late market discovery may enrich the metadata of an existing read,
    // but NEVER fabricate a historical ask or change its original chart score.
    const attached=timeMs(linkedAt),starts=timeMs(market?.startsAt),ends=timeMs(market?.endsAt);
    if(!store||market?.venue!=="us"||typeof market.id!=="string"||
       !/^[a-zA-Z0-9_-]{1,90}$/.test(market.id)||
       typeof market.slug!=="string"||!/^[a-z0-9-]{4,180}$/.test(market.slug)||
       ![5,15].includes(market.intervalMinutes)||
       !finite(market.target)||market.target<=0||
       !Number.isFinite(starts)||!Number.isFinite(ends)||
       ends-starts!==market.intervalMinutes*60000||
       !Number.isFinite(attached)||attached>ends||attached<starts||attached>Date.now()+5000)
      return {linked:0,reason:"invalid_market_context"};
    const rows=read(store);
    let linked=0;
    const changed=rows.map(row=>{
      const observed=timeMs(row.observedAt);
      if(row.symbol!=="BTC/USD"||row.intervalMinutes!==market.intervalMinutes||row.contract||
         observed<starts||observed>=ends||observed>attached)return row;
      const context={venue:"us",id:market.id,slug:market.slug,
        intervalMinutes:market.intervalMinutes,target:market.target,
        startsAt:market.startsAt,endsAt:market.endsAt,
        linkedAt:linkedAt};
      const entry=clean({...row,contract:context});
      if(!entry?.contract)return row;
      linked++;
      return entry;
    });
    if(!linked)return {linked:0,reason:"no_matching_unlinked_read"};
    try{store.setItem(KEY,JSON.stringify(changed));return {linked};}
    catch(_){return {linked:0,reason:"storage_unavailable"};}
  }
  function clear(store=storageOrNull()){
    if(!store)return false;
    try{store.removeItem(KEY);return true;}catch(_){return false;}
  }
  function csv(items,verifiedSettlementForRead){
    const headers=["observed_at_utc","candle_closed_at_utc","market","minutes","feed",
      "chart_lean","score_minus8_to_8","closed_candle_price","ema_9","ema_20","ema_50","ema_200",
      "contract_id_if_known","contract_target_if_known","up_indicative_ask_if_fresh",
      "down_indicative_ask_if_fresh","contract_identity_linked_after_read_utc",
      "official_settlement_state","official_settlement_outcome","official_settlement_checked_utc",
      "chart_vs_official_outcome_not_trade_return","trade_status"];
    const field=v=>{
      const raw=String(v===null||v===undefined?"":v);
      const escaped=typeof v==="string"&&/^[=+@\t\r-]/.test(raw)?"'"+raw:raw;
      return '"'+escaped.replace(/"/g,'""')+'"';
    };
    const lines=[headers.map(field).join(",")];
    for(const item of items){
      const entry=clean(item);
      if(!entry)continue;
      const settled=typeof verifiedSettlementForRead==="function"?verifiedSettlementForRead(entry):null;
      const official=settled&&entry.contract&&settled.venue==="us"&&settled.id===entry.contract.id&&
        settled.slug===entry.contract.slug&&settled.intervalMinutes===entry.intervalMinutes&&
        ["VERIFIED_UP","VERIFIED_DOWN","NON_BINARY_SETTLEMENT"].includes(settled.state)&&
        (settled.state==="VERIFIED_UP"&&settled.outcome==="UP"||
         settled.state==="VERIFIED_DOWN"&&settled.outcome==="DOWN"||
         settled.state==="NON_BINARY_SETTLEMENT"&&settled.outcome===null)
        ?settled:null;
      const direction=entry.bias==="BULLISH"?"UP":entry.bias==="BEARISH"?"DOWN":null;
      const compare=official&&official.outcome&&direction?
        (official.outcome===direction?"DIRECTION_MATCHED_NOT_PNL":"DIRECTION_DIFFERED_NOT_PNL"):
        "NOT_EVALUATED";
      lines.push([
        entry.observedAt,entry.candleClosedAt,entry.symbol,entry.intervalMinutes,
        entry.feedSource,entry.bias,entry.score,entry.closePrice,
        entry.ema[9],entry.ema[20],entry.ema[50],entry.ema[200],
        entry.contract?.id||"",entry.contract?.target??"",
        entry.contract?.quote?.upAsk??"",entry.contract?.quote?.downAsk??"",
        entry.contract?.linkedAt??"",
        official?.state??"NOT_VERIFIED",official?.outcome??"",official?.checkedAt??"",
        compare,"NO_TRADE_DATA"
      ].map(field).join(","));
    }
    return lines.join("\r\n")+"\r\n";
  }
  return Object.freeze({KEY,LIMIT,clean,read,record,linkMarket,clear,csv});
});
