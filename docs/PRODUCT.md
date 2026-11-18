# Bender: product brief

**Mission:** Help two human traders see *what a chart supports* and *why*, rather than presenting opaque confident guesses.

**Users:** Chris and Omar. Omar defines chart setups, useful horizons and candidate criteria. Chris coordinates the architecture, evidence standards, quality and releases.

## Minimum useful result
Given an instrument and 5- or 15-minute bar interval, show the latest closed-candle timestamp, data origin, candlestick chart, technical observations, directional alignment, warnings and reference levels. Never present simulated data as current prices. Never conflate rule agreement with a probability of profitable trades.

## Product principles
1. Observed data and computed features are separable from explanations.
2. No result without adequate valid historical bars.
3. All source and freshness limitations are visible.
4. A human controls any trading decision.
5. Every strategy change should be tested on held-out historical data before claiming improved accuracy.
6. Screenshots are useful for annotation but cannot independently establish trustworthy numeric prices.

## Non-goals today
No broker credentials, wallet custody, real-money trade placement, market-order execution, trade-copying from screenshots, background alerts or profitability promises. These require additional research and security controls.
