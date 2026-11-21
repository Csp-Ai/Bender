"use strict";
const {chromium}=require("playwright");
const fs=require("node:fs"),http=require("node:http"),path=require("node:path"),assert=require("node:assert/strict");
const ROOT=path.join(__dirname,"..");
const mime={".html":"text/html",".js":"application/javascript",".css":"text/css"};
const now=()=>Date.now();
const candle=(mins,symbol="BTC/USD")=>{
  const ms=mins*60000,at=Math.floor(Date.now()/ms)*ms;
  const bars=Array.from({length:720},(_,i)=>{
    const t=(at-(720-i)*ms)/1000;
    const c=(symbol==="SPY"?650:56000)+(i*.037)+Math.sin(i/11)*2.5;
    return {t,o:c-.42,h:c+1.35,l:c-1.38,c,v:25+(i%8)*3};
  });
  return {symbol,interval:mins,source:symbol==="SPY"?"YAHOO_FINANCE":"KRAKEN",coverage:"Test fixture; not exchange data",observedAt:new Date().toISOString(),lastCandleClosedAt:new Date(at).toISOString(),candles:bars};
};
const contract=(mins)=>{
 const ms=mins*60000,started=Math.floor(Date.now()/ms)*ms;
 return {available:true,interval:mins,state:"CONTRACT_VERIFIED",market:{
    id:"fixture-"+mins,slug:"btc-updown-"+mins+"m-fixture",title:"BTC Up Down",
    startsAt:new Date(started).toISOString(),endsAt:new Date(started+ms).toISOString(),
    target:56000,indexSymbol:"BRTI",source:"Polymarket US"},
    checkedAt:new Date().toISOString(),source:"Polymarket US",lookupMs:8};
};
let calls={};
const server=http.createServer((req,res)=>{
 const p=decodeURIComponent(req.url.split("?")[0]||"/");
 const file=path.resolve(ROOT,"."+ (p==="/"?"/index.html":p));
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end("blocked");}
 try{const bytes=fs.readFileSync(file);res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});res.end(bytes);}
 catch(_){res.writeHead(404);res.end("missing");}
});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const base="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 let failures=0;
 const samples=[];
 for(const viewport of [{width:320,height:568},{width:375,height:812},{width:390,height:844},{width:768,height:1024},{width:1280,height:800}]){
  const ctx=await browser.newContext({viewport,isMobile:viewport.width<=390,deviceScaleFactor:1});
  const page=await ctx.newPage();
  const errors=[],network=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/**",async route=>{
   const u=new URL(route.request().url());
   const name=u.pathname;
   calls[name]=(calls[name]||0)+1;
   network.push(name+u.search);
   const mins=Number(u.searchParams.get("interval")||5),symbol=u.searchParams.get("symbol")||"BTC/USD";
   if(name==="/api/candles"){
     if(mins===15)await delay(70);
     return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(candle(mins,symbol))});
   }
   if(name==="/api/contract")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(contract(mins))});
   if(name==="/api/quotes")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({slug:u.searchParams.get("slug"),available:true,state:"QUOTE_AVAILABLE",quotes:{upAsk:.57,downAsk:.45},checkedAt:new Date().toISOString()})});
   if(name==="/api/spot")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({available:true,price:56001,source:"Kraken BTC/USD last trade",sampledAt:new Date().toISOString()})});
   if(name==="/api/reference")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({available:false})});
   if(name==="/api/settlement")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({state:"AWAITING_SETTLEMENT",outcome:null})});
   return route.fulfill({status:404,body:"{}"});
  });
  try{
   await page.goto(base,{waitUntil:"domcontentloaded",timeout:12000});
   await page.waitForFunction(()=>document.querySelector("#bias")?.textContent.includes("LEANING")||document.querySelector("#bias")?.textContent.includes("MIXED"),{timeout:10000});
   await page.waitForFunction(()=>document.querySelector("#poly-target")?.textContent.includes("$"),{timeout:10000});
   const first=await page.evaluate(()=>({
     screen:window.innerWidth,docWidth:document.documentElement.scrollWidth,
     bodyWidth:document.body.scrollWidth,historyCount:document.querySelector("#history-count").textContent,
     polyVisible:getComputedStyle(document.querySelector("#poly-panel")).display!=="none",
     mobileNav:getComputedStyle(document.querySelector(".mobile-jump-nav")).display,
     hero:getComputedStyle(document.querySelector(".hero")).display,
     quick:document.querySelector("#bias").textContent,
     price:document.querySelector("#poly-target").textContent,
     linkCount:document.querySelectorAll("#poly-market-link").length,
     linkHref:document.querySelector("#poly-market-link").getAttribute("href"),
     contractTop:Math.round(document.querySelector("#poly-panel").getBoundingClientRect().top)
   }));
   assert.equal(first.linkCount,1);
   assert.ok(first.docWidth<=viewport.width+1,"horizontal overflow "+JSON.stringify(first));
   assert.equal(first.polyVisible,true);
   if(viewport.width<=390){assert.notEqual(first.mobileNav,"none");assert.equal(first.hero,"none");}
   if(viewport.width>850)assert.equal(first.mobileNav,"none");
   if(viewport.width<=850)await page.locator('.timeframe-button[data-interval="15"]').click({force:true});
   else await page.locator('#interval').selectOption('15');
   await page.waitForFunction(()=>document.querySelector("#chart-interval").textContent==="15m"&&document.querySelector("#poly-window").textContent.includes("15"),{timeout:12000});
   assert.equal(await page.locator("#interval").inputValue(),"15");
   const snapshot15=await page.evaluate(()=>({quote:document.querySelector("#poly-up").textContent,timeframe:document.querySelector("#poly-window").textContent}));
   await page.locator("#pair").selectOption("SPY");
   await page.waitForFunction(()=>document.querySelector("#chart-pair").textContent.includes("SPY"),{timeout:8000});
   assert.equal(await page.locator("#poly-panel").isVisible(),false);
   assert.equal(await page.locator("#spy-handoff").isVisible(),true);
   await page.locator("#pair").selectOption("BTC/USD");
   if(viewport.width<=850)await page.locator('#mode-toggle').click({force:true});
   await page.locator("#source").selectOption("demo");
   await page.waitForFunction(()=>document.querySelector("#demoBanner")?.hidden===false,{timeout:9000});
   assert.equal(await page.locator("#poly-panel").isVisible(),false);
   await page.locator("#source").selectOption("live");
   await page.waitForFunction(()=>document.querySelector("#poly-panel")?.hidden===false,{timeout:9000});
   if(viewport.width<=850)await page.locator('.timeframe-button[data-interval="5"]').click({force:true});
   else await page.locator('#interval').selectOption('5');
   await page.waitForFunction(()=>document.querySelector("#chart-interval").textContent==="5m",{timeout:7000});
   await page.locator('a[href="#history"]').nth(viewport.width<=850?1:0).click({force:true});
   assert.equal(new URL(page.url()).hash,"#history");
   if(viewport.width===375)await page.screenshot({path:"/tmp/bender-375.png",fullPage:true});
   samples.push({...first,viewport:viewport.width+"x"+viewport.height,errors,networkCount:network.length,afterSwitch:snapshot15,passed:true});
   if(errors.length)failures++;
  }catch(e){failures++;samples.push({viewport:viewport.width+"x"+viewport.height,passed:false,error:String(e.stack||e),errors,network});}
  await ctx.close();
 }
 await browser.close();server.close();
 console.log("BROWSER_STRESS_SUMMARY",JSON.stringify({failures,scenarios:samples.length,samples,apiCalls:calls}));
 if(failures)process.exit(1);
}
main().catch(e=>{console.error("FATAL",e);server.close();process.exit(1)});
