"use strict";
(function(){
  const $=id=>document.getElementById(id),panel=$("poly-panel");
  if(!panel)return;
  let generation=0,controller=null,activeEnd=null,latestQuoteAt=0,refController=null;
  const fmt=x=>Number.isFinite(x)?"$"+x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"Not available";
  const cents=x=>Number.isFinite(x)?(x*100).toFixed((x*100)%1?1:0)+"¢":"Not available";
  function note(text){$("poly-message").hidden=false;$("poly-message").textContent=text;$("poly-fields").hidden=true;}
  function resetReference(text){
    $("brti-price").textContent="Not connected";
    $("brti-delta").textContent="Not available";
    $("brti-delta").className="";
    $("brti-status").textContent=text||"Official BRTI data access is not connected.";
  }
  function reset(){
    activeEnd=null;latestQuoteAt=0;
    $("poly-target").textContent="Not available";$("poly-countdown").textContent="--:--";
    $("poly-up").textContent="Not available";$("poly-down").textContent="Not available";
    $("poly-market-link").href="https://polymarket.us/category/btc";
    $("poly-feed-tag").textContent="Checking market...";
    $("poly-source-label").textContent="Source: Polymarket US";
    resetReference();
  }
  function applicable(){
    panel.hidden=$("pair").value==="SPY";
    if(panel.hidden)return false;
    if($("source").value==="demo"){note("Practice mode is on. Live contract quotes are hidden so fake chart prices are never confused with a real trade.");$("poly-feed-tag").textContent="PRACTICE";return false;}
    return true;
  }
  function tick(){
    if(!activeEnd)return;
    const remaining=Math.max(0,Math.ceil((activeEnd-Date.now())/1000));
    $("poly-countdown").textContent=String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(remaining%60).padStart(2,"0");
    if(remaining===0){
      $("poly-feed-tag").textContent="CONTRACT ENDED";
      $("poly-up").textContent="Expired";$("poly-down").textContent="Expired";
      $("brti-delta").textContent="Expired";
      $("poly-read").textContent="This window ended. The next verified contract will load shortly.";
    }else if(latestQuoteAt&&Date.now()-latestQuoteAt>30000){
      $("poly-up").textContent="Quote stale";$("poly-down").textContent="Quote stale";
      $("poly-feed-tag").textContent="QUOTE STALE";
    }
  }
  async function reference(seq,market){
    if(refController)refController.abort();
    resetReference("Checking official BRTI access...");
    if(market.indexSymbol!=="BRTI"||market.target===null){
      resetReference("Cannot compare without a verified BRTI target.");return;
    }
    const rc=new AbortController();refController=rc;
    try{
      const timer=setTimeout(()=>rc.abort(),9000);
      let response;
      try{response=await fetch("/api/reference",{signal:rc.signal,cache:"no-store"});}
      finally{clearTimeout(timer);}
      const j=await response.json();
      if(seq!==generation||!response.ok)return;
      if(!j.available){
        resetReference(j.message||"Official BRTI data is not connected.");return;
      }
      const time=Date.parse(j.observedAt),price=Number(j.price),target=market.target;
      if(!Number.isFinite(time)||Date.now()-time>15000||time>Date.now()+3000||!Number.isFinite(price)||price<=0){
        resetReference("Index reading is stale or invalid.");return;
      }
      const delta=price-target;
      $("brti-price").textContent=fmt(price);
      $("brti-delta").textContent=(delta>=0?"+":"-")+fmt(Math.abs(delta));
      $("brti-delta").className=delta>=0?"positive":"negative";
      $("brti-status").textContent="Instant BRTI reading, observed "+new Date(time).toLocaleTimeString()+
        ". Not the final 60-second settlement average.";
    }catch(e){if(seq===generation)resetReference("Official BRTI reading could not be verified.");}
  }
  function show(d){
    const m=d.market,ends=Date.parse(m.endsAt);
    if(!Number.isFinite(ends)||ends<=Date.now()){note("This window ended. Checking for a new one.");reset();return;}
    activeEnd=ends;
    $("poly-message").hidden=true;$("poly-fields").hidden=false;
    $("poly-market-name").textContent="BTC Up or Down";$("poly-window").textContent=d.interval+" MIN";
    $("poly-target").textContent=fmt(m.target);
    $("poly-closes").textContent="Ends "+new Date(ends).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    $("poly-market-link").href=m.url;
    const q=d.quotes||{};
    $("poly-up").textContent=cents(q.upAsk);
    $("poly-down").textContent=cents(q.downAsk);
    latestQuoteAt=Date.now();
    $("poly-feed-tag").textContent="LIVE CONTRACT";
    $("poly-source-label").textContent="Polymarket US contract + buy quotes";
    $("poly-read").textContent="UP wins if the final minute BRTI average is at least the opening minute average. DOWN wins if it is lower.";
    const warnings=(d.warnings||[]).filter(x=>!x.includes("Live BRTI")).join(" ");
    $("poly-disclosure").textContent="Buy prices are quotes, not Bender's win probabilities. "+
      "The official BRTI target can differ from Kraken spot. "+warnings;
    tick();
  }
  async function refresh(resetUI=false){
    const seq=++generation;
    if(controller)controller.abort();
    if(refController)refController.abort();
    if(!applicable()){reset();return;}
    if(resetUI||!activeEnd){reset();note("Looking for the current BTC contract...");}
    controller=new AbortController();
    try{
      const timer=setTimeout(()=>controller.abort(),11000);
      let response;
      try{response=await fetch("/api/polymarket?interval="+Number($("interval").value),{signal:controller.signal,cache:"no-store"});}
      finally{clearTimeout(timer);}
      const data=await response.json();
      if(seq!==generation)return;
      if(!response.ok)throw new Error("Feed unavailable");
      if(!data.available){
        reset();note(data.reason||"No verified live BTC contract. Check the official app.");
        $("poly-feed-tag").textContent="NOT VERIFIED";return;
      }
      show(data);
      reference(seq,data.market);
    }catch(e){
      if(seq!==generation)return;
      $("poly-feed-tag").textContent="FEED OFFLINE";
      $("poly-up").textContent="Unavailable";$("poly-down").textContent="Unavailable";
      latestQuoteAt=0;
      if(!activeEnd)note("Could not verify a live contract. Check Polymarket US.");
      resetReference("Official reference cannot be verified while the contract feed is offline.");
    }
  }
  ["pair","interval","source"].forEach(id=>$(id).addEventListener("change",()=>refresh(true)));
  $("refresh").addEventListener("click",()=>refresh(false));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh(true);});
  setInterval(()=>{if(document.visibilityState==="visible"&&applicable())refresh(false);},15000);
  setInterval(tick,1000);
  refresh(true);
})();
