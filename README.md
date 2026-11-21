# Bender  -  Goated at reading charts

A human-friendly chart-checking project for **BTC** and **SPY**, built by Chris and Omar. Chris contributes AI/trading product experience from the Gifali system; Omar helps shape what traders need to understand quickly.

**Website:** https://bender-one-nu.vercel.app

The website in [site/](site/) shows 5-minute or 15-minute chart candles, an explainable trend read, key chart levels and plain-English explanations. It uses live read-only Kraken data for BTC; SPY support uses optional authenticated Alpaca IEX stock bars, which are unavailable until configured. A practice mode uses explicitly fake data.

**The chart timeframe is not a 5-minute/15-minute prediction.** Bender tracks verified read-only Polymarket US BTC contract metadata and separately checks indicative quotes. Chart scores are not market odds or independent forecasts. Nothing here has a demonstrated predictive edge and Bender places no orders.

See [Website setup](site/README.md), [Product brief](docs/PRODUCT.md), and [Roadmap](docs/ROADMAP.md).

## Research prototype

The existing Python Streamlit chart prototype remains under `app.py` and `bender/` for independent experimentation; its older ETH/SOL configurations are legacy and not part of the current website product scope.

```bash
pip install -r requirements.txt
streamlit run app.py
python -m unittest discover -s tests -v
```

## v0.9 review branch — not yet production

The `sprint-v0-9-research-foundation` branch adds separate contract and quote APIs, clear quote freshness/availability states, historical metadata collectors, a coverage report, and conservative evaluation/journal schemas. See [Historical data audit](docs/HISTORICAL_DATA_AUDIT.md) and [Research quick start](research/README.md). Historical completeness, outcome accuracy, model calibration and profitable execution have **not** been established. Deployment remains subject to tests and review.
