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

## v0.9 review branch (not yet deployed)

A new `/api/contract?interval=5|15` verifies market metadata independently of bids/asks. A separate `/api/quotes?slug=<verified-slug>` checks indicative bid/ask data; no quote means unavailable, never a fabricated percentage. The mobile market card renders target/countdown immediately and states quote freshness and unverified research edge independently. No model probability or trading execution has been added. See historical research instructions in `../research/README.md`.

## v0.9.1 LFGI chart palette — Chris and Omar review

Matches the archived LFGI Trading System chart conventions: **9 EMA green** (#22C55E), **20 EMA yellow** (#FACC15), **50 EMA orange** (#F97316), and **200 EMA red** (#EF4444). All four are calculated from the selected chart's timestamped *completed candle closes* and rendered over the existing price chart on BTC and SPY (including prominently labeled practice candles). The 200 EMA previously supported long-term structure scoring but was not plotted; it is now included visually and in the chart's vertical bounds so it does not silently disappear. The chart legend wraps on phones. EMA smoothing also supports signed values for the MACD signal calculation.

The LFGI reference material also describes support/resistance, psychological levels, pivots, VWAP (middle and upper bands), RSI, MACD, volume and reading tape. These are historical research directions, **not claims of shipped overlays or verified predictive signals**. Bender already uses parts of VWAP/RSI/MACD/volume in its factor analysis. No automatic trading or win-probability model was added.

## v0.9.2 Past Reads: browser-local observation journal

Bender now records **one fresh, completed live candle chart observation** per symbol and candle interval in the browser that viewed it, keyed by symbol, interval, and candle-close time. A record includes observation time, source, closed price, eight-factor score and individual direction votes, and all four LFGI EMA values (9 green, 20 yellow, 50 orange, 200 red). When a verified Polymarket US market was already known at observation time, optional market ID/target and fresh indicative quotes can be saved as *context*, not implied probabilities or actual fills.

The Past Reads section appears below the live trading handoff, and is collapsed by default on phones. A user may inspect entries, export a local CSV, or explicitly clear history on that device. Up to 150 records are retained **per browser** using localStorage (no synchronization, server warehouse, login, or guarantee of persistence). Browser privacy controls, storage clearing, or quota limits can prevent saving; the system fails without inventing records. Data from another device cannot appear automatically. A downloaded CSV is a local observation export, **not a performance backtest**.

No automatic contract-result reconciliation or live trade information is captured. New records only appear after a verified current chart feed responds, so page load, network outage, background tabs, practice mode and closed/stale candles do not create simulated historical observations. Future model training must not treat these records as authoritative fills, prediction outcomes or historical point-in-time market quotes.

Verification: `node --test site/tests/read-journal.test.cjs` and `node --check site/lib/read-journal.js` can be run locally. Full regression suite and browser end-to-end remain separate release gates.

## v0.9.3 official US contract settlement lookup (review branch)

**Past Reads** can now manually check official Polymarket US settlement values for historical chart reads that contain a verified market identity and have passed their contract end time. The server first verifies the exact market slug, market ID, BTC Up/Down terms, 5m/15m horizon, window, and opening target via `GET /v1/market/slug/{slug}`; only then does it request `GET /v1/markets/{slug}/settlement`. A numeric settlement of 1 maps to YES/Up, 0 to NO/Down, and a fractional value is reported as nonbinary. Missing, delayed, mismatched and malformed settlement data fail closed. The API's `checkedAt` is Bender's retrieval timestamp, **not** the exchange's official settlement publication time.

Official outcome evidence is saved separately from the original chart observation. Bender compares chart lean and verified settlement direction descriptively ("direction matched" or "direction differed"), **never calling it an executed trade or calculating P&L**. A verified contract that becomes available after the chart read may be linked retroactively as metadata with an explicit `linkedAt` timestamp. **Historical order book quotes are never backdated**. CSV exports may include separately matched, verified settlement state, checked timestamp, and the descriptive direction comparison.

This is a **manual, read-only, local-device feature**. Up to eight distinct eligible unverified market IDs are checked per click. An upstream 404 often means an outcome is not yet published; Bender displays "awaiting settlement" and permits retry rather than inferring a winner. No cross-device synchronization, user-specific bets, or historical settlement time are asserted.

The Vercel preview build now runs the browser-side Node test suite using the site's `package.json`; `site/vercel.json` preserves the static root and serverless functions. The Python unit suite and iPhone end-to-end checks still need independent verification.

## v0.9.4 — Omar mobile workflow consolidation

The mobile first view now prioritizes **verified live contract → Bender Quick Read → 9/20/50/200 EMA chart**. It removes the promotional hero on narrow screens and adds a sticky three-section Live/Chart/Past Reads navigation (all sections are still visible on scroll). The 5m/15m touch toggle updates the existing native interval select through a real `change` event, so the chart and Polymarket contract code retain their existing refresh and timeframe validation. The native select remains on desktop and as the authoritative value for all API requests.

Mobile data-mode controls are collapsed under "Data options" but automatically label PRACTICE mode clearly; the existing simulated data warning is retained. The main contract card has a **single** open-Polymarket link; source rules, quote caveats, and the app-home fallback are available via a small disclosure section. SPY has its own browse-only Polymarket link because a specific SPY contract is not verified. Stale/unavailable quote states and the concise "no verified trading edge" note are retained rather than hiding critical market limitations.

Past Reads, the eight-factor breakdown, research journal, verified settlement checks, chart-data sources, and export remain intact, with no changes to the model or inferred probabilities. Desktop retains its original introductory section, asset selection, dropdowns, and chart layout.

Quality gates: `node --test site/tests/*.test.cjs` includes `mobile-ui.test.cjs` checks for event compatibility, practice toggle accessibility, fragment navigation, and single handoff. `node --check site/mobile-ui.js` runs in GitHub Actions. Validate the production-sized viewport and the actual Polymarket app handoff with Omar before promoting this draft PR.

## v0.9.4.1 stress-tested QA patch (review branch)

The browser now hides Polymarket's live contract section while practice candles are active, rejects malformed indicative prices (including values above 100¢) in the *display layer*, and validates exact BTC contract intervals and identifiers. These bugs surfaced in actual headless-browser fault tests and have regression tests. The quick-start QA notes and optional browser tests are in [qa/README.md](qa/README.md); the complete observed results and limits are in [the stress-test report](../docs/STRESS_TEST_V0941.md).

To reproduce with local Chromium support, install Playwright **only for testing** and run `npm run qa:browser`. Default `npm test` remains dependency-free. The current evidence is 63 Node unit tests, 22 Python tests, 5 viewport scenarios and 7 browser fault scenarios passed in an isolated sandbox. No throughput SLA, exchange quote age, Safari app-link validation, or profitable strategy claim is established.
