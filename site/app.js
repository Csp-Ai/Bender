"use strict";
(function () {
  const $ = id => document.getElementById(id);
  const state = {data:[], analysis:null, loading:false, source:"live", interval:5, symbol:"BTC/USD", hover:-1};
  const colors = {up:"#51dbac",down:"#ff7182",ema9:"#bea3ff",ema20:"#ebbd7c",ema50:"#71accb"};
  const fmt = v => Number.isFinite(v) ? "$" + new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v) : "—";
  const shortTime = s => new Date(s * 1000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const dirName = d => d > 0 ? "BULLISH" : d < 0 ? "BEARISH" : "NEUTRAL";
  const dirClass = d => d > 0 ? "bull" : d < 0 ? "bear" : "neutral";

  function emaSeries(values, span) {
    let last = values[0];
    const alpha = 2/(span+1);
    return values.map((v,i) => { if (i) last = (v-last)*alpha+last; return last; });
  }
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
    const age=Date.now()/1000-last.t;
    if (age>state.interval*60*3) warnings.push("Latest completed candle is stale. Verify the market feed before acting.");
    if (age<0) warnings.push("A future-dated candle was received.");
    if (rows.slice(-20).some(x=>x.v===0)) warnings.push("Zero-volume candles can distort indicator readings.");
    if (state.source==="demo") warnings.push("Simulated candles: not real prices, not actionable signals.");
    return {score,bias,votes,support,resistance,rsi,e9,e20,e50,age,warnings,last};
  }
  function demo() {
    const count=320,interval=state.interval;
    const now=Math.floor(Date.now()/1000);
    const end=Math.floor(now/(interval*60))*interval*60-interval*60;
    let seed=127;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    let p=65000;const rows=[];
    for(let i=0;i<count;i++){
      const o=p;
      p=Math.max(100,p*(1+0.00015+(rand()-.5)*0.006));
      const wiggle=p*rand()*0.002;
      rows.push({t:end-(count-i-1)*interval*60,o,h:Math.max(o,p)+wiggle,l:Math.min(o,p)-wiggle,c:p,v:40+rand()*90});
    }
    return rows;
  }
  async function load(isAuto) {
    if(state.loading)return;
    state.symbol=$("pair").value;state.interval=Number($("interval").value);state.source=$("source").value;
    state.loading=true;
    $("refresh").disabled=true;$("refresh").textContent="Analyzing…";
    $("error").hidden=true;
    $("demoBanner").hidden=state.source!=="demo";
    $("data-status").textContent="UPDATING";
    try {
      let rows;
      if(state.source==="demo")rows=demo();
      else {
        const url="/api/candles?symbol="+encodeURIComponent(state.symbol)+"&interval="+state.interval;
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),12000);
        try{
          const response=await fetch(url,{signal:controller.signal,cache:"no-store"});
          const json=await response.json();
          if(!response.ok)throw new Error(json.error||"Market feed unavailable");
          rows=json.candles;
        }finally{clearTimeout(timeout);}
      }
      if(!rows.every(r=>[r.t,r.o,r.h,r.l,r.c,r.v].every(Number.isFinite)
        &&r.o>0&&r.h>=Math.max(r.o,r.c,r.l)&&r.l<=Math.min(r.o,r.c,r.h)&&r.v>=0))throw new Error("The feed returned invalid candles");
      if(rows.some((r,i)=>i>0&&r.t<=rows[i-1].t))throw new Error("Candle timestamps are out of order");
      state.analysis=analyze(rows);
      state.data=rows;
      state.hover=-1;
      render();
      $("data-status").textContent=state.source==="demo"?"SIMULATED":"KRAKEN / CLOSED BARS";
      $("updated").textContent="Analyzed " + new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) + " local";
      if(!isAuto)document.title=state.analysis.bias+" | Bender";
    }catch(e){
      $("data-status").textContent="FEED UNAVAILABLE";
      $("error").textContent="Unable to update: "+e.message+" Existing results, if any, may be stale.";
      $("error").hidden=false;
    }finally{
      state.loading=false;$("refresh").disabled=false;$("refresh").textContent="↻  Analyze chart";
    }
  }
  function render(){
    const a=state.analysis,rows=state.data,scoreDirection=Math.sign(a.score);
    $("bias").textContent=a.bias;$("bias").className="stat-value "+dirClass(a.score);
    $("bias-explain").textContent="Based on 8 directional checks";
    $("score").textContent=(a.score>0?"+":"")+a.score;$("score").className="stat-value "+dirClass(a.score);
    $("score-explain").textContent="Rule agreement · not win probability";
    $("price").textContent=fmt(a.last.c);
    $("price-explain").textContent="Candle at "+new Date(a.last.t*1000).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})+" local";
    $("chart-pair").textContent=state.source==="demo"?"SYNTHETIC / DEMO":state.symbol.replace("/"," / ");
    $("chart-interval").textContent=state.interval+"m";
    $("chart-subtitle").textContent=(state.source==="demo"?"Simulated":"Kraken")+" · "+rows.length+" completed candles received";
    $("support").textContent=fmt(a.support);
    $("resistance").textContent=fmt(a.resistance);
    $("rsi").textContent=a.rsi.toFixed(1);
    const votes=$("votes");votes.replaceChildren();
    a.votes.forEach(v=>{
      const row=document.createElement("div");row.className="factor";
      const left=document.createElement("div");
      const title=document.createElement("div");title.className="factor-title";title.textContent=v.name;
      const detail=document.createElement("div");detail.className="factor-sub";detail.textContent=v.why;
      left.append(title,detail);
      const tag=document.createElement("span");tag.className="factor-tag "+dirClass(v.dir);tag.textContent=dirName(v.dir);
      row.append(left,tag);votes.appendChild(row);
    });
    let lead=a.bias==="BULLISH"?"Buy-side indicators currently dominate.":a.bias==="BEARISH"?"Sell-side indicators currently dominate.":"The technical factors are mixed.";
    let count=a.votes.filter(v=>v.dir===scoreDirection&&v.dir!==0).length;
    const brief=$("brief");brief.replaceChildren();
    const p=document.createElement("p");
    p.textContent=lead+" Bender scored "+a.score+" on its −8 to +8 rule scale. "+count+" checks agree with the prevailing direction. RSI is "+a.rsi.toFixed(1)+", with nearby observed support at "+fmt(a.support)+" and resistance at "+fmt(a.resistance)+". This is an observation, not a price prediction.";
    brief.appendChild(p);
    const warnings=$("warnings");warnings.replaceChildren();
    a.warnings.forEach(w=>{const div=document.createElement("div");div.className="warning";div.textContent=w;warnings.appendChild(div);});
    if(a.warnings.length===0){const div=document.createElement("div");div.className="muted-copy";div.textContent="No obvious data freshness warning. Price action can still change abruptly.";warnings.appendChild(div);}
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
    const extentMin=Math.min(...data.map(x=>x.l)),extentMax=Math.max(...data.map(x=>x.h));
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
    [[a.e9,colors.ema9],[a.e20,colors.ema20],[a.e50,colors.ema50]].forEach(([series,color])=>{
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.5;
      for(let i=0;i<data.length;i++){const xp=x(i),yp=y(series[start+i]);if(i===0)ctx.moveTo(xp,yp);else ctx.lineTo(xp,yp);}
      ctx.stroke();
    });
    ctx.setLineDash([3,4]);ctx.strokeStyle="#a8a0d588";ctx.beginPath();ctx.moveTo(left,y(a.last.c));ctx.lineTo(left+plotW,y(a.last.c));ctx.stroke();ctx.setLineDash([]);
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
  $("chart").addEventListener("mousemove",move);
  $("chart").addEventListener("mouseleave",()=>{state.hover=-1;$("chart-tooltip").hidden=true;draw();});
  $("refresh").addEventListener("click",()=>load(false));
  ["pair","interval","source"].forEach(id=>$(id).addEventListener("change",()=>load(false)));
  window.addEventListener("resize",draw);
  setInterval(()=>{if(document.visibilityState==="visible"&&$("source").value==="live")load(true);},45000);
  load(false);
})();