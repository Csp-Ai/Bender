# Bender  -  chart check (web)

Bender is a friendly, read-only chart analysis website built by Chris and Omar using experience from Chris’s Gifali work. Focus: **Bitcoin (BTC/USD)** and **SPY (S&P 500 ETF)** only.

- **BTC:** live, completed Kraken 5-minute and 15-minute candles; directional rule alignment, not Polymarket settlement pricing.
- **SPY:** an optional stock data feed through Alpaca’s authenticated stock-bars API. When not configured, the website explicitly says SPY’s live feed is unavailable, instead of inventing prices.
- **Practice mode:** visibly fake candles for checking interactions, never live market data.
- **Human decision:** Bender does not place trades or compute verified Polymarket win probabilities. Users must check a contract’s specific price-to-beat, clock, rules and available price at Polymarket.

## Vercel configuration

Project source: `site/`. Framework Other. This site can be deployed from the files under `site/` without a frontend build step. BTC needs no keys.

To activate live SPY, set these encrypted server-side environment variables in Vercel, then redeploy:

```
ALPACA_API_KEY_ID=<from Alpaca dashboard>
ALPACA_API_SECRET_KEY=<from Alpaca dashboard>
```

Do not paste secrets into chat or commit them. This endpoint requests IEX stock bars (limited exchange coverage), and uses US regular trading hours. Stock prices do not settle the same way as Bitcoin's Polymarket short-window contracts.

Development notes: GitHub integration may need access to this repository for automatic deployment. The Python research prototype at repository root remains separate.


## Read-only Polymarket US BTC tracker (v0.5)
The site now has a distinct contract panel when BTC and Real Prices are selected. It polls the public Polymarket US market and best bid/offer endpoints. The endpoint verifies asset, 5m/15m horizon, Up/Down family, and actual time window using the venue's typed \`assetPriceTerms\`; it never assumes a contract from a guessed slug. If available, it displays the official price to beat and indicative asks computed from the YES book (buy Up at best ask; buy Down at 1 minus best bid). A countdown runs each second and a network check runs every 15 seconds while the page is active.

No live BRTI index data feed is connected yet. Never equate the Kraken spot chart with the settlement reference. No outcome odds forecasts, modeled fair value, or automatic trade placements exist.

Run the dependency-free contract parser tests:
\`\`\`bash
node --test site/tests/polymarket.test.cjs
\`\`\`

## v0.6: Quick read and optional official BRTI data

The phone layout now prioritizes the active contract, one short chart summary, the price chart, and expandable eight-check details. The repeated long explanation and trading instructions were removed.

The contract card can optionally display a **fresh instant CF Benchmarks BRTI** reading and its distance from the official opening target. The reading is not the final 60-second average and is not a prediction. It is never replaced by Kraken BTC prices. By default, the card says **Not connected**.

To enable the reference service, obtain authorized CF Benchmarks API credentials and confirm that the license allows **public display and derived comparisons in Bender**, then configure these server-side Vercel environment variables and redeploy:

```text
CFB_API_USERNAME=<configured privately in Vercel>
CFB_API_PASSWORD=<configured privately in Vercel>
BRTI_DATA_LICENSE_CONFIRMED=true
```

Do not add credentials to GitHub or paste them in chat. Unauthorized or stale feeds fail closed. The backend uses the documented CF Benchmarks GET `/api/v1/latest_values?id=BRTI` endpoint with Basic authentication, and verifies a reading is at most 15 seconds old.

BRTI parsing tests are in `site/tests/brti.test.cjs`. Run with `node --test site/tests/*.test.cjs` from the repo root. The public Polymarket contract price and live BRTI index have different sources and update rates.

## v0.7: usable spot estimate and mobile Polymarket handoff

BTC now displays a recently fetched spot price from Kraken's public ticker, with Coinbase spot as a backup. A 5-second foreground timer updates it. The displayed difference against Polymarket's official contract target is expressly an **estimate using a different pricing source**. It is not a BRTI settlement reading, not a prediction, and not a substitute for the minute-average contract rule. If a licensed BRTI feed becomes available, it takes priority.

Contract lookup refreshes every 15 seconds. Buy prices use the verified best bid/ask endpoint, then the full order book. If no executable quote is present, a last-trade reference may be shown but must be labeled **not a buy quote**. Missing executable quotes must never be fabricated.

The active event link uses the verified `https://polymarket.us/event/<market-slug>` URL. On mobile, the OS may open the installed US app when it claims that link; otherwise the same official event opens in the browser. No undocumented app-specific URL scheme is assumed.

SPY uses public Yahoo Finance chart data for 5-minute and 15-minute completed candles, with Alpaca IEX as an optional fallback. This can be delayed or rate-limited; it should not be described as guaranteed real-time exchange data. The SPY chart is not linked to an SPY Polymarket contract.

The earlier duplicate chart summary was removed, preserving exactly one source of truth for the visible score and last-candle display.

## v0.7.1: mobile app handoff fix

The mobile screenshot showed Polymarket opening an individual five-minute event that had already expired or was not recognized by the app. The handoff now uses the verified, ongoing Polymarket US categories:
- BTC 5m: https://polymarket.us/category/bitcoin-5m
- BTC 15m: https://polymarket.us/category/bitcoin-15m

The page picks the correct destination as soon as the timeframe changes, even while contract data is still fetching. On iOS/Android, the official HTTPS link can open the installed Polymarket app if its universal-link rules support it. Otherwise, the official market webpage loads. A separate homepage fallback is provided. The per-contract API metadata remains in Bender for analysis, but no expiring event URL is used as the primary handoff.

## v0.8: always show the real candle close time

Exchange OHLC timestamps identify the candle **opening**, not its closing. The quick read now computes close = candle start + selected 5-minute or 15-minute interval and shows the close date and local timezone. A 15m candle opened at 12:00 AM closes at 12:15 AM, even if the next contract clock reads 12:21 AM. The live BTC spot ticker is a separate, faster feed.

The chart endpoint returns a non-cacheable response plus an explicit `lastCandleClosedAt` field. The chart checks for new completed candles every 15 seconds while visible, refreshes when users return to the tab, and reassesses freshness every second without waiting for the next fetch. A small provider delay is allowed around each boundary. When a new completed candle is overdue, the UI hides the old up/down bias and rule score instead of passing it off as current. It retains the historical last-close price with a clear delayed label. Outside regular US trading hours, SPY is shown as historical data rather than a live stock session.

The mobile last-candle price is given a full-width row so it does not split the cents onto another line.
