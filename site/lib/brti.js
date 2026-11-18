"use strict";
// Official CF Benchmarks BRTI latest-value payload parsing.
// Fails closed on stale, malformed or repeated readings.
const number=x=>{
  if(x===null||x===undefined||x==="")return null;
  const n=Number(x);return Number.isFinite(n)?n:null;
};
function parseKalshiBrti(body,now=Date.now()){
  const latest=body?.data?.payload?.latest_values?.BRTI;
  if(!latest||typeof latest!=="object")return null;
  const price=number(latest.value);
  const time=number(latest.time);
  if(price===null||price<=0||price>10000000||time===null)return null;
  // BRTI timestamps are milliseconds, not seconds.
  if(time<1000000000000||time>now+3000||now-time>15000)return null;
  if(latest.repeatOfPreviousValue===true)return null;
  return {price,observedAt:new Date(time).toISOString(),ageMs:Math.max(0,now-time),source:"CF Benchmarks BRTI via Kalshi"};
}
const distance=(price,target)=>{
  const p=number(price),t=number(target);
  return p!==null&&t!==null&&p>0&&t>0?p-t:null;
};
module.exports={parseKalshiBrti,distance};
