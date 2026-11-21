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

## v0.9.5 integrity contract

New archives use **manifest schema v2** and record `page_limit`, terminal-page completeness, raw SHA-256 payloads and normalized JSONL SHA-256. Completed manifests are revalidated on every subsequent call and cannot hide corrupted raw/normalized files. Interrupted days resume from individually hashed page checkpoints; a mismatch raises rather than re-fetching over altered evidence. Earlier v1 manifests are **not** automatically trusted or migrated.

Run `python -m unittest discover -s tests -v` for integrity and interruption regression tests. For a local audit, run `python -m research.coverage --input research-data`; it fails on corrupted or unverified archive inputs. A successful audit is still **not proof all historical contracts were collected**.
