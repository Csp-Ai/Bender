"use strict";
// Optional, authorized BRTI access via Kalshi's official authenticated
// CF Benchmarks REST passthrough. No credentials ever go to the browser.
const crypto=require("node:crypto");
const {parseKalshiBrti}=require("../lib/brti");
const PATH="/trade-api/v2/cfbenchmarks/latest_values";
module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Only GET is supported"});
  res.setHeader("Cache-Control","public, s-maxage=3, stale-while-revalidate=3");
  res.setHeader("X-Content-Type-Options","nosniff");
  const keyId=process.env.KALSHI_API_KEY_ID;
  const pem=process.env.KALSHI_PRIVATE_KEY_PEM;
  const licensed=process.env.BRTI_DATA_LICENSE_CONFIRMED==="true";
  if(!licensed||!keyId||!pem){
    return res.status(200).json({available:false,source:"CF Benchmarks BRTI",status:"not_connected",
      message:"Live BRTI needs authorized data access. Bender is not using a substitute price."});
  }
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),7000);
  try{
    const ts=String(Date.now());
    const privateKey=crypto.createPrivateKey(pem.replace(/\\n/g,"\n"));
    const data=Buffer.from(ts+"GET"+PATH,"utf8");
    const algorithm=privateKey.asymmetricKeyType==="ed25519"?null:"sha256";
    const opts=algorithm===null?privateKey:{key:privateKey,
      padding:crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength:crypto.constants.RSA_PSS_SALTLEN_DIGEST};
    const signature=crypto.sign(algorithm,data,opts).toString("base64");
    const response=await fetch("https://external-api.kalshi.com"+PATH+"?id=BRTI",{
      signal:ctrl.signal,
      headers:{"Accept":"application/json","KALSHI-ACCESS-KEY":keyId,
        "KALSHI-ACCESS-TIMESTAMP":ts,"KALSHI-ACCESS-SIGNATURE":signature}
    });
    if(!response.ok)return res.status(200).json({available:false,source:"CF Benchmarks BRTI",
      status:"access_unavailable",message:"The BRTI data provider did not authorize or return a current reading."});
    const body=await response.json();
    const reading=parseKalshiBrti(body);
    if(!reading)return res.status(200).json({available:false,source:"CF Benchmarks BRTI",
      status:"stale_or_invalid",message:"No fresh verified-format BRTI reading. Showing no official comparison."});
    return res.status(200).json({available:true,...reading,
      caveat:"Latest index reading only. The contract settles using the official minute averages, not this instant quote."});
  }catch(e){
    return res.status(200).json({available:false,source:"CF Benchmarks BRTI",
      status:"feed_error",message:"BRTI could not be verified right now."});
  }finally{clearTimeout(timeout);}
};
