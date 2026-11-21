"use strict";
/**
 * Per-serverless-instance request sharing for read-only public market APIs.
 *
 * Never creates a new publication timestamp on a cache hit. The original
 * server retrieval time is carried alongside every cached payload.
 * Serverless instances do NOT share this memory and limits are not guarantees.
 */
function createCache({ttlMs=800,maxEntries=50,clock=Date.now}={}){
  if(!Number.isFinite(ttlMs)||ttlMs<0||ttlMs>5000||!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>500)
    throw new TypeError("Cache configuration must be bounded");
  const entries=new Map(),flights=new Map();
  function prune(){
    const now=clock();
    for(const [key,entry] of entries){
      if(entry.expiresAt<=now)entries.delete(key);
    }
    while(entries.size>maxEntries)entries.delete(entries.keys().next().value);
  }
  async function get(key,loader){
    if(typeof key!=="string"||!key||typeof loader!=="function")throw new TypeError("Invalid cache inputs");
    prune();
    const cached=entries.get(key);
    if(cached&&cached.expiresAt>clock())
      return {value:cached.value,retrievedAt:cached.retrievedAt,cacheStatus:"hit"};
    if(flights.has(key)){
      const shared=await flights.get(key);
      return {...shared,cacheStatus:"shared"};
    }
    const promise=(async()=>{
      const value=await loader();
      const retrievedAt=new Date(clock()).toISOString();
      const item={value,retrievedAt,expiresAt:clock()+ttlMs};
      if(ttlMs>0){entries.set(key,item);prune();}
      return {value,retrievedAt,cacheStatus:"miss"};
    })();
    flights.set(key,promise);
    try{return await promise;}finally{if(flights.get(key)===promise)flights.delete(key);}
  }
  return {get,clear:()=>{entries.clear();flights.clear();},stats:()=>({entries:entries.size,inflight:flights.size})};
}
module.exports={createCache};
