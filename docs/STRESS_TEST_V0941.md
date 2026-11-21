# Bender v0.9.4.1 stress-test report

**Date:** November 20, 2026 (Arizona)  
**Scope:** `Csp-Ai/Bender` draft PR #1 / `sprint-v0-9-research-foundation`  
**Environment:** isolated Vercel sandbox; Node.js 24, Python 3.14 with local test dependencies, Playwright Chromium headless. Vercel preview Node build tests use the deployed project's environment.

## Results

| Area | Result | Evidence |
|---|---|---|
| JavaScript API, market utility, LFGI EMA, journal and UI tests | **63 / 63 pass** | `node --test site/tests/*.test.cjs` |
| Python engine, history audit and statistical safeguards | **22 / 22 pass** | `python -m unittest discover -s tests -q` after installing pandas and requests |
| Real-browser responsive layouts | **5 / 5 pass** | 320×568, 375×812, 390×844, 768×1024, 1280×800 |
| Real-browser fault injection | **7 / 7 pass** | Missing/stale/invalid quotes, 20 rapid timeframe switches, candle outage/recovery, missing contract, local history persistence |
| Mobile navigation / chart switching | **Pass** | 5m/15m selector updates chart and verified contract, no horizontal overflow, no JavaScript errors |
| SPY / BTC isolation | **Pass** | SPY shows browse-only handoff; BTC 5m/15m restore verified contract UI |
| Demo-mode isolation | **Pass after correction** | Live Polymarket contract card is now hidden when simulated candles are enabled |
| Quote display sanity | **Pass after correction** | Rejects negative, ≥$1, non-finite, malformed, stale or future indicative prices |
| Contract identity and window | **Pass after correction** | Rejects incorrect horizon durations and malformed market identifiers before calling a market verified |
| Live read-only API smoke | **Pass with limitations** | BTC and SPY candle feeds, BTC contract lookup, public spot endpoint, deliberately invalid request handling |
| Official BRTI feed | **Unavailable by design** | Missing authorization/licensing does not result in a simulated index value |
| GitHub Actions | **Blocked independently** | Job returns failure within ~2 seconds with no runner ID and zero step logs; not established as a test failure |

### Regressions caught and corrected

1. **Practice-mode leakage:** switching to simulated candles did not hide the live Polymarket contract panel. Fixed in `site/polymarket.js` by gating visibility on BTC *and* live mode; confirmed using Playwright across mobile/desktop views.
2. **Invalid price presentation:** an injected `upAsk: 1.4` rendered as **140¢**. Added `site/lib/quote-safety.js`, frontend integration and Node regression checks. Impossible prices now display **Unavailable** rather than an invented market offer.
3. **Incomplete contract validation:** a labeled 5-minute contract could have a shortened or malformed start/end window. Enforced exact horizon duration and stable identifiers in backend selector and frontend validation with regression tests.

### Procedure and reproducibility

The test harness uses a local server and mocks of upstream feeds, **not live trading or wager placement**. It exercises the actual browser UI, state transitions, and a controlled 5m/15m market/quote sequence. Run the optional scripts using `site/qa/README.md`.

We verified requests to real read-only endpoints using bounded samples, not high-volume load. For research collectors, a *single first page* of 30 public US and International metadata records returned no matching BTC contracts; **this does not imply the archives are empty** and full date-window pagination remains unverified.

### Interpretation and outstanding release gates

**Verified:** testable application correctness for the covered scenarios, basic live API availability, data validation, chart overlays, browser layout compatibility under five simulated viewport widths, and guarded local storage.

**Not verified:** a full sustained high-concurrency test on Polymarket US, actual execution price freshness at the exchange (Bender only knows server retrieval time), real late boundary rollover under feed delays, Safari-specific installed-app routing, the complete historical dataset, a real settled Up/Down result with verified outcome evidence, or a calibrated profitable model.

The browser automation used Chromium emulating phone widths; it was **not** a physical iPhone/Safari test. The Python run used Python 3.14 rather than CI's declared 3.12, and GitHub-hosted Actions runner availability remains unresolved.

**Release decision:** preview is suitable for controlled Omar testing. Do not promote to production until physical iPhone handoff and unresolved CI/release checks are reviewed. No wallet, orders, or account access were added.
