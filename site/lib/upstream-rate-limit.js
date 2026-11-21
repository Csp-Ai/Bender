"use strict";
// Respect upstream rate limits without hammering shared public market endpoints.
function retryAfterSeconds(value,now=Date.now()){
  let n;
  if(typeof value==="string"&&/^\s*\d+(?:\.\d+)?\s*$/.test(value))n=Number(value);
  else if(typeof value==="string"&&Number.isFinite(Date.parse(value)))
    n=(Date.parse(value)-now)/1000;
  else n=8;
  return Math.min(60,Math.max(2,Math.ceil(Number.isFinite(n)?n:8)));
}
function rateLimitError(response,now=Date.now()){
  if(response?.status!==429)return null;
  const after=retryAfterSeconds(response.headers?.get?.("retry-after"),now);
  const err=new Error("Upstream rate limited");
  err.code="RATE_LIMITED";
  err.retryAfterSec=after;
  return err;
}
module.exports={retryAfterSeconds,rateLimitError};
