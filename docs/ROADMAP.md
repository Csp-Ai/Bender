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
