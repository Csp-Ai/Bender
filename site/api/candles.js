// Vercel Node.js function: public, read-only Kraken OHLCV.
// Do not use a user-provided URL or credentials in this endpoint.
const PAIRS = {"BTC/USD":"XBTUSD","ETH/USD":"ETHUSD","SOL/USD":"SOLUSD"};

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({error:"Method not allowed"});
  const symbol = String(req.query.symbol || "BTC/USD");
  const interval = Number(req.query.interval || 5);
  if (!(symbol in PAIRS) || ![5,15].includes(interval)) return res.status(400).json({error:"Unsupported pair or interval"});
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);
  try {
    const url = new URL("https://api.kraken.com/0/public/OHLC");
    url.searchParams.set("pair", PAIRS[symbol]);
    url.searchParams.set("interval", String(interval));
    const response = await fetch(url, {signal:controller.signal, headers:{"Accept":"application/json"}});
    if (!response.ok) throw new Error("Exchange feed HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data.error) || data.error.length) throw new Error("Exchange returned an error");
    const keys = Object.keys(data.result || {}).filter(k => k !== "last");
    if (keys.length !== 1 || !Array.isArray(data.result[keys[0]])) throw new Error("Unexpected exchange response");
    const raw = data.result[keys[0]];
    const now = Date.now();
    // Kraken's last candle is not committed. Always exclude it.
    const candles = raw.slice(0, -1).map(r => ({
      t:Number(r[0]), o:Number(r[1]), h:Number(r[2]), l:Number(r[3]), c:Number(r[4]), v:Number(r[6])
    })).filter(r => Number.isFinite(r.t) && [r.o,r.h,r.l,r.c,r.v].every(Number.isFinite)
        && r.o>0 && r.h>0 && r.l>0 && r.c>0 && r.v>=0 && (r.t + interval*60)*1000<=now);
    if (candles.length < 210) throw new Error("Insufficient completed candles returned by exchange");
    res.setHeader("Cache-Control","public, s-maxage=25, stale-while-revalidate=30");
    return res.status(200).json({symbol, interval, source:"KRAKEN", observedAt:new Date().toISOString(), candles});
  } catch (err) {
    return res.status(502).json({error:"Market feed unavailable. Try again or switch to clearly labeled simulation."});
  } finally { clearTimeout(timeout); }
};
