# Bender read-only historical research

This package builds an **auditable metadata foundation**, not an automatic profitable trading strategy.

Run bounded UTC-day metadata captures from a network-enabled environment:

```bash
python -m research.history --venue us --from-date 2026-11-18 --to-date 2026-11-18 --output research-data
python -m research.history --venue international --from-date 2026-11-18 --to-date 2026-11-18 --output research-data
python -m research.coverage --input research-data
python -m unittest discover -s tests -v
```

`research-data/` is excluded from source control. Raw API responses are saved by SHA-256 under the specific venue/day; normalized JSONL records never invent missing outcome or historical quote data. A day receives a manifest only after all returned pages have been processed. A page-cap error makes the run incomplete rather than pretending full coverage.

The capture does not establish whether all historical markets are available from any source. Read `docs/HISTORICAL_DATA_AUDIT.md` for coverage limits and licensing.

**Analysis:** `research.evaluation.transitions()` reports only descriptive transition counts using previous rounds that were already verified by the next round's start. `probability_metrics()` requires explicit, pre-resolution model predictions and resolution evidence. `evidence_gates()` refuses strategy-profit claims without point-in-time quotes, fees and fills. `research.journal.append_snapshot()` validates and appends local read-only observations; it is not a hosted persistent store.

Research venue data must remain partitioned. Never infer real execution prices from indicative BBO or market settlement outcomes.
