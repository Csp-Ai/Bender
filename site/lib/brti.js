"use strict";
function parseBrti(json,now=Date.now()){
  const item=json?.payload?.latest_values?.BRTI || json?.data?.payload?.latest_values?.BRTI;
  if(!item||typeof item!=="object"||item.repeatOfPreviousValue===true)return null;
  const price=Number(item.value),ts=Number(item.time);
  if(item.value==null||item.time==null||!Number.isFinite(price)||!Number.isFinite(ts))return null;
  if(price<=0||price>10000000||ts<1000000000000||ts>now+3000||now-ts>15000)return null;
  return {price,observedAt:new Date(ts).toISOString(),source:"CF Benchmarks BRTI"};
}
function distance(price,target){
  if(price===null||target===null||price===undefined||target===undefined)return null;
  const p=Number(price),t=Number(target);
  return Number.isFinite(p)&&Number.isFinite(t)&&p>0&&t>0?p-t:null;
}
module.exports={parseBrti,distance};
