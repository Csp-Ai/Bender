# Bender browser stress checks (optional, isolated)

These Playwright scripts use a **local HTTP server and mocked read-only upstream API responses**. They do not place orders, touch user accounts, or load-test Polymarket's production systems.

From the `site/` directory on a machine supporting Chromium:

```bash
npm install --no-save --no-package-lock playwright@1.58.2
npx playwright install chromium
npm run qa:browser
```

The package's regular `npm test` suite remains dependency-free and is run during Vercel preview builds. Playwright is *not* installed or launched during ordinary user browsing.

- `browser-layout.cjs`: 320, 375, 390, 768, and 1280px views; checks for horizontal overflow, script errors, quote/target rendering, BTC/SPY and real/practice switches, 5/15-minute switching, Past Reads and primary link.
- `browser-faults.cjs`: deliberately missing, stale and impossible quotes; twenty rapid timeframe toggles; interrupted candle feed and recovery; absent market; local journal persistence and no-trade labels.

Test scripts assert on the DOM. The API payloads are deterministic fixtures, *not real settlement data or live performance statistics*. Browser automation cannot reproduce every iOS Safari/WebView app-link behavior; verify the final Polymarket handoff on Omar's physical iPhone.

The layout script can write an optional debug screenshot to `/tmp/bender-375.png`. Any test failure exits nonzero. A failed browser installation or missing system library is an environment limitation, not proof the site passed.

These checks are **not** a sustained concurrency/load test. For market feed capacity or provider rate limits, use explicit rate-limited staging tests and provider permissions rather than hammering third-party APIs.
