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
