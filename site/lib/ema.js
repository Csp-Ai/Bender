"use strict";
// Bender's EMA palette follows the documented LFGI Trading System:
// 9 green, 20 yellow, 50 orange, 200 red. No model probabilities here.
(function(root,factory){
  const exported=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=exported;
  if(root)root.BenderEma=exported;
})(typeof window!=="undefined"?window:null,function(){
  const PALETTE=Object.freeze({
    9:"#22C55E",
    20:"#FACC15",
    50:"#F97316",
    200:"#EF4444"
  });
  function series(values,period){
    if(!Array.isArray(values)||values.length===0||!Number.isInteger(period)||period<1)
      throw new TypeError("EMA requires at least one value and a positive integer period.");
    if(!values.every(v=>typeof v==="number"&&Number.isFinite(v)))
      throw new TypeError("EMA values must be finite numbers (signed momentum series are allowed).");
    // Preserve existing chart and rule-score behavior: first close seeds the EMA.
    const alpha=2/(period+1);
    let last=values[0];
    return values.map((value,index)=>{
      if(index)last+=(value-last)*alpha;
      return last;
    });
  }
  return Object.freeze({PALETTE,series});
});
