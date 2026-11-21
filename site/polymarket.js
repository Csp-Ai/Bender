"use strict";
(function(){
  const $=id=>document.getElementById(id);
  if(!$("poly-panel"))return;
  const HOME="https://polymarket.us/";
  const CATEGORIES={5:"https://polymarket.us/category/bitcoin-5m",15:"https://polymarket.us/category/bitcoin-15m"};
  const usd=x=>Number.isFinite(x)?"$"+x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"Unavailable";
  const money=x=>Number.isFinite(x)?(x*100).toFixed(1).replace(/\.0$/,"")+"¢":"Unavailable";
  const clock=x=>new Date(x).toLocaleTimeString([],{hour:"numeric",minute:"2-digit",second:"2-digit"});
  const validAt=x=>Number.isFinite(Date.parse(x))&&Date.parse(x)<=Date.now()+5000;
  let market=null,marketRequest=null,quoteRequest=null,priceRequest=null,marketCheckedAt=0;
  let generation=0,quoteAt=0,latestQuotes=null,priceUpdatedAt=0,officialAvailable=false,officialStatusAt=0,expiredRefresh=false;
  const active=()=>$("pair").value==="BTC/USD"&&$("source").value==="live"&&document.visibilityState==="visible";
  const identity=m=>m&&[m.id,m.slug,m.endsAt].join("|");
  // Read-only context for the chart journal. Only market IDs already verified
  // by contract discovery are included; indicative quotes must remain fresh.
  window.BenderLiveContractContext=()=>{
    if(!market||!active()||Date.parse(market.endsAt)<=Date.now())return null;
    const context={venue:"us",id:String(market.id),slug:market.slug,
      intervalMinutes:Number($("interval").value),target:market.target,
      startsAt:market.startsAt,endsAt:market.endsAt};
    if(latestQuotes&&quoteAt>0&&Date.now()-quoteAt<=12000){
      context.quoteCheckedAt=new Date(quoteAt).toISOString();
      context.upAsk=latestQuotes.upAsk;context.downAsk=latestQuotes.downAsk;
    }
    return context;
  };
  function links(){
    const interval=Number($("interval").value),spy=$("pair").value==="SPY";
    const url=spy?HOME:(CATEGORIES[interval]||HOME);
    for(const id of ["poly-market-link","polymarket-link"]){
      $(id).href=url;
      $(id).textContent=spy?"Open Polymarket US":"Open live BTC "+interval+"m in Polymarket";
    }
  }
  function readiness(message,state="waiting"){
    const el=$("poly-readiness");
    if(el){el.textContent=message;el.dataset.state=state;}
  }
  function edgeState(){
    $("poly-decision").textContent="NO VERIFIED EDGE — Bender's chart score is not a contract win probability. No calibrated model is enabled.";
  }
  function referenceReset(message){
    $("reference-label").textContent="LIVE BTC SPOT";
    $("delta-label").textContent="EST. VS TARGET";
    $("brti-price").textContent="Checking...";
    $("brti-delta").textContent="Unavailable";$("brti-delta").className="";
    $("brti-status").textContent=message||"Checking the BTC reference source...";
    priceUpdatedAt=0;
  }
  function putPrice(body,type,target){
    const current=Number(body.price),stamp=Date.parse(body.observedAt||body.sampledAt);
    if(!(current>0)||!Number.isFinite(stamp)||Date.now()-stamp>20000||stamp>Date.now()+5000)return false;
    const official=type==="brti";
    $("reference-label").textContent=official?"OFFICIAL BRTI INDEX":"LIVE BTC SPOT";
    $("delta-label").textContent=official?"BRTI VS TARGET":"SPOT VS BRTI TARGET (EST.)";
    $("brti-price").textContent=usd(current);
    const delta=Number.isFinite(target)?current-target:null;
    $("brti-delta").textContent=delta===null?"Unavailable":(delta<0?"-":"+")+usd(Math.abs(delta));
    $("brti-delta").className=delta===null?"":delta>=0?"positive":"negative";
    $("brti-status").textContent=official
      ?"Official BRTI instant reading at "+clock(stamp)+". The contract uses minute averages, not a single tick."
      :(body.source||"Spot")+" at "+clock(stamp)+". Different feed from BRTI, so this comparison is only an estimate.";
    priceUpdatedAt=Date.now();
    return true;
  }
  async function loadJson(url,signal){
    const response=await fetch(url,{signal,cache:"no-store"});
    const json=await response.json();
    if(!response.ok)throw Error("Feed HTTP "+response.status);
    return json;
  }
  async function updatePrice(){
    if(!active()||!market||priceRequest)return;
    const key=identity(market),currentGeneration=generation;
    const ctrl=new AbortController();priceRequest=ctrl;
    const timeout=setTimeout(()=>ctrl.abort(),7800);
    const target=market.target;
    try{
      if(officialAvailable||Date.now()-officialStatusAt>60000){
        officialStatusAt=Date.now();
        try{
          const official=await loadJson("/api/reference",ctrl.signal);
          if(currentGeneration!==generation||identity(market)!==key)return;
          officialAvailable=!!official.available;
          if(officialAvailable&&putPrice(official,"brti",target))return;
        }catch(_err){officialAvailable=false;}
      }
      const spot=await loadJson("/api/spot",ctrl.signal);
      if(currentGeneration!==generation||identity(market)!==key)return;
      if(!spot.available||!putPrice(spot,"spot",target))throw Error("Unavailable spot");
    }catch(_err){
      if(currentGeneration===generation&&identity(market)===key&&Date.now()-priceUpdatedAt>20000)
        referenceReset("Spot feed unavailable or old. Do not treat the prior price as current.");
    }finally{clearTimeout(timeout);if(priceRequest===ctrl)priceRequest=null;}
  }
  function clearQuotes(message){
    quoteAt=0;latestQuotes=null;
    $("poly-up-label").textContent="BUY UP";
    $("poly-down-label").textContent="BUY DOWN";
    $("poly-up").textContent="Unavailable";$("poly-down").textContent="Unavailable";
    $("poly-up-caption").textContent="No current verified ask";
    $("poly-down-caption").textContent="No current verified ask";
    $("poly-feed-tag").textContent="CONTRACT VERIFIED · QUOTE PENDING";
    $("poly-disclosure").textContent="Quote unavailable. Market prices are not independent Bender predictions.";
    readiness(message||"Contract verified. Waiting for an independent order-book quote.");
  }
  function showQuotes(data){
    if(!validAt(data.checkedAt)||Date.now()-Date.parse(data.checkedAt)>15000){
      clearQuotes("Quote response arrived too late; waiting for a fresh quote.");
      return;
    }
    const q=data.quotes||{},last=data.indicative||{};
    const up=Number.isFinite(q.upAsk)?q.upAsk:null;
    const down=Number.isFinite(q.downAsk)?q.downAsk:null;
    const hasQuote=up!==null||down!==null;
    const hasLast=Number.isFinite(last.upLast);
    if(hasQuote){
      $("poly-up-label").textContent="BUY UP";
      $("poly-down-label").textContent="BUY DOWN";
      $("poly-up").textContent=money(up);
      $("poly-down").textContent=money(down);
      $("poly-up-caption").textContent="Indicative ask · not a forecast";
      $("poly-down-caption").textContent="Indicative ask · not a forecast";
      $("poly-feed-tag").textContent="CONTRACT + INDICATIVE QUOTES";
      quoteAt=Date.parse(data.checkedAt);latestQuotes={upAsk:up,downAsk:down};
      readiness("Indicative quotes retrieved "+clock(quoteAt)+". Exchange publication time is not verified.","available");
    }else{
      quoteAt=0;latestQuotes=null;
      if(hasLast){
        $("poly-up-label").textContent="UP LAST TRADE";
        $("poly-down-label").textContent="DOWN IMPLIED REFERENCE";
        $("poly-up").textContent=money(last.upLast);
        $("poly-down").textContent=money(last.downLast);
        $("poly-up-caption").textContent="Last trade · not a current ask";
        $("poly-down-caption").textContent="1 minus last trade · not a quote";
      }else{
        $("poly-up-label").textContent="BUY UP";$("poly-down-label").textContent="BUY DOWN";
        $("poly-up").textContent="Unavailable";$("poly-down").textContent="Unavailable";
        $("poly-up-caption").textContent="No current verified ask";
        $("poly-down-caption").textContent="No current verified ask";
      }
      $("poly-feed-tag").textContent="CONTRACT VERIFIED · QUOTE PENDING";
      readiness("Market located. No verified current executable offer; waiting for market liquidity.");
    }
    $("poly-disclosure").textContent=hasQuote
      ?"Indicative asks may change before an order. Quote timestamp is the server retrieval time, not exchange time. Not predicted odds."
      :hasLast?"Last trades are historical context only, not prices that Omar can necessarily buy at."
      :"No verified current order-book offer. Check the official market for execution prices.";
    edgeState();
  }
  async function updateQuotes(){
    if(!active()||!market||quoteRequest)return;
    if(Date.parse(market.endsAt)<=Date.now())return;
    const key=identity(market),currentGeneration=generation;
    const ctrl=new AbortController();quoteRequest=ctrl;
    const timeout=setTimeout(()=>ctrl.abort(),7800);
    try{
      const body=await loadJson("/api/quotes?slug="+encodeURIComponent(market.slug),ctrl.signal);
      if(currentGeneration!==generation||identity(market)!==key)return;
      if(body.slug!==market.slug)throw Error("Wrong quote market");
      showQuotes(body);
    }catch(_err){
      if(currentGeneration!==generation||identity(market)!==key)return;
      if(!quoteAt||Date.now()-quoteAt>12000)clearQuotes("Quote retrieval failed. The contract target remains verified, but buy prices are unavailable.");
      else readiness("Rechecking quotes; previously retrieved indicative prices may change.");
    }finally{clearTimeout(timeout);if(quoteRequest===ctrl)quoteRequest=null;}
  }
  function noContract(message){
    if(market){generation++;if(quoteRequest){quoteRequest.abort();quoteRequest=null;}if(priceRequest){priceRequest.abort();priceRequest=null;}}
    market=null;quoteAt=0;latestQuotes=null;marketCheckedAt=0;
    $("poly-message").hidden=false;$("poly-message").textContent=message;
    $("poly-fields").hidden=true;
    $("poly-feed-tag").textContent="SEARCHING FOR CONTRACT";
    links();
  }
  function showMarket(data){
    const m=data.market||{},start=Date.parse(m.startsAt),end=Date.parse(m.endsAt);
    const interval=Number($("interval").value);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start>Date.now()+10000||end<=Date.now()||
       end-start>interval*60000+20000)return noContract("Contract feed returned an invalid or expired window. Rechecking...");
    const switched=identity(market)!==identity(m);
    if(switched){
      generation++;
      if(quoteRequest){quoteRequest.abort();quoteRequest=null;}
      if(priceRequest){priceRequest.abort();priceRequest=null;}
      quoteAt=0;priceUpdatedAt=0;
    }
    market=m;marketCheckedAt=Date.parse(data.checkedAt)||Date.now();
    $("poly-message").hidden=true;$("poly-fields").hidden=false;
    $("poly-market-name").textContent="BTC Up or Down";
    $("poly-window").textContent=interval+" MIN";
    $("poly-target").textContent=usd(m.target);
    $("poly-closes").textContent="Ends "+new Date(end).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    $("poly-source-label").textContent="Contract: Polymarket US · retrieved "+clock(marketCheckedAt);
    $("poly-read").textContent="Up wins if the final official BRTI minute average reaches the opening target. This is not a spot-price prediction.";
    links();
    if(switched){
      clearQuotes("New contract verified. Retrieving order-book quotes separately...");
      referenceReset();updateQuotes();updatePrice();
    }
    tick();
  }
  function tick(){
    if(!market)return;
    const end=Date.parse(market.endsAt);
    const sec=Math.max(0,Math.ceil((end-Date.now())/1000));
    $("poly-countdown").textContent=String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
    if(sec===0){
      $("poly-up").textContent="Ended";$("poly-down").textContent="Ended";
      $("poly-feed-tag").textContent="WINDOW ENDED";quoteAt=0;
      readiness("Contract window ended. Finding the next verified contract.","waiting");
      if(!expiredRefresh){expiredRefresh=true;refreshContracts(true);}
    }else{expiredRefresh=false;}
    if(quoteAt&&Date.now()-quoteAt>12000&&sec>0)clearQuotes("Quote aged out. Checking for a new order-book offer.");
    if(priceUpdatedAt&&Date.now()-priceUpdatedAt>20000&&sec>0)referenceReset("Spot price aged out. Rechecking.");
  }
  async function refreshContracts(force=false){
    $("poly-panel").hidden=$("pair").value==="SPY";
    links();
    if(!active()){
      if(!market||force)noContract($("source").value==="demo"?"Practice mode: live contracts are hidden.":"BTC US contracts only; select Bitcoin and Real Prices.");
      return;
    }
    if(marketRequest){if(!force)return;marketRequest.abort();marketRequest=null;}
    if(force)noContract("Finding the current verified BTC contract...");
    const currentGeneration=generation,selectedInterval=Number($("interval").value);
    const ctrl=new AbortController();marketRequest=ctrl;
    const timeout=setTimeout(()=>ctrl.abort(),7800);
    try{
      const body=await loadJson("/api/contract?interval="+selectedInterval,ctrl.signal);
      if(marketRequest!==ctrl||currentGeneration!==generation||!active()||Number($("interval").value)!==selectedInterval)return;
      if(!body.available||!body.market){
        noContract("No current verified contract in the public feed. Checking again shortly.");
        return;
      }
      showMarket(body);
    }catch(_err){
      if(marketRequest!==ctrl||currentGeneration!==generation)return;
      if(!market)noContract("Contract discovery is delayed. Bender is retrying; the official market link remains available.");
      else readiness("Contract lookup delayed. Existing contract information is being checked.");
    }finally{clearTimeout(timeout);if(marketRequest===ctrl)marketRequest=null;}
  }
  function resetAndRefresh(){
    if(marketRequest){marketRequest.abort();marketRequest=null;}
    noContract("Switching contract window...");
    refreshContracts();
  }
  for(const id of ["pair","interval","source"])$(id).addEventListener("change",resetAndRefresh);
  $("refresh").addEventListener("click",()=>{refreshContracts();updateQuotes();updatePrice();});
  document.addEventListener("visibilitychange",()=>{if(active())refreshContracts();});
  window.addEventListener("pageshow",()=>{if(active())refreshContracts();});
  // Short discovery interval around rollover; independent frequent quote checks.
  setInterval(()=>{
    if(!active())return;
    const remaining=market?Date.parse(market.endsAt)-Date.now():0;
    const cadence=!market||remaining<25000?3000:12000;
    if(!marketCheckedAt||Date.now()-marketCheckedAt>=cadence)refreshContracts();
  },3000);
  setInterval(()=>{if(active())updateQuotes();},5000);
  setInterval(()=>{if(active())updatePrice();},5000);
  setInterval(tick,1000);
  links();edgeState();refreshContracts();
})();