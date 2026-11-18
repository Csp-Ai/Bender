// Read-only market data. BTC via Kraken; SPY via optional Alpaca IEX credentials.
// Never return keys to the browser. No broker trading or account APIs.
const ALLOWED = new Set(["BTC/USD","SPY"]);
function completed(r, interval, now) {
  return Number.isFinite(r.t) && [r.o,r.h,r.l,r.c,r.v].every(Number.isFinite)
    && r.o>0 && r.l>0 && r.c>0 && r.h>=Math.max(r.o,r.c,r.l)
    && r.l<=Math.min(r.o,r.c,r.h) && r.v>=0
    && (r.t + interval*60)*1000 <= now-15000;
}
function nyMinutes(epochMs) {
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/New_York",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(new Date(epochMs));
  const h=Number(parts.find(p=>p.type==="hour").value);
  const m=Number(parts.find(p=>p.type==="minute").value);
  return h*60+m;
}
async function btc(interval,signal) {
  const url=new URL("https://api.kraken.com/0/public/OHLC");
  url.searchParams.set("pair","XBTUSD");
  url.searchParams.set("interval",String(interval));
  const response=await fetch(url,{signal,headers:{"Accept":"application/json"}});
  if(!response.ok) throw new Error("Kraken request failed");
  const json=await response.json();
  if(!Array.isArray(json.error)||json.error.length) throw new Error("Kraken feed error");
  const keys=Object.keys(json.result||{}).filter(k=>k!=="last");
  if(keys.length!==1||!Array.isArray(json.result[keys[0]]))throw new Error("Unexpected Kraken response");
  const bars=json.result[keys[0]].slice(0,-1).map(r=>({
    t:Number(r[0]),o:Number(r[1]),h:Number(r[2]),l:Number(r[3]),c:Number(r[4]),v:Number(r[6])
  })).filter(r=>completed(r,interval,Date.now()));
  return {bars,source:"KRAKEN",coverage:"BTC/USD Kraken spot; NOT Polymarket settlement reference"};
}
async function spyYahoo(interval,signal){
  const errors=[];
  for(const host of ["query1.finance.yahoo.com","query2.finance.yahoo.com"]){
    try{
      const url=new URL("https://"+host+"/v8/finance/chart/SPY");
      url.searchParams.set("interval",interval+"m");
      url.searchParams.set("range","1mo");
      url.searchParams.set("includePrePost","false");
      const response=await fetch(url,{signal,headers:{
        "Accept":"application/json",
        "User-Agent":"Mozilla/5.0 (compatible; BenderResearch/0.7)",
        "Cache-Control":"no-cache"
      }});
      if(!response.ok)throw new Error("Feed HTTP "+response.status);
      const json=await response.json();
      const c=json.chart?.result?.[0],q=c?.indicators?.quote?.[0];
      if(!c||!Array.isArray(c.timestamp)||!q)throw new Error("Unexpected SPY chart response");
      const now=Date.now();
      const bars=c.timestamp.map((t,i)=>({
        t:Number(t),o:Number(q.open?.[i]),h:Number(q.high?.[i]),
        l:Number(q.low?.[i]),c:Number(q.close?.[i]),v:Number(q.volume?.[i]||0)
      })).filter(r=>{
        if(!completed(r,interval,now))return false;
        const minute=nyMinutes(r.t*1000);
        return minute>=570 && minute+interval<=960;
      }).sort((a,b)=>a.t-b.t);
      const unique=bars.filter((r,i)=>i===0||r.t!==bars[i-1].t);
      if(unique.length<210)throw new Error("Insufficient SPY candles");
      const last=unique[unique.length-1];
      return {bars:unique.slice(-720),source:"YAHOO_FINANCE",
        coverage:"SPY public consolidated chart, possibly delayed; latest completed candle "+
          new Date(last.t*1000).toISOString()+". Not a Polymarket settlement reference."};
    }catch(e){errors.push(host+" "+String(e.message));}
  }
  throw new Error("Public SPY feed did not return usable candles: "+errors.join("; "));
}
async function spyAlpaca(interval,signal){
  const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
  if(!key||!secret)throw new Error("Alpaca not configured");
  const now=Date.now(),since=new Date(now-(interval===5?14:30)*86400000).toISOString();
  let token=null;const seen=new Set(),all=[];
  for(let page=0;page<5;page++){
    const url=new URL("https://data.alpaca.markets/v2/stocks/SPY/bars");
    url.searchParams.set("timeframe",interval+"Min");
    url.searchParams.set("start",since);url.searchParams.set("end",new Date(now).toISOString());
    url.searchParams.set("limit","1000");url.searchParams.set("adjustment","raw");
    url.searchParams.set("feed","iex");
    if(token)url.searchParams.set("page_token",token);
    const response=await fetch(url,{signal,headers:{"Accept":"application/json",
      "APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret}});
    if(!response.ok)throw new Error("Alpaca SPY feed error");
    const body=await response.json();
    if(!Array.isArray(body.bars))throw new Error("Invalid Alpaca candles");
    all.push(...body.bars);token=body.next_page_token||null;
    if(!token||seen.has(token))break;seen.add(token);
  }
  const bars=all.map(r=>({
    t:Date.parse(r.t)/1000,o:Number(r.o),h:Number(r.h),l:Number(r.l),
    c:Number(r.c),v:Number(r.v)
  })).filter(r=>completed(r,interval,now)&&nyMinutes(r.t*1000)>=570
    &&nyMinutes(r.t*1000)+interval<=960).sort((a,b)=>a.t-b.t);
  const unique=bars.filter((r,i)=>i===0||r.t!==bars[i-1].t);
  if(unique.length<210)throw new Error("Insufficient Alpaca candles");
  return {bars:unique.slice(-720),source:"ALPACA_IEX",
    coverage:"SPY limited IEX-only market data, possibly delayed. Not all US venues or contract settlement price."};
}
async function spy(interval,signal){
  try{return await spyYahoo(interval,signal)}
  catch(e){
    if(process.env.ALPACA_API_KEY_ID&&process.env.ALPACA_API_SECRET_KEY)
      return await spyAlpaca(interval,signal);
    throw e;
  }
}

module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Only GET is supported"});
  const symbol=String(req.query.symbol||"BTC/USD");
  const interval=Number(req.query.interval||5);
  if(!ALLOWED.has(symbol)||![5,15].includes(interval)){
    return res.status(400).json({error:"Choose BTC or SPY, with 5m or 15m candles."});
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8500);
  try {
    const feed=symbol==="SPY"?await spy(interval,controller.signal):await btc(interval,controller.signal);
    if(feed.bars.length<210){
      return res.status(503).json({error:symbol==="SPY"
        ?"A fresh SPY 5m/15m chart could not be verified from the public data feeds. Check the exchange market hours."
        :"Not enough completed BTC candles available. Try again shortly."});
    }
    res.setHeader("Cache-Control","public, s-maxage=25, stale-while-revalidate=30");
    return res.status(200).json({symbol,interval,source:feed.source,coverage:feed.coverage,
      observedAt:new Date().toISOString(),candles:feed.bars});
  }catch(e){
    
    return res.status(502).json({error:"Market prices are unavailable right now. Please try again later."});
  }finally{clearTimeout(timeout);}
};