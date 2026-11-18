# Bender
**Goated at reading charts.**

Bender is a human-in-the-loop chart analysis research project by Chris and Omar. The first version reads completed crypto candles, computes transparent technical indicators, and labels the current evidence as **BULLISH**, **BEARISH**, or **NEUTRAL**. It does not place trades, predict returns with known odds, or guarantee profitability.

## What works in v0.1
- Live read-only Kraken BTC/USD, ETH/USD, and SOL/USD 5-minute and 15-minute OHLCV data
- Simulated offline demo, visibly labeled as simulated
- Candlestick dashboard with EMA overlays
- Explainable 8-rule directional alignment score (-8 to +8) and warnings for stale data
- Automated unit tests

### Local setup
Requires Python 3.11+.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

On Windows, activate with `.venv\Scripts\activate`. Select the **Simulated demo** source to work without a network connection.

Run tests:

```bash
python -m unittest discover -s tests -v
```

## Interpretation
The score adds eight transparent directional checks: EMA9 vs EMA20, close vs EMA50, EMA50 vs EMA200, close vs rolling 50-bar VWAP, MACD histogram, RSI context, a prior 20-bar breakout, and volume confirmation. A score >= +4 is bullish; <= -4 bearish; otherwise neutral.

**A +6/8 rule score is not a 75% win probability.** It is a count of indicator agreement. No backtest, calibrated probabilities, or proof of predictive advantage exist yet. The prototype uses only *completed candles*. Market conditions can change faster than an update.

## Sources and provenance
- **Kraken:** public read-only exchange candle endpoint. Data can be delayed, missing or stale; the latest in-progress bar is excluded. No API key needed.
- **Demo:** deterministic *synthetic* candles. Never use demo signals to place trades.

For the product goal and next phases, see [Product brief](docs/PRODUCT.md) and [Roadmap](docs/ROADMAP.md).

## Collaboration and safety
Omar defines useful chart setups, instruments, and trader-facing questions; Chris owns product architecture, validation and operational reliability. Both review strategy changes. Do not commit credentials or wallet keys.

**Repository visibility: public.** Avoid storing private trading accounts, personal financial information or licensed/restricted market data here. If you later choose private collaboration, change the visibility in GitHub repository settings. No real-money order integrations are included.
