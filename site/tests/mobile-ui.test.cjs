"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");

function element(initial={}){
  const listeners=new Map(),attributes=new Map(),classes=new Set(initial.classes||[]);
  return {
    value:initial.value||"",dataset:initial.dataset||{},textContent:"",
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),
      toggle:(x,force)=>{if(force===undefined? !classes.has(x):force)classes.add(x);else classes.delete(x);}},
    getAttribute:x=>attributes.get(x)||null,
    setAttribute:(x,y)=>attributes.set(x,String(y)),
    removeAttribute:x=>attributes.delete(x),
    addEventListener:(type,cb)=>{const a=listeners.get(type)||[];a.push(cb);listeners.set(type,a);},
    dispatchEvent:event=>{for(const cb of listeners.get(event.type)||[])cb(event);return true;},
    _listeners:listeners
  };
}
function boot(){
  const select=element({value:"5"}),source=element({value:"live"}),toggle=element(),field=element();
  toggle.setAttribute("aria-expanded","false");
  const five=element({dataset:{interval:"5"}}),fifteen=element({dataset:{interval:"15"}});
  const links=["#poly-panel","#chart-section","#history"].map(href=>{
    const e=element();e.setAttribute("href",href);return e;
  });
  const nav={querySelectorAll:()=>links};
  const elements={interval:select,source,"mode-toggle":toggle,"mode-field":field};
  const events=new Map(),location={hash:""};
  const document={
    getElementById:id=>elements[id]||null,
    querySelectorAll:selector=>selector===".timeframe-button"?[five,fifteen]:[],
    querySelector:selector=>selector===".mobile-jump-nav"?nav:null
  };
  const window={addEventListener:(type,cb)=>events.set(type,cb)};
  const code=fs.readFileSync(path.join(root,"mobile-ui.js"),"utf8");
  vm.runInNewContext(code,{document,window,location,Event:class Event{constructor(type,options){this.type=type;this.bubbles=options?.bubbles;}}});
  return {select,source,toggle,field,five,fifteen,links,events,location};
}
test("one tap selects 15m and sends existing chart and contract listeners a real change event",()=>{
  const ui=boot(),seen=[];
  ui.select.addEventListener("change",event=>seen.push(event.type));
  assert.equal(ui.five.getAttribute("aria-pressed"),"true");
  ui.fifteen.dispatchEvent({type:"click"});
  assert.equal(ui.select.value,"15");
  assert.equal(ui.five.getAttribute("aria-pressed"),"false");
  assert.equal(ui.fifteen.getAttribute("aria-pressed"),"true");
  assert.deepEqual(seen,["change"]);
  ui.fifteen.dispatchEvent({type:"click"});
  assert.deepEqual(seen,["change"],"tapping already selected interval should not refetch");
});
test("source mode is collapsible without losing the underlying real/demo selector",()=>{
  const ui=boot();
  assert.equal(ui.toggle.getAttribute("aria-expanded"),"false");
  ui.toggle.dispatchEvent({type:"click"});
  assert.equal(ui.toggle.getAttribute("aria-expanded"),"true");
  assert.equal(ui.field.classList.contains("is-expanded"),true);
  ui.source.value="demo";ui.source.dispatchEvent({type:"change"});
  assert.equal(ui.toggle.classList.contains("is-practice"),true);
  assert.match(ui.toggle.textContent,/Practice mode/);
  ui.toggle.dispatchEvent({type:"click"});
  assert.equal(ui.toggle.getAttribute("aria-expanded"),"false");
});
test("mobile navigation exposes Live, Chart, Past Reads with accessible active location",()=>{
  const ui=boot();
  assert.equal(ui.links[0].getAttribute("aria-current"),"location");
  ui.location.hash="#history";
  ui.events.get("hashchange")();
  assert.equal(ui.links[2].getAttribute("aria-current"),"location");
  assert.equal(ui.links[0].getAttribute("aria-current"),null);
});
test("HTML retains live selectors and just one primary BTC handoff",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
  const contract=fs.readFileSync(path.join(root,"polymarket.js"),"utf8");
  const css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
  for(const id of ["pair","interval","source","refresh","poly-panel","poly-market-link","history","chart-section","spy-handoff","poly-decision"])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.equal((html.match(/id="poly-market-link"/g)||[]).length,1);
  assert.doesNotMatch(html,/id="polymarket-link"|id="contract-note"|class="handoff"/);
  assert.doesNotMatch(app,/\$\("polymarket-link"\)|\$\("contract-note"\)/);
  assert.doesNotMatch(contract,/\$\("polymarket-link"\)/);
  assert.match(html,/class="mobile-jump-nav"/);
  assert.match(css,/@media\(max-width:850px\)\{[\s\S]*?\.hero\{display:none\}/);
  assert.match(html,/id="history-verify"/);
  for(const period of [9,20,50,200])assert.match(html,new RegExp('class="leg-ema'+period+'"'));
});
