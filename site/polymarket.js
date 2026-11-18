"use strict";
(function(){
  const $=id=>document.getElementById(id);
  const panel=$("poly-panel");
  if(!panel)return;
  let generation=0,ctrl=null,next=null,activeEnd=null,lastGoodAt=0;
  const fmt=x=>typeof x==="number"&&Number.isFinite(x)?"$"+x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"Not available";
  const cents=x=>typeof x==="number"&&Number.isFinite(x)?(x*100).toFixed(x*100%1?1:0)+"¢":"Not available";
  const ends=x=>new Date(x).toLocaleTimeString([],{hour:"numeric",minute:"2-digit",timeZoneName:"short"});
  function note(message){
    $("poly-message").hidden=false;$("poly-message").textContent=message;
    $("poly-fields").hidden=true;
  }
  function choose(){
    const spy=$("pair").value==="SPY";
    const practice=$("source").value==="demo";
    panel.hidden=spy;
    if(spy)return false;
    if(practice){
      panel.hidden=false;note("Practice mode is on. Live contract details are paused so fake chart data never looks like a live recommendation.");
      $("poly-feed-tag").textContent="PRACTICE";return false;
    }
    return true;
  }
  function clear(){
    activeEnd=null;
    $("poly-target").textContent="Not available";
    $("poly-countdown").textContent="--:--";
    $("poly-up").textContent="Not available";
    $("poly-down").textContent="Not available";
    $("poly-feed-tag").textContent="Checking market...";
    $("poly-market-link").href="https://polymarket.us/category/btc";
    $("poly-source-label").textContent="Source: Polymarket US public market data";
  }
  function countdown(){
    if(!activeEnd)return;
    const left=Math.max(0,Math.ceil((activeEnd-Date.now())/1000));
    $("poly-countdown").textContent=String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0");
    if(left===0){$("poly-feed-tag").textContent="WINDOW ENDED";$("poly-read").textContent="This window has ended. Wait for the next verified contract. Don't use old quotes.";lastGoodAt=0;}
  }
  function display(d){
    const m=d.market;
    activeEnd=Date.parse(m.endsAt);
    if(!Number.isFinite(activeEnd)||activeEnd<=Date.now()){note("That contract has already ended. Checking the next window.");return;}
    $("poly-message").hidden=true;
    $("poly-fields").hidden=false;
    $("poly-market-name").textContent="BTC Up or Down";
    $("poly-window").textContent=d.interval+" MIN";
    $("poly-target").textContent=fmt(m.target);
    $("poly-closes").textContent="Closes at "+ends(m.endsAt);
    $("poly-market-link").href=m.url;
    const q=d.quotes||{};
    $("poly-up").textContent=cents(q.upAsk);
    $("poly-down").textContent=cents(q.downAsk);
    $("poly-feed-tag").textContent="CONTRACT FOUND";
    const rule=m.indexSymbol==="BRTI"?"CF Benchmarks BRTI":"the index listed in its official rules";
    $("poly-source-label").textContent="Source: Polymarket US market and order-book API";
    $("poly-read").textContent="Here's the deal: UP wins if the closing "+rule+" average is at least the opening reference. DOWN wins if it is lower. The clock and target come from the contract, not Bender's Kraken chart.";
    const warn=(d.warnings||[]).join(" ");
    $("poly-disclosure").textContent=
      "Live BRTI price is NOT connected, so Bender cannot verify how far BTC is above or below the official target. "+
      "Prices here are quotes, not Bender win odds. Check the actual contract, fees and available prices before any trade. "+warn;
    countdown();
    lastGoodAt=Date.now();
  }
  async function refresh(){
    const seq=++generation;
    if(ctrl)ctrl.abort();
    clear();
    if(!choose())return;
    const interval=Number($("interval").value);
    note("Looking for a verified BTC "+interval+"-minute Polymarket US contract...");
    ctrl=new AbortController();
    try{
      const t=setTimeout(()=>ctrl.abort(),12000);
      let response;
      try{response=await fetch("/api/polymarket?interval="+interval,{signal:ctrl.signal,cache:"no-store"});}
      finally{clearTimeout(t);}
      const d=await response.json();
      if(seq!==generation)return;
      if(!response.ok)throw new Error(d.error||"The contract feed is unavailable");
      if(!d.available){note(d.reason||"No live contract verified yet. Check Polymarket US.");$("poly-feed-tag").textContent="NOT VERIFIED";return;}
      display(d);
    }catch(e){
      if(seq!==generation)return;
      note("Can't verify this contract right now. Check Polymarket US directly. No odds or target will be guessed.");
      $("poly-feed-tag").textContent="FEED UNAVAILABLE";
    }
  }
  ["pair","interval","source"].forEach(id=>$(id).addEventListener("change",refresh));
  $("refresh").addEventListener("click",refresh);
  window.addEventListener("pageshow",()=>{if(document.visibilityState==="visible")refresh();});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh();});
  setInterval(()=>{if(document.visibilityState==="visible"&&choose())refresh();},15000);
  setInterval(countdown,1000);
  refresh();
})();
