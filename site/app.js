"use strict";
(function () {
  const $ = id => document.getElementById(id);
  const state = {data:[], analysis:null, loading:false, source:"live", interval:5, symbol:"BTC/USD", hover:-1, requestId:0, controller:null, lastCheckedAt:0, lastClosedAt:0, feedName:"", feedSource:""};
  const colors = {up:"#51dbac",down:"#ff7182",ema9:window.BenderEma.PALETTE[9],ema20:window.BenderEma.PALETTE[20],ema50:window.BenderEma.PALETTE[50],ema200:window.BenderEma.PALETTE[200]};
  const fmt = v => Number.isFinite(v) ? "$" + new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v) : "-";
  const shortTime = s => new Date(s * 1000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const dirName = d => d > 0 ? "UP" : d < 0 ? "DOWN" : "MIXED";
  const readableBias = bias => bias==="BULLISH"?"LEANING UP":bias==="BEARISH"?"LEANING DOWN":"MIXED SIGNALS";
  const dirClass = d => d > 0 ? "bull" : d < 0 ? "bear" : "neutral";
  const timeUtil = window.BenderCandleTime;
  if(!timeUtil||typeof timeUtil.assess!=="function")throw new Error("Candle freshness checks did not load");
  if(!window.BenderEma||typeof window.BenderEma.series!=="function")throw new Error("LFGI moving-average calculations did not load");
  const localTime = timestamp => new Date(timestamp).toLocaleString(undefined,{
    month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"
  });
  function freshness(){
    if(!state.analysis||!state.data.length)return null;
    return timeUtil.assess(state.analysis.last.t,state.interval,Date.now(),state.symbol==="SPY");
  }
  function updateFreshness(){
    const a=state.analysis,live=state.source==="live";
    if(!a)return;
    const f=freshness(),invalid=!f||f.status==="INVALID"||f.status==="FUTURE";
    const ready=live&&!invalid&&f.status==="FRESH";
    const isDemo=!live;
    const closed=f?.status==="MARKET_CLOSED";
    const stale=live&&(f?.status==="DELAYED"||invalid);
    const quick=document.querySelector(".quick-read");
    if(quick)quick.classList.toggle("is-delayed",stale);
    const label=$("quick-status");
    label.classList.toggle("is-delayed",stale);
    label.classList.toggle("is-fresh",ready);
    label.classList.toggle("is-closed",closed);
    let status="CHECKING";
    if(isDemo)status="PRACTICE DATA";
    else if(closed)status="STOCK MARKET CLOSED";
    else if(stale)status="CHART DELAYED";
    else if(ready)status="LATEST CLOSED CANDLE";
    label.textContent=status;
    const closeLabel=f?.closeMs?localTime(f.closeMs):"Unknown";
    $("price-explain").textContent="Closed "+closeLabel+(closed?" | Last stock session":stale?" | Not current":"");
    if(ready||isDemo){
      $("bias").textContent=readableBias(a.bias);
      $("bias").className="stat-value "+dirClass(a.score);
      $("score").textContent=(a.score>0?"+":"")+a.score;
      $("score").className="stat-value "+dirClass(a.score);
    } else {
      $("bias").textContent=closed?"SESSION ENDED":"CHECKING";
      $("bias").className="stat-value muted";
      $("score").textContent="-";
      $("score").className="stat-value muted";
    }
    const explanation=$("quick-text");
    if(isDemo) explanation.textContent="Practice only. These candles are simulated and cannot support a real trade.";
    else if(closed) explanation.textContent="SPY's regular trading session is closed. This is the latest available historical chart, not a live signal.";
    else if(stale) explanation.textContent="The latest completed candle is behind the expected close time. Bender is refreshing the chart. Don't use an older trend score for a short-term contract.";
    else {
      const lead=a.bias==="BULLISH"?"Buyers have momentum in the recent completed candles.":a.bias==="BEARISH"?"Sellers have momentum in the recent completed candles.":"The finished candles show a mixed trend.";
      explanation.textContent=lead+" Last candle closed "+localTime(f.closeMs)+". This is chart direction, not a BRTI settlement forecast.";
    }
  }

  const emaSeries=(values,span)=>window.BenderEma.series(values,span);
  function rsi14(values) {
    let gain=0, loss=0;
    for(let i=1;i<=14;i++){const d=values[i]-values[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0);}
    gain/=14; loss/=14;
    for(let i=15;i<values.length;i++){const d=values[i]-values[i-1];gain=(gain*13+Math.max(d,0))/14;loss=(loss*13+Math.max(-d,0))/14;}
    if(gain===0&&loss===0)return 50;
    if(loss===0)return 100;
    return 100-100/(1+gain/loss);
  }
  function analyze(rows) {
    if (!Array.isArray(rows)||rows.length<210) throw new Error("At least 210 completed candles are required");
    const c=rows.map(x=>x.c);
    const e9=emaSeries(c,9),e20=emaSeries(c,20),e50=emaSeries(c,50),e200=emaSeries(c,200);
    const e12=emaSeries(c,12),e26=emaSeries(c,26);
    const macd=c.map((_,i)=>e12[i]-e26[i]);
    const macdSignal=emaSeries(macd,9);
    const n=c.length-1, last=rows[n], prev=rows[n-1];
    let numerator=0,denominator=0,volSum=0;
    for(let i=n-49;i<=n;i++){const r=rows[i];numerator+=((r.h+r.l+r.c)/3)*r.v;denominator+=r.v;}
    const vwap=denominator>0?numerator/denominator:NaN;
    for(let i=n-19;i<=n;i++)volSum+=rows[i].v;
    const volumeAvg=volSum/20;
    const volumeRatio=volumeAvg>0 ? last.v/volumeAvg : 0;
    const prior=rows.slice(n-20,n);
    const resistance=Math.max(...prior.map(x=>x.h)),support=Math.min(...prior.map(x=>x.l));
    const rsi=rsi14(c);
    const compare=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?Math.sign(a-b):0;
    const votes=[];
    const vote=(name,dir,why)=>votes.push({name,dir,why});
    vote("Short-term trend",compare(e9[n],e20[n]),"EMA 9 vs EMA 20");
    vote("Intermediate trend",compare(last.c,e50[n]),"Price vs EMA 50");
    vote("Long-term structure",compare(e50[n],e200[n]),"EMA 50 vs EMA 200");
    vote("Volume-weighted price",compare(last.c,vwap),"Price vs rolling 50-bar VWAP");
    vote("MACD momentum",compare(macd[n]-macdSignal[n],0),"Histogram " + (macd[n]-macdSignal[n]).toFixed(3));
    vote("RSI context",rsi>=55&&rsi<=75?1:rsi>=25&&rsi<=45?-1:0,"RSI(14) " + rsi.toFixed(1) + " · extreme readings neutralized");
    vote("Range breakout",last.c>resistance?1:last.c<support?-1:0,"Prior 20-bar high/low");
    vote("Volume confirmation",volumeRatio>=1.2?compare(last.c,prev.c):0,"Volume " + volumeRatio.toFixed(2) + "× 20-bar avg");
    const score=votes.reduce((n,v)=>n+v.dir,0);
    const bias=score>=4?"BULLISH":score<=-4?"BEARISH":"NEUTRAL";
    const warnings=[];
    const time=timeUtil.assess(last.t,state.interval,Date.now(),state.symbol==="SPY");
    const age=time.ageMs/1000;
    if (time.status==="DELAYED") warnings.push("Completed candle data is behind the expected close time.");
    if (time.status==="FUTURE"||time.status==="INVALID") warnings.push("Candle timestamps could not be verified.");
    if (rows.slice(-20).some(x=>x.v===0)) warnings.push("Zero-volume candles can distort indicator readings.");
    if (state.source==="demo") warnings.push("Simulated candles: not real prices, not actionable signals.");
    return {score,bias,votes,support,resistance,rsi,e9,e20,e50,e200,age,warnings,last};
  }
  function demo() {
    const count=320,interval=state.interval;
    const now=Math.floor(Date.now()/1000);
    const end=Math.floor(now/(interval*60))*interval*60-interval*60;
    let seed=127;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    let p=state.symbol==="SPY"?650:65000;const rows=[];
    for(let i=0;i<count;i++){
      const o=p;
      p=Math.max(100,p*(1+0.00015+(rand()-.5)*0.006));
      const wiggle=p*rand()*0.002;
      rows.push({t:end-(count-i-1)*interval*60,o,h:Math.max(o,p)+wiggle,l:Math.min(o,p)-wiggle,c:p,v:40+rand()*90});
    }
    return rows;
  }
  async function load(isAuto) {
    if(state.loading && isAuto)return;
    const requestId=++state.requestId;
    if(state.controller)state.controller.abort();
    state.symbol=$("pair").value;state.interval=Number($("interval").value);state.source=$("source").value;
    state.loading=true;
    if(state.analysis)updateFreshness();
    $("refresh").disabled=true;$("refresh").textContent="Checking...";
    $("error").hidden=true;
    $("demoBanner").hidden=state.source!=="demo";
    $("data-status").textContent="UPDATING";
    try {
      let rows;let feedName="",feedSource="";
      if(state.source==="demo"){rows=demo();feedName="Fake practice candles";feedSource="PRACTICE";}
      else {
        const url="/api/candles?symbol="+encodeURIComponent(state.symbol)+"&interval="+state.interval;
        const controller=new AbortController();state.controller=controller;
        const timeout=setTimeout(()=>controller.abort(),12000);
        try{
          const response=await fetch(url,{signal:controller.signal,cache:"no-store"});
          const json=await response.json();
          if(!response.ok)throw new Error(json.error||"Market feed unavailable");
          rows=json.candles;
          feedSource=json.source;
          feedName=json.source==="YAHOO_FINANCE"?"Yahoo Finance SPY candles":json.source==="ALPACA_IEX"?"Alpaca IEX SPY candles":"Kraken BTC spot candles";
        }finally{clearTimeout(timeout);}
      }
      if(requestId!==state.requestId)return;
      if(!rows.every(r=>[r.t,r.o,r.h,r.l,r.c,r.v].every(Number.isFinite)
        &&r.o>0&&r.h>=Math.max(r.o,r.c,r.l)&&r.l<=Math.min(r.o,r.c,r.h)&&r.v>=0))throw new Error("The feed returned invalid candles");
      if(rows.some((r,i)=>i>0&&r.t<=rows[i-1].t))throw new Error("Candle timestamps are out of order");
      state.analysis=analyze(rows);
      state.data=rows;
      state.feedName=feedName;
      state.feedSource=feedSource;
      state.lastClosedAt=(state.analysis.last.t+state.interval*60)*1000;
      state.lastCheckedAt=Date.now();
      state.hover=-1;
      render();
      rememberRead();
      const info=freshness();
      $("data-status").textContent=state.source==="demo"?"PRACTICE MODE":info?.status==="MARKET_CLOSED"?"SPY / MARKET CLOSED":info?.status==="DELAYED"?"CHART DELAYED":state.symbol==="SPY"?"SPY / STOCK CHART":"BTC / KRAKEN CHART";
      $("updated").textContent="Last checked "+new Date(state.lastCheckedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit",second:"2-digit"})+" | "+feedName;
      if(!isAuto)document.title=readableBias(state.analysis.bias)+" | Bender";
    }catch(e){
      if(requestId!==state.requestId)return;
      $("data-status").textContent=state.symbol==="SPY"?"SPY FEED UNAVAILABLE":"PRICE FEED UNAVAILABLE";
      $("quick-status").textContent="FEED UNAVAILABLE";
      if(state.analysis){
        state.analysis=null;state.data=[];state.lastClosedAt=0;
        $("bias").textContent="-";$("bias").className="stat-value muted";
        $("score").textContent="-";$("score").className="stat-value muted";
        $("price").textContent="-";$("price-explain").textContent="No verified current candle";
      }
      $("quick-text").textContent="The chart feed did not return a verified update. Bender has hidden the previous signal so it cannot look current.";
      $("error").textContent="Can’t check this chart right now: "+e.message+" Try again, or use Practice (Fake) to explore the layout.";
      $("error").hidden=false;
    }finally{
      if(requestId===state.requestId){state.loading=false;state.controller=null;$("refresh").disabled=false;$("refresh").textContent="↻  Check chart";}
    }
  }
  function rememberRead(){
    const j=window.BenderReadJournal;
    if(!j||state.source!=="live"||!state.analysis||!state.data.length)return;
    const info=freshness();
    if(!info||info.status!=="FRESH")return;
    const a=state.analysis;
    const context=state.symbol==="BTC/USD"&&typeof window.BenderLiveContractContext==="function"
      ?window.BenderLiveContractContext():null;
    const saved=j.record({
      version:1,symbol:state.symbol,intervalMinutes:state.interval,
      feedSource:state.feedSource,
      observedAt:new Date(state.lastCheckedAt).toISOString(),
      candleClosedAt:new Date(state.lastClosedAt).toISOString(),
      closePrice:a.last.c,bias:a.bias,score:a.score,
      ema:{9:a.e9.at(-1),20:a.e20.at(-1),50:a.e50.at(-1),200:a.e200.at(-1)},
      votes:a.votes.map(v=>({name:v.name,dir:v.dir})),
      contract:context
    });
    if(saved.saved)window.dispatchEvent(new CustomEvent("bender:read-recorded",{detail:{count:saved.count}}));
  }
  function render(){
    const a=state.analysis,rows=state.data,scoreDirection=Math.sign(a.score);
    $("bias").textContent=readableBias(a.bias);$("bias").className="stat-value "+dirClass(a.score);
    $("bias-explain").textContent="Chart trend only";
    $("quick-status").textContent=state.source==="demo"?"Fake practice data":state.symbol==="SPY"?"SPY chart":"BTC spot chart";
    $("score").textContent=(a.score>0?"+":"")+a.score;$("score").className="stat-value "+dirClass(a.score);
    $("score-explain").textContent="-8 to +8, not win odds";
    $("price").textContent=fmt(a.last.c);
    $("price-explain").textContent="Closed "+localTime(state.lastClosedAt);
    $("chart-pair").textContent=state.source==="demo"?"PRACTICE · "+state.symbol:state.symbol.replace("/"," / ");
    $("chart-interval").textContent=state.interval+"m";
    $("chart-subtitle").textContent=state.feedName+" | "+rows.length+" finished candles";
    $("support").textContent=fmt(a.support);
    $("resistance").textContent=fmt(a.resistance);
    $("rsi").textContent=a.rsi.toFixed(1);
    const votes=$("votes");votes.replaceChildren();
    a.votes.forEach(v=>{
      const row=document.createElement("div");row.className="factor";
      const left=document.createElement("div");
      const title=document.createElement("div");title.className="factor-title";title.textContent=v.name;
      const detail=document.createElement("div");detail.className="factor-sub";
      const plain={
        "Short-term trend":{up:"Recent prices have been climbing.",down:"Recent prices have been sliding.",mix:"No clear short-term lean."},
        "Intermediate trend":{up:"Price is above its recent average.",down:"Price is below its recent average.",mix:"Price is near its recent average."},
        "Long-term structure":{up:"The bigger trend points up.",down:"The bigger trend points down.",mix:"The bigger trend isn’t clear."},
        "Volume-weighted price":{up:"Price is above the recent volume-weighted level.",down:"Price is below the recent volume-weighted level.",mix:"No clear read from traded volume."},
        "MACD momentum":{up:"The recent push favors buyers.",down:"The recent push favors sellers.",mix:"Momentum looks balanced."},
        "RSI context":{up:"Momentum is positive without being extreme.",down:"Momentum is negative without being extreme.",mix:"Momentum is stretched or unclear."},
        "Range breakout":{up:"Price just pushed over its recent high.",down:"Price fell under its recent low.",mix:"Price is still inside its recent range."},
        "Volume confirmation":{up:"A higher-volume candle closed up.",down:"A higher-volume candle closed down.",mix:"Not enough extra volume to confirm the move."}
      };
      const wording=plain[v.name];detail.textContent=wording?(v.dir>0?wording.up:v.dir<0?wording.down:wording.mix):v.why;
      const tech=document.createElement("span");tech.className="factor-tech";tech.textContent=v.why;
      left.append(title,detail,tech);
      const tag=document.createElement("span");tag.className="factor-tag "+dirClass(v.dir);tag.textContent=dirName(v.dir);
      row.append(left,tag);votes.appendChild(row);
    });
    updateFreshness();
    const warnings=$("warnings");warnings.replaceChildren();
    a.warnings.forEach(w=>{const div=document.createElement("div");div.className="warning";div.textContent=w;warnings.appendChild(div);});
    if(a.warnings.length===0){warnings.replaceChildren();}
    draw();
  }
  function draw(){
    const canvas=$("chart"), box=canvas.getBoundingClientRect(),w=box.width,h=box.height;
    if(w<5||h<5)return;
    const dpr=window.devicePixelRatio||1;
    canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    if(!state.analysis)return;
    const a=state.analysis, n=state.data.length;
    const start=Math.max(0,n-100), data=state.data.slice(start);
    const left=16,right=w<500?62:75,top=21,bottom=32;
    const plotW=w-left-right,plotH=h-top-bottom;
    // Include every visible LFGI EMA in the price range; a 200 EMA may
    // sit beyond the recent candle highs/lows and must not disappear.
    const overlayValues=[a.e9,a.e20,a.e50,a.e200].flatMap(values=>values.slice(start));
    const extentMin=Math.min(...data.map(x=>x.l),...overlayValues),extentMax=Math.max(...data.map(x=>x.h),...overlayValues);
    const pad=Math.max(0.0001,(extentMax-extentMin)*.11);
    const ymin=extentMin-pad,ymax=extentMax+pad;
    const y=p=>top+(ymax-p)/(ymax-ymin)*plotH;
    const step=plotW/data.length;
    const x=i=>left+(i+.5)*step;
    ctx.font="10px system-ui,-apple-system,sans-serif";ctx.textBaseline="middle";
    for(let i=0;i<=4;i++){
      const yp=top+(plotH*i/4);
      ctx.strokeStyle="#252c39";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,yp);ctx.lineTo(left+plotW,yp);ctx.stroke();
      const price=ymax-(ymax-ymin)*i/4;
      ctx.fillStyle="#8792a4";ctx.fillText(price>=1000?Math.round(price).toLocaleString():price.toFixed(2),left+plotW+8,yp);
    }
    for(let i=0;i<=4;i++){
      const index=Math.min(data.length-1,Math.floor(i*(data.length-1)/4)),xp=x(index);
      ctx.fillStyle="#758298";ctx.textAlign=i===0?"left":i===4?"right":"center";
      ctx.fillText(shortTime(data[index].t),xp,h-13);
    }
    ctx.textAlign="start";
    data.forEach((r,i)=>{
      const xp=x(i),rising=r.c>=r.o;
      ctx.strokeStyle=rising?colors.up:colors.down;
      ctx.fillStyle=rising?colors.up:colors.down;
      ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(xp,y(r.h));ctx.lineTo(xp,y(r.l));ctx.stroke();
      const candleWidth=Math.max(1,Math.min(8,step*.68));
      const yO=y(r.o),yC=y(r.c);
      ctx.fillRect(xp-candleWidth/2,Math.min(yO,yC),candleWidth,Math.max(1,Math.abs(yC-yO)));
    });
    [[a.e9,colors.ema9],[a.e20,colors.ema20],[a.e50,colors.ema50],[a.e200,colors.ema200]].forEach(([series,color])=>{
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.5;
      for(let i=0;i<data.length;i++){const xp=x(i),yp=y(series[start+i]);if(i===0)ctx.moveTo(xp,yp);else ctx.lineTo(xp,yp);}
      ctx.stroke();
    });
    ctx.setLineDash([3,4]);ctx.strokeStyle="#6FA7E788";ctx.beginPath();ctx.moveTo(left,y(a.last.c));ctx.lineTo(left+plotW,y(a.last.c));ctx.stroke();ctx.setLineDash([]);
    if(state.hover>=0&&state.hover<data.length){
      const xp=x(state.hover);ctx.strokeStyle="#94a0b677";ctx.beginPath();ctx.moveTo(xp,top);ctx.lineTo(xp,top+plotH);ctx.stroke();
    }
    state.chartMeta={left,plotW,step,start,w,h};
  }
  function move(event){
    const meta=state.chartMeta;if(!meta||!state.data.length)return;
    const rect=$("chart").getBoundingClientRect();
    const pointerX=event.clientX-rect.left;
    const idx=Math.max(0,Math.min(state.data.length-meta.start-1,Math.floor((pointerX-meta.left)/meta.step)));
    state.hover=idx;draw();
    const r=state.data[meta.start+idx],tip=$("chart-tooltip");
    tip.hidden=false;
    tip.textContent=shortTime(r.t)+"  ·  O "+fmt(r.o)+"  H "+fmt(r.h)+"  L "+fmt(r.l)+"  C "+fmt(r.c);
    tip.style.left=Math.min(Math.max(8,pointerX-90),Math.max(8,meta.w-270))+"px";
    tip.style.top="8px";
  }
  function describeMarket() {
    const spy=$("pair").value==="SPY";
    $("market-note").hidden=!spy;
    $("market-note").textContent=spy
      ?"SPY prices may be delayed; stock hours and contracts differ from BTC.":"";
    // BTC has a single verified-contract action. SPY gets a separate, clearly
    // labelled browse-only link because we do not verify an SPY contract here.
    $("spy-handoff").hidden=!spy;
  }
  function clearPriorRead() {
    state.analysis=null;state.data=[];state.chartMeta=null;state.lastClosedAt=0;state.lastCheckedAt=0;
    $("bias").textContent="-";$("bias").className="stat-value muted";
    $("quick-status").textContent="Checking chart...";
    $("quick-text").textContent="Waiting for finished price candles to calculate the chart trend.";
    $("score").textContent="-";$("score").className="stat-value muted";
    $("price").textContent="-";$("price-explain").textContent="Checking candle close time";$("chart-pair").textContent=$("pair").value;
    $("chart-subtitle").textContent="Checking the selected market…";
    $("support").textContent="-";$("resistance").textContent="-";$("rsi").textContent="-";
    $("votes").replaceChildren();$("brief").replaceChildren();$("warnings").replaceChildren();
    $("chart-tooltip").hidden=true;
    const canvas=$("chart");const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  $("chart").addEventListener("mousemove",move);
  $("chart").addEventListener("mouseleave",()=>{state.hover=-1;$("chart-tooltip").hidden=true;draw();});
  $("refresh").addEventListener("click",()=>load(false));
  ["pair","interval","source"].forEach(id=>$(id).addEventListener("change",()=>{clearPriorRead();describeMarket();load(false);}));
  window.addEventListener("resize",draw);
  // Check on a short cadence, particularly just after 5m/15m boundaries.
  // The server provides finished candles and never serves cached chart snapshots.
  setInterval(()=>{
    if(document.visibilityState==="visible"&&$("source").value==="live")load(true);
  },15000);
  setInterval(updateFreshness,1000);
  const refreshOnReturn=()=>{
    if(document.visibilityState==="visible"&&$("source").value==="live")load(false);
  };
  document.addEventListener("visibilitychange",refreshOnReturn);
  window.addEventListener("pageshow",refreshOnReturn);
  window.addEventListener("focus",refreshOnReturn);
  describeMarket();load(false);
})();