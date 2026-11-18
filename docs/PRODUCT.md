# Bender product brief  -  BTC + SPY

**Promise:** Chris and Omar built a chart reader that explains price action like a friend, while keeping real numbers, sources, and the technical checks transparent.

**Why:** Omar wants to check Bender before looking at a Polymarket contract, then place his own trade if the evidence and actual contract terms make sense. Chris brings AI and prior trading system experience from Gifali; Omar brings trader-facing priorities and feedback.

**Start with two:** BTC/USD (crypto, 24/7) and SPY (the S&P 500 exchange-traded fund, subject to stock market hours).

**Site:** easy input for the market and 5/15-minute chart candles. Output in ordinary language: up/down/mixed chart lean, 8-factor alignment score (not a probability), last completed candle, trends and the reason for each check, support/resistance, source and warnings.

**Accuracy and honesty:** Kraken BTC spot price is NOT the same as the Chainlink measure that can settle a BTC Polymarket contract. SPY market terms may differ from the BTC 5/15-minute series. Never fabricate a matching Polymarket market or odds. No validated hit rate exists. SPY's authenticated data provider must be connected before labeling prices live. Avoid stale price display on switching markets.

**What ships now:** informative market research, no wallet, no custody, no trade execution, no AI pretending to know the next move. Users can always pass.

**Next:** actual Polymarket contract discovery and rules, contract-specific thresholds and prices, paper tracking, historical testing. Show modeled probabilities only once calibrated on out-of-sample data and after accounting for fees and slippage.


## Polymarket US BTC proof of concept
The BTC 5m/15m contract tracker uses read-only Polymarket US REST market metadata and best bid/ask. The US venue is distinct from Polymarket International. For the US Up/Down contract, the reference is typically CF Benchmarks BRTI and the official outcome uses its 60 pre-boundary index readings averaged per the specific rules. The published opening target is not Kraken spot price. A missing target or quote stays unavailable. The chart score is not a forecast or a win probability. This prototype contains no ordering, wallet, account access, or trade execution.

## v0.6 user workflow

One job per section: market selection, live Polymarket US contract details, a single chart quick read, the price chart, optional expanded indicator explanations, and an official contract handoff. On mobile the intro and contract cards are condensed. Technical notes are available but not repeated. The rule score is directional agreement, not odds.

An official CF Benchmarks BRTI latest-value provider is implemented behind explicit authorization and licensing checks, but inactive without configured credentials. Its latest instant value may be compared to the market's official opening target only if fresh. That instantaneous comparison is *not* the settlement calculation, which uses time-window averages. Do not imply a final outcome or expected value without reliable historical calibration.

## v0.7 live fallback policy

Usability must not come from fabricated prices. Bender may compare a fresh Kraken/Coinbase BTC spot quote with an actual Polymarket US opening BRTI target, but labels the difference as an *approximation across different feeds*. The target and official settlement remain BRTI minute averages, and spot can differ meaningfully.

The contract page prefers actual quoted best offers, tries full depth as fallback, and only displays last-traded prices with a clearly stated non-executable disclaimer. This keeps the market screen useful when the order book is thin without claiming a trade price. A direct HTTPS Polymarket US event link may open the installed mobile app if the platform registers it, with the web event as fallback.

SPY's market data source is independent of BTC and can be delayed. Neither 5m nor 15m SPY chart timeframes imply the existence of matching Polymarket contracts. No account, wallet or trading execution connection is made.
