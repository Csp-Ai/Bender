"use strict";
// Read-only journal viewer. Past reads are saved on this browser, not to an account.
(function(){
  const journal=window.BenderReadJournal;
  const section=document.getElementById("history");
  if(!journal||!section)return;
  const $=id=>document.getElementById(id);
  const when=iso=>new Date(iso).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
  const price=v=>"$"+Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const signed=v=>(v>0?"+":"")+v;
  function node(tag,className,content){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(content!==undefined)el.textContent=content;
    return el;
  }
  function render(){
    const items=journal.read();
    $("history-count").textContent=items.length+" recorded";
    $("history-export").disabled=items.length===0;
    $("history-clear").disabled=items.length===0;
    const list=$("history-list");list.replaceChildren();
    if(!items.length){
      list.append(node("p","history-empty","No saved reads yet. Bender starts recording fresh, completed live chart observations in this browser after you open the site."));
      return;
    }
    for(const item of items.slice(0,30)){
      const details=node("details","history-entry");
      const summary=node("summary","history-summary");
      const head=node("div","history-meta");
      head.append(node("strong","",item.symbol+" · "+item.intervalMinutes+"m"),
        node("small","",when(item.candleClosedAt)+" · "+item.feedSource));
      summary.append(head,node("strong",item.score>0?"history-score-positive":item.score<0?"history-score-negative":"history-score-flat",
        item.bias+" · "+signed(item.score)+"/8"));
      details.append(summary);
      const content=node("div","history-detail");
      const note=node("p","history-disclaimer","Recorded chart observation, not a trade, backtest, win prediction or verified contract outcome.");
      const rows=node("div","history-data");
      for(const [label,value] of [
        ["Observed at",when(item.observedAt)],
        ["Candle closed at",when(item.candleClosedAt)],
        ["Closed price",price(item.closePrice)],
        ["9 EMA",price(item.ema[9])],
        ["20 EMA",price(item.ema[20])],
        ["50 EMA",price(item.ema[50])],
        ["200 EMA",price(item.ema[200])],
        ["Contract context",item.contract?"US "+item.contract.intervalMinutes+"m · "+item.contract.id:"Not recorded"],
        ["Indicative quote",item.contract?.quote
          ?"UP "+(item.contract.quote.upAsk===null?"--":Math.round(item.contract.quote.upAsk*100)+"¢")+
           " / DOWN "+(item.contract.quote.downAsk===null?"--":Math.round(item.contract.quote.downAsk*100)+"¢")
          :"Not recorded"],
        ["Settlement outcome","Not verified"]
      ]){
        const cell=node("div","history-field");
        cell.append(node("span","",label),node("strong","",value));
        rows.appendChild(cell);
      }
      content.append(note,rows,node("h4","history-checks-label","Eight chart checks"));
      const votes=node("div","history-votes");
      for(const vote of item.votes){
        const row=node("div","history-vote");
        row.append(node("span","",vote.name),node("strong",vote.dir>0?"history-score-positive":vote.dir<0?"history-score-negative":"history-score-flat",
          vote.dir>0?"UP":vote.dir<0?"DOWN":"MIXED"));
        votes.append(row);
      }
      content.append(votes);
      details.append(content);
      list.append(details);
    }
    if(items.length>30)list.append(node("p","history-empty","Showing 30 of "+items.length+" reads. Export CSV for the complete local record."));
  }
  $("history-export").addEventListener("click",()=>{
    const items=journal.read();
    if(!items.length)return;
    const data=journal.csv(items);
    const url=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");
    link.href=url;link.download="bender-local-chart-reads-"+new Date().toISOString().slice(0,10)+".csv";
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  $("history-clear").addEventListener("click",()=>{
    if(!window.confirm("Delete saved Bender chart reads on this browser? This cannot be undone."))return;
    if(journal.clear())render();
  });
  window.addEventListener("bender:read-recorded",render);
  window.addEventListener("storage",event=>{if(event.key===journal.KEY)render();});
  render();
})();
