"use strict";
// Licensed, read-only CF Benchmarks BRTI latest value.
const {parseBrti}=require("../lib/brti");
module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Only GET is supported"});
  res.setHeader("Cache-Control","public, s-maxage=5, stale-while-revalidate=5");
  res.setHeader("X-Content-Type-Options","nosniff");
  const user=process.env.CFB_API_USERNAME,pass=process.env.CFB_API_PASSWORD;
  if(process.env.BRTI_DATA_LICENSE_CONFIRMED!=="true"||!user||!pass){
    return res.status(200).json({available:false,status:"not_connected",
      message:"Official BRTI feed needs licensed data access. No substitute price is shown."});
  }
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
  try{
    const url=new URL("https://www.cfbenchmarks.com/api/v1/latest_values");
    url.searchParams.set("id","BRTI");url.searchParams.set("maxResolution","PER_SECOND");
    const response=await fetch(url,{signal:ctrl.signal,headers:{
      "Accept":"application/json",
      "Authorization":"Basic "+Buffer.from(user+":"+pass).toString("base64")
    }});
    if(!response.ok)return res.status(200).json({available:false,status:"access_unavailable",
      message:"Official BRTI access could not be verified."});
    const latest=parseBrti(await response.json());
    if(!latest)return res.status(200).json({available:false,status:"stale_or_invalid",
      message:"No recent valid BRTI reading was returned."});
    return res.status(200).json({available:true,...latest,
      warning:"This is an instant BRTI reading, not the final 60-second settlement average."});
  }catch(e){
    return res.status(200).json({available:false,status:"feed_error",
      message:"The official BRTI source could not be reached."});
  }finally{clearTimeout(timer)}
};
