# Bender historical data audit — initial technical assessment

_Status: repository research foundation, not a completed download or validated backtest. Updated 2026-11-20._

## Venue separation

Polymarket International and Polymarket US have **distinct markets, identifiers, matching venues, market-data APIs, and settlement rules**. Neither the available Gamma records nor Kraken BTC candles can be silently substituted for US BRTI settlement or a verifiable US executable order-book price.

## Sources and current capabilities

| Source | Venue | Available signal | Limitation / gate |
|---|---|---|---|
| [Gamma API](https://gamma-api.polymarket.com/markets) | International | Public market metadata, end dates, token IDs, outcomes/prices fields | Market listing `startDate` may be creation time. Resolved outcomes and contract-boundary timestamps require independent verification. Not a historical L2 archive. |
| [CLOB API](https://docs.polymarket.com/) | International | Price history per outcome token and current books | Time series is not equivalent to verified historical executable depth or actual fills. Historical completeness and fees must be assessed separately. |
| [Polymarket US public API](https://docs.polymarket.us/) | US | Public market metadata, BBO, order book, settlement/price-history endpoints | Metadata availability and resolution parsing need validation against real archived rounds. Current BBO is not historical BBO. |
| [PMData International](https://pmdata.dev/docs/historical-data-details/polymarket) | International | Archived L2/trades, including crypto Up/Down samples earlier than general-market archive | Access plan/license and collection-window completeness need review. |
| [PMData US](https://pmdata.dev/docs/historical-data-details/polymarket-us) | US | Per-market per-day L2/trade Parquet with source and receive timestamps | API key and plan; incomplete early capture. Before 2026-11-08, files return 410 by default and require explicit `include_incomplete=true`. |
| [Dune](https://dune.com/) | Primarily International | Blockchain research and fills | Query availability, fees, and attribution must be checked. US is separate. |
| [Bitquery](https://bitquery.io/) | Primarily International | Enriched chain and archived trading research | Coverage, price, and redistribution terms need verification. |
| Kraken / Coinbase | Spot BTC | Timestamped exchange spot and OHLC | Different source from contract settlement reference; not interchangeable with BRTI or Chainlink. |
| CF Benchmarks BRTI | US settlement reference | Official licensed index observations | Credentials and explicit redistribution rights required for live/historical use. |

PMData states its Polymarket US capture began September 10, 2026, but a capture start is **not** evidence the specific BTC product was already listed that day. It discloses missing US Up/Down rounds and a capture fix on November 7, 2026. International and US product-launch dates should be verified against the earliest real market records; estimates are not research sample counts.

## Implemented in v0.9 branch

- `python -m research.history --venue us --from-date YYYY-MM-DD --to-date YYYY-MM-DD --output research-data`
- `python -m research.history --venue international --from-date YYYY-MM-DD --to-date YYYY-MM-DD --output research-data`
- `python -m research.coverage --input research-data`
- One-day, bounded pagination with timeouts, retries, deduplication, immutable content-addressed raw JSON, normalized JSONL, atomic manifest checkpoints, strict timezone parsing and venue tags.
- No inferred official Gamma opening window from the rolling slug. No invented outcome, oracle price, quote history, or profitability.
- Offline evaluation modules accept only externally verified, timestamped resolutions; same-market predictions must predate resolution, and observed consecutive outcomes must have been verifiable at the prior boundary.

## Not yet completed

1. No bulk historical dataset was downloaded or verified in this development environment; CLI and tests need a network-enabled research runtime.
2. Source-filter semantics, pagination behavior and historical US settlement payloads need comparison with actual responses before claiming archive completeness.
3. Earliest market dates and full product coverage have **not** been proven from archived contract enumeration.
4. Missing historical quote depth, unlicensed BRTI data, execution costs and fills prevent meaningful entry/exit-strategy profitability figures.
5. No statistically validated probability model exists and none is exposed to the live site.
6. Signal journal is a local file schema and helper, not yet an automatic hosted data warehouse.

## Required research sequence

1. Test one archived day from each venue; inspect raw files and confirm source timestamp/field semantics.
2. Query increasing bounded date ranges and use `research.coverage` to report **observed** records, missing-date gaps, and source limitations.
3. Verify resolved outcomes using authoritative venue-specific resolution data, tagging resolution time and evidence.
4. Import lawful timestamped historical trade and L2 data separately; preserve exchange and local receipt timestamps and order of messages.
5. Build as-of joins excluding later publications, including stale quote rejection and non-fill uncertainty.
6. Run pre-registered hypothesis tests, chronological holdouts and calibration checks; separately evaluate US-only performance.
7. Promote no model to production until reproducibility, coverage and validation gates are met.

Never call this dataset complete until all days, pages, identity mappings, source versions and expected contract windows have been audited. No data should be published or redistributed without checking provider rights.

## Limited public API sample (November 20, 2026)

An isolated, read-only audit requested one page of 50 markets with end dates between **2026-11-18T00:00:00Z** and **2026-11-19T00:00:00Z** from each official source. Polymarket US returned 50 records and Gamma International returned 50 records. All sampled `endDate` fields fell on the requested UTC day; **none of the first-page records matched Bender's BTC 5m/15m filters**. Most were unrelated events. This only establishes that the date query can return in-window records. It **does not** establish BTC market absence, earliest BTC history, complete pagination, or historical order-book availability.

Bender v0.9.5 introduces a v2 archive manifest with page-size proof, fully verified SHA-256 raw/normalized inputs and resumable checkpoints. Legacy v1 manifests without page-size evidence are rejected and require explicit, audited migration/recollection; they are not silently overwritten. Data capture has not produced a validated historical BTC outcome sample, a calibrated model, or executable-strategy backtest.
