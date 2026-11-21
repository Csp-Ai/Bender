# Bender roadmap

## Shipped
- [x] BTC/USD live 5-minute and 15-minute chart checks using completed Kraken candles
- [x] Plain-English analysis and 8-factor directional rule score
- [x] Focus site navigation on BTC and SPY, with stock-data warnings
- [x] Practice mode explicitly marked fake
- [x] Manual handoff to Polymarket

## SPY data
- [ ] Add Alpaca credentials to Vercel (securely, server-side) to enable SPY live bars
- [ ] Verify IEX coverage/limits and market-hours behavior against expected prices
- [ ] Add full-market data if needed with appropriate provider plan

## Contract-specific integration
- [ ] Fetch active BTC Polymarket 5m/15m contracts and verify their exact settlement rules
- [ ] Discover actual SPY contract formats rather than assuming they are rolling 5m/15m Up/Down
- [ ] Show price to beat, time left, outcome costs, and execution fees with provenance
- [ ] Compare contracts with reference feeds where legally and technically available

## Evidence-first signal refinement
- [ ] Historical capture and no-look-ahead paper evaluation on resolved contract outcomes
- [ ] Track precision, reliability, false positives, and "pass" decisions
- [ ] Calibrate conditional probabilities only after rigorous holdout analysis
- [ ] Alert on new setups only, suppress stale/duplicate notifications

## Guardrails
- [ ] Verify the deployed browser UI end-to-end on mobile and desktop
- [ ] Repair GitHub/Vercel integration for automatic deploys
- [ ] No live order execution, wallet credentials, or implied guaranteed profitability


## Live Polymarket US contract tracking (v0.5)
- [x] Add BTC 5m and 15m contract lookup using official read-only US API
- [x] Validate current time window, asset, horizon and Up/Down contract type
- [x] Display official market opening target, expiration countdown, and BBO-derived indicative Up/Down buy prices when provided
- [x] Show a clear warning that Kraken chart prices are not BRTI settlement reference prices
- [x] Show unavailability without substituting made-up numbers
- [ ] Confirm discovery and quote feed live end-to-end; review errors and tighten retry logic if needed
- [ ] Obtain lawful reliable live BRTI reference price feed and compare to official target
- [ ] Track actual outcome performance and contract pricing before attempting probabilities

## v0.6 refinements
- [x] Move the contract ahead of the chart summary
- [x] Consolidate repeated commentary into one quick read
- [x] Put all eight indicator checks and levels in expandable details
- [x] Add reference-price status plus comparison panel
- [x] Implement official, authenticated CF Benchmarks BRTI latest-value adapter with stale-data rejection
- [ ] Obtain data access and an explicit distribution license before enabling the reference feed
- [ ] Verify actual index readings and contract matching end-to-end once authorized
- [ ] Develop robust exact 60-second opening/closing window aggregation, not a single-tick substitute
- [ ] Record prior signals and resolved contract outcomes; backtest before probability estimates

## v0.7 usability pass
- [x] Remove duplicate DOM chart-summary IDs
- [x] Add live Kraken BTC ticker with public Coinbase spot fallback
- [x] Display spot-vs-BRTI-target comparison as an explicitly approximate difference
- [x] Recheck BTC spot every five seconds while the page is active
- [x] Add read-only best bid/ask, book and last-trade context tiers with distinct labels
- [x] Link exact verified event via HTTPS for mobile app handoff where supported
- [x] Add public Yahoo Finance 5m/15m SPY feed with optional Alpaca fallback
- [ ] Confirm app-link routing on Omar's exact device and browser
- [ ] Verify stock-feed reliability at market open and during the trading session
- [ ] Validate quote spread, staleness and displayed order prices in live market snapshots
- [ ] Paper-track model outputs vs resolved contracts before interpreting the trend score as a trading edge

## v0.8 chart freshness and timestamps
- [x] Correct opening timestamps to show actual last candle close time and local date/time zone
- [x] Recheck completed chart candles every 15 seconds with no API caching
- [x] Revalidate freshness each second, refresh on page return, and mark overdue candles delayed
- [x] Suppress stale directional signals and old score rather than implying live accuracy
- [x] Differentiate SPY regular session, closed market, and delayed intraday candles
- [x] Keep the price readable on narrow phones
- [ ] Verify the new 5-minute and 15-minute close times on Omar's iPhone in Safari

## v0.9 historical intelligence and contract-readiness foundation (review branch)
- [x] Split verified contract discovery and quote retrieval into separate endpoints; make first contract metadata visible without order-book latency
- [x] Show quote pending/available/stale states and explicit no-verified-edge disclosure
- [x] Add bounded per-venue historical metadata backfill, immutable raw archives, normalized JSONL, checkpoint manifests and coverage audit
- [x] Add strict verified-outcome-only descriptive sequence metrics and read-only signal snapshot validation
- [x] Add Node and Python regression tests to repository test workflow
- [ ] Validate public API pagination and response schemas end-to-end against real archived days
- [ ] Obtain verified US settlement outcomes and timestamped historical quote/fill data before backtesting entry/exit profitability
- [ ] Build full chart signal capture/persistent journal; current helper is local, not a deployed store
- [ ] Run chronological holdout models and calibration; no modeled probabilities in production until validated
- [ ] Resolve failing GitHub Actions runner/workflow environment; current job results fail without accessible step logs
- [ ] Review and merge PR, then verify production deployment and Omar's iOS behavior
