# Bender product brief — BTC + SPY

**Promise:** Chris and Omar built a chart reader that explains price action like a friend, while keeping real numbers, sources, and the technical checks transparent.

**Why:** Omar wants to check Bender before looking at a Polymarket contract, then place his own trade if the evidence and actual contract terms make sense. Chris brings AI and prior trading system experience from Gifali; Omar brings trader-facing priorities and feedback.

**Start with two:** BTC/USD (crypto, 24/7) and SPY (the S&P 500 exchange-traded fund, subject to stock market hours).

**Site:** easy input for the market and 5/15-minute chart candles. Output in ordinary language: up/down/mixed chart lean, 8-factor alignment score (not a probability), last completed candle, trends and the reason for each check, support/resistance, source and warnings.

**Accuracy and honesty:** Kraken BTC spot price is NOT the same as the Chainlink measure that can settle a BTC Polymarket contract. SPY market terms may differ from the BTC 5/15-minute series. Never fabricate a matching Polymarket market or odds. No validated hit rate exists. SPY's authenticated data provider must be connected before labeling prices live. Avoid stale price display on switching markets.

**What ships now:** informative market research, no wallet, no custody, no trade execution, no AI pretending to know the next move. Users can always pass.

**Next:** actual Polymarket contract discovery and rules, contract-specific thresholds and prices, paper tracking, historical testing. Show modeled probabilities only once calibrated on out-of-sample data and after accounting for fees and slippage.
