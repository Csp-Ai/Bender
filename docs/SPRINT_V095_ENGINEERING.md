# Bender v0.9.5 — Reliability and market-integrity delivery

**Status:** Isolated review branch; no merge to main or production promotion.  
**Branch:** `sprint-v095-reliability-hardening`, based on `sprint-v0-9-research-foundation`.  
**Scope:** Market/reference, quote integrity, limited safe caching/backoff, verified archive integrity and resumable page retrieval.

## Completed work

- **Reference enforcement:** A Polymarket US BTC 5m/15m Up/Down contract is only considered verified when the market type, BTC asset, exact contract horizon, ID/slug, BRTI index symbol and positive official opening target all match. Settlement verification uses the same reference gate.
- **Final quote gate:** Browser validation requires matching contract slug, Polymarket US source, server-retrieval timestamp semantics, consistent availability/state, signed price bounds, supported quote source, and a fresh observation. Contradictory `available:false` + quotes, `AWAITING_QUOTE` + offers, unsupported price sources and stale/future data fail closed.
- **Request efficiency:** Separate upstream contract-page and per-slug quote caches coalesce identical concurrent requests for **1,000ms** and **700ms** respectively, per running serverless instance only. Cache hits preserve the **original upstream retrieval timestamp** and expose a `cacheStatus` marker. Search-window parameters are quantized to the current second solely to improve coalescing.
- **Upstream limits:** HTTP 429 with Retry-After gets a bounded 2–60-second cooldown and a clear `RATE_LIMITED` state. The browser respects the cooldown before retrying and never substitutes cached quotes for newly published exchange data.
- **Historical integrity:** Raw SHA-256 pages, canonical JSONL, venue/day identities, page offsets, row counts, market uniqueness, day boundaries and manifest horizon counts are verified before trusting a completed archive. V2 manifests contain a non-terminal page-size proof. Interrupted days resume from individually validated page checkpoints. Legacy v1 manifest files lacking page-size proof are rejected rather than silently accepted.

## Verification and limitations

Re-run all tests against the exact release branch:
```bash
node --test site/tests/*.test.cjs
python -m unittest discover -s tests -v
node --check site/lib/quote-safety.js
node --check site/lib/request-coalescer.js
node --check site/lib/upstream-rate-limit.js
```

The optional browser suite is `cd site && npm run qa:browser`, requires locally installed Playwright/Chromium, and uses mock API fixtures rather than third-party high-volume load.

The original browser chart and LFGI 9/20/50/200 EMA colors are unchanged.

**Outstanding release gates:** GitHub Actions jobs fail before runner assignment; a production-environment green run has not been confirmed. Physical Omar iPhone/Safari Polymarket handoff, delayed official boundary rollover, upstream rate-limit capacity, licensing and full historical outcome/backtest coverage remain unverified. These are NOT equivalent to tested profitable trading performance or licensed BRTI live reference data.

## Sources of truth

The live source is Polymarket US, and timestamps show when **Bender retrieved** a response, not when the exchange published it. BTC Kraken candle prices are not official BRTI settlement prices. No trading credentials, wallets or execution endpoints are added.

## Release rule

Review this isolated branch independently of the larger draft PR #1. Do **not** merge either branch, approve main, or promote Vercel production until the owner approves the reviewed commit and the applicable release gates are satisfied.

## Runtime reproducibility

The Vercel build reported that `node: >=20` would automatically upgrade to future major releases. The v0.9.5 review candidate instead declares Node **22.x** for deployed static/serverless builds and selects Node **22** in the GitHub Actions test workflow. Test against the actual release build; future major upgrades should be reviewed intentionally.
