"use strict";
(function(){
  const $=id=>document.getElementById(id);
  if(!$("poly-panel"))return;
  const HOME="https://polymarket.us/";
  const LIVE_BTC_5M="https://polymarket.us/category/bitcoin-5m";
  const LIVE_BTC_15M="https://polymarket.us/category/bitcoin-15m";
  let seq=0,market=null,request=null,priceRequest=null,quoteAt=0;
  let officialAvailable=false,officialStatusAt=0,priceUpdatedAt=0;
  let refreshAfterExpiry=false;
  const usd=x=>typeof x==="number"&&Number.isFinite(x)?"$"+x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"Check app";
  const money=x=>Number.isFinite(x)?(x*100).toFixed(Math.abs((x*100)%1)<.01?0:1)+"¢":"Check app";
  const fresh=x=>Number.isFinite(x)&&Date.now()-x<30000;
  const active=()=>$("pair").value==="BTC/USD"&&$("source").value==="live"&&document.visibilityState==="visible";
  function links(){
    const spy=$("pair").value==="SPY";
    const interval=Number($("interval").value);
    // Stable official category pages point to the current rolling market.
    // Per-event URLs may expire before iOS finishes switching into the app.
    const final=spy?HOME:(interval===15?LIVE_BTC_15M:LIVE_BTC_5M);
    $("poly-market-link").href=final;
    $("polymarket-link").href=final;
    $("poly-market-link").textContent=spy?"Open Polymarket US":("Open live BTC "+interval+"m in Polymarket");
    $("polymarket-link").textContent=spy?"Open Polymarket US":("Open live BTC "+interval+"m in Polymarket");
  }
  function referenceReset(text){
    $("reference-label").textContent="LIVE BTC SPOT";
    $("delta-label").textContent="EST. VS TARGET";
    $("brti-price").textContent="Loading price...";
    $("brti-delta").textContent="Checking...";
    $("brti-delta").className="";
    $("brti-status").textContent=text||"Connecting to live Bitcoin price feed...";
    priceUpdatedAt=0;
  }
  function putPrice(x,type,target){
    const current=Number(x.price),time=Date.parse(x.observedAt||x.sampledAt);
    if(!Number.isFinite(current)||current<=0||!Number.isFinite(time)||Date.now()-time>20000||time>Date.now()+5000)
      return false;
    const exact=type==="brti";
    $("reference-label").textContent=exact?"OFFICIAL BRTI INDEX":"LIVE BTC SPOT";
    $("delta-label").textContent=exact?"BRTI VS TARGET":"SPOT VS BRTI TARGET (EST.)";
    $("brti-price").textContent=usd(current);
    const delta=Number.isFinite(target)?current-target:null;
    $("brti-delta").textContent=delta===null?"Check app":(delta>=0?"+":"-")+usd(Math.abs(delta));
    $("brti-delta").className=delta===null?"":delta>=0?"positive":"negative";
    const observed=new Date(time).toLocaleTimeString([],{hour:"numeric",minute:"2-digit",second:"2-digit"});
    $("brti-status").textContent=exact
      ?"Official BRTI index at "+observed+". Instant reading only; the contract uses the final minute average."
      :(x.source||"BTC spot")+" at "+observed+". Live spot estimate, NOT BRTI. The final contract uses the official BRTI average.";
    priceUpdatedAt=Date.now();
    return true;
  }
  async function loadJson(path,signal){
    const response=await fetch(path,{signal,cache:"no-store"});
    const body=await response.json();
    if(!response.ok)throw new Error("Feed request failed");
    return body;
  }
  async function updatePrice(){
    if(!active()||!market)return;
    if(priceRequest)priceRequest.abort();
    const mySeq=seq,forMarket=market.id;
    const ctrl=new AbortController();priceRequest=ctrl;
    const timeout=setTimeout(()=>ctrl.abort(),7800);
    const target=market.target;
    try{
      // Try the licensed official index once a minute, or every 5s if active.
      if(officialAvailable||Date.now()-officialStatusAt>60000){
        officialStatusAt=Date.now();
        try{
          const brti=await loadJson("/api/reference",ctrl.signal);
          if(mySeq!==seq||!market||market.id!==forMarket)return;
          officialAvailable=!!brti.available;
          if(officialAvailable&&putPrice(brti,"brti",target))return;
        }catch(e){officialAvailable=false;}
      }
      const spot=await loadJson("/api/spot",ctrl.signal);
      if(mySeq!==seq||!market||market.id!==forMarket)return;
      if(!spot.available||!putPrice(spot,"spot",target))throw new Error("Spot not fresh");
    }catch(e){
      if(mySeq!==seq||!market||market.id!==forMarket)return;
      if(!fresh(priceUpdatedAt))referenceReset("Reconnecting to BTC spot. Check the price in Polymarket while it refreshes.");
    }finally{clearTimeout(timeout);}
  }
  function showQuotes(data){
    const q=data.quotes||{},last=data.indicative||{};
    const up=Number.isFinite(q.upAsk)?q.upAsk:null;
    const down=Number.isFinite(q.downAsk)?q.downAsk:null;
    const hasQuote=up!==null||down!==null;
    const hasLast=Number.isFinite(last.upLast);
    if(hasQuote){
      $("poly-up-label").textContent="BUY UP";
      $("poly-down-label").textContent="BUY DOWN";
      $("poly-up").textContent=up===null?"Check app":money(up);
      $("poly-down").textContent=down===null?"Check app":money(down);
      $("poly-up-caption").textContent="Current indicative ask";
      $("poly-down-caption").textContent="Current indicative ask";
      $("poly-feed-tag").textContent="LIVE CONTRACT + QUOTES";
      quoteAt=Date.now();
    }else if(hasLast){
      $("poly-up-label").textContent="UP LAST TRADE";
      $("poly-down-label").textContent="DOWN IMPLIED REF.";
      $("poly-up").textContent=money(last.upLast);
      $("poly-down").textContent=money(last.downLast);
      $("poly-up-caption").textContent="Historical trade, not a buy price";
      $("poly-down-caption").textContent="1 minus Up trade; not an ask";
      $("poly-feed-tag").textContent="LIVE CONTRACT";
      quoteAt=0;
    }else{
      $("poly-up-label").textContent="BUY UP";
      $("poly-down-label").textContent="BUY DOWN";
      $("poly-up").textContent="Check app";
      $("poly-down").textContent="Check app";
      $("poly-up-caption").textContent="No verified order-book ask";
      $("poly-down-caption").textContent="No verified order-book ask";
      $("poly-feed-tag").textContent="LIVE CONTRACT";
      quoteAt=0;
    }
    $("poly-disclosure").textContent=hasQuote
      ?"Displayed asks are indicative and may change before you place an order. They are not Bender's predicted odds."
      :hasLast
      ?"Last trade values are only price context. They are not offers you can buy at. Confirm buy prices in the live Polymarket market."
      :"No trustworthy order-book quote was published. Open the live BTC market in Polymarket to check current buy prices.";
  }
  function noContract(message){
    market=null;quoteAt=0;
    $("poly-message").hidden=false;
    $("poly-message").textContent=message;
    $("poly-fields").hidden=true;
    $("poly-feed-tag").textContent="CHECKING MARKET";
    links();
  }
  function showMarket(data){
    const m=data.market||{};
    const end=Date.parse(m.endsAt);
    if(!Number.isFinite(end)||end<=Date.now())return noContract("Waiting for the next live BTC contract.");
    const switched=!market||market.id!==m.id;
    market=m;
    $("poly-message").hidden=true;
    $("poly-fields").hidden=false;
    $("poly-market-name").textContent="BTC Up or Down";
    $("poly-window").textContent=data.interval+" MIN";
    $("poly-target").textContent=usd(m.target);
    $("poly-closes").textContent="Ends "+new Date(end).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    $("poly-source-label").textContent="Contract + prices: Polymarket US";
    $("poly-read").textContent="Up wins if the final BRTI minute average is at least the opening target. Down wins if it is lower.";
    links();
    showQuotes(data);
    if(switched){referenceReset();updatePrice();}
    tick();
  }
  function tick(){
    if(!market)return;
    const end=Date.parse(market.endsAt);
    if(!Number.isFinite(end))return;
    const seconds=Math.max(0,Math.ceil((end-Date.now())/1000));
    $("poly-countdown").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
    if(seconds===0){
      $("poly-up").textContent="Closed";$("poly-down").textContent="Closed";
      $("poly-feed-tag").textContent="WINDOW ENDED";
      if(!refreshAfterExpiry){refreshAfterExpiry=true;setTimeout(()=>refresh(true),500);}
    }else{refreshAfterExpiry=false;}
    if(quoteAt&&Date.now()-quoteAt>30000&&seconds>0){
      $("poly-up").textContent="Check app";$("poly-down").textContent="Check app";
      $("poly-feed-tag").textContent="QUOTE AGED";
      quoteAt=0;
    }
    if(priceUpdatedAt&&Date.now()-priceUpdatedAt>20000&&seconds>0){
      referenceReset("Refreshing live spot. A previous price is no longer shown.");
    }
  }
  async function refresh(hard=false){
    const id=++seq;
    if(request)request.abort();
    if(priceRequest)priceRequest.abort();
    const spotOnly=$("pair").value==="BTC/USD"&&$("source").value==="live";
    $("poly-panel").hidden=$("pair").value==="SPY";
    if(!spotOnly){
      market=null;links();
      if($("source").value==="demo"&&$("pair").value==="BTC/USD")
        noContract("Practice mode is on. Real contract information is hidden so practice prices cannot be confused with the market.");
      return;
    }
    links();
    if(hard||!market)noContract("Finding the current BTC contract...");
    const ctrl=new AbortController();request=ctrl;const timeout=setTimeout(()=>ctrl.abort(),10500);
    try{
      const data=await loadJson("/api/polymarket?interval="+Number($("interval").value),ctrl.signal);
      if(id!==seq)return;
      if(!data.available){noContract("No current verified contract in the feed. Tap through to Polymarket US to check the available markets.");return;}
      showMarket(data);
    }catch(e){
      if(id!==seq)return;
      if(!market)noContract("Live contract search is retrying. You can still open Polymarket US below.");
      else $("poly-feed-tag").textContent="CHECKING...";
    }finally{clearTimeout(timeout);}
  }
  for(const name of ["pair","interval","source"])$(name).addEventListener("change",()=>refresh(true));
  $("refresh").addEventListener("click",()=>{refresh(false);updatePrice();});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh(true);});
  window.addEventListener("pageshow",()=>{if(document.visibilityState==="visible")refresh(true);});
  setInterval(()=>{if(active())refresh(false);},15000);
  setInterval(()=>{if(active())updatePrice();},5000);
  setInterval(tick,1000);
  links();refresh(true);
})();