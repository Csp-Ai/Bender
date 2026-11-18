# Bender development roadmap

## Phase 1: Read charts (v0.1)
- [x] Explainable technical indicator engine with bullish/bearish/neutral labels
- [x] Kraken read-only crypto candle source (BTC, ETH, SOL, 5m and 15m)
- [x] Synthetic demo mode and Streamlit candlestick dashboard
- [x] Unit tests + GitHub Actions configuration
- [ ] Verify the live source and UI end to end on a deployed instance

## Phase 2: Measure, don't guess
- [ ] Reproducible historical candle store and data provenance
- [ ] Define future-return targets, no-trade cases and real trade costs
- [ ] Walk-forward, no-look-ahead backtests and basic benchmark comparison
- [ ] Split trending/ranging market regimes
- [ ] Model data gaps, spread, slippage, order book and fees

## Phase 3: Watchlists and alerts
- [ ] Scan fresh, *completed* candles every 5 or 15 minutes using a reliable scheduler
- [ ] Only notify on new setups; suppress duplicate and stale signals
- [ ] Discord or email alert with symbol, reason, expiry, risk context
- [ ] Paper-trading decisions and after-the-fact outcome log

## Phase 4: Smarter explanations and expansion
- [ ] Chart screenshot annotation as a supplementary, verified channel
- [ ] Optional language model grounded in computed indicator facts
- [ ] SPY ETF support with explicit exchange-coverage limitations
- [ ] Crypto versus equity market-hours handling
- [ ] Portfolio risk controls in sandbox mode, with human approval

## Separate gate for any execution integrations
Only after quantitative evidence, documented security review, exchange terms and operator signoff. No real-money trading code in the research MVP.
