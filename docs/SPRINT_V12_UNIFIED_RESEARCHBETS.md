# Sprint v1.2 — Unified ResearchBets integration (review candidate)

## Architecture and scope

Bender remains the parent website at `bender-one-nu.vercel.app`; Bitcoin and SPY retain their static frontend and local Vercel API functions. The ResearchBets Next.js application is mounted at `/research-bets` through a same-origin Vercel multi-zone reverse proxy. ResearchBets continues to own OCR, DraftSlipStore, Ticket X-Ray, risk and decision engines, history, market providers and account state. This is **not** a new independent research implementation and not an iframe or external browser handoff.

The ResearchBets preview branch sets `basePath: '/research-bets'` only on its explicitly targeted branch or when `RESEARCHBETS_BENDER_MOUNT=1`. This is required so `/_next` assets and native Next.js links resolve through the Bender path. The Bender integration branch pins its rewrite upstream to the exact ResearchBets preview deployment for commit `ac1d0c1f8f2bffba26302b2eb77c8f544aea8256`. **This is a review-only coupling**, not an approved production configuration. Repoint this destination to a stable, reachable, prefixed ResearchBets deployment before production.

## Implemented

- Screenshot-first first action links to native reviewed, multi-image upload, relying on the previous screenshot-integrity branch rather than a second uploader.
- Explore Today's Games retrieves the new schedule-only `/api/sports/slate` adapter for NBA, NFL, NHL, MLB and UFC. It calls ResearchBets' existing canonical `oddsProvider.fetchEvents` without requiring a full player-prop model scan. Browser local timezone and local calendar date are passed explicitly; kickoff UTC timestamp is now preserved separately from existing localized display label.
- Only fresh, provider-backed `schedule_only` events from the user's local date are displayed. The dashboard differentiates upcoming from started-by-kickoff and does not claim verified scores, active clocks or outcomes. Incomplete coverage is explicit.
- Existing NFL-only market-supported ideas remain connected to canonical DraftSlipStore and X-Ray. Other sports currently offer provider-backed game research **only**, not a priced multi-leg idea generator.
- Bender's static BTC/SPY assets and local APIs are not replaced. Legacy manual parlay math is not loaded by the new sports route.

## Remaining work and release gates

1. Vercel reports `api-deployments-free-per-day` HTTP 402 after more than 100 deployments. The original RB preview builds failed JSX lint; corrections are committed but no new successful build has been observed. Bender GitHub Actions fails before a runner gets steps or logs. Owner-side platform limits must be resolved before final QA.
2. Provide a stable **publicly accessible** ResearchBets integration zone for Bender; the current Vercel feature preview requires SSO, which a public Bender rewrite cannot satisfy. A separate production zone project with `RESEARCHBETS_BENDER_MOUNT=1` avoids breaking standalone ResearchBets and preserves existing preview protection. Then verify Bender proxy routes, static Next.js assets, POST screenshot/parse APIs, session cookies, native navigation, and original BTC/SPY endpoints in a deployed preview. Verify the ResearchBets preview is accessible through the Bender reverse proxy despite deployment protection.
3. Exercise real anonymized FanDuel, DraftKings, Kalshi and PrizePicks multi-image screenshots, omitted-selection count guards, and correction-before-X-Ray. Test 390×844 and narrow mobile browsers.
4. Expand source-authorized league and market coverage, validated live status/scores (the existing `TodayGame` currently only supports upcoming/live), and multi-league idea generation through canonical X-Ray. Do not fabricate markets, quotes, or probabilities.
5. Provider licensing, injuries, rates and cache-freshness audits; no automated wagers. Existing screenshot draft PR must pass its own checks.
6. Production needs a stable paired Next.js deployment, full regression evidence and explicit release authorization. **NO-GO** on production while these items remain open.

The two integration branches intentionally target their respective already-open screenshot integrity branches as dependent review slices, rather than rewriting the main branch or merging unreviewed work.

## Independent verification (2026-11-21)

- Bender feature branch independently tested: **77/77 JavaScript tests passed**, **30/30 Python tests passed** after declared dependencies installed.
- Headless Chromium market regression: **5/5 viewport scenarios** (320x568, 375x812, 390x844, 768x1024, 1280x800) and **7/7 fault/recovery scenarios passed**. Fixture market feeds were used.
- Static Vercel rewrite audit passed: /research-bets mount, sports/screenshot API paths, no general catch-all, BTC/SPY exact API paths protected, single upstream and no secrets in config.
- ResearchBets paired branch: complete npm run check exit 0, 773/773 tests, Next.js production build and basePath=/research-bets confirmed. Local Next runtime returned 200 on /research-bets, /research-bets/ingest and /research-bets/api/health with mount env present; unconfigured sports provider returned truthful HTTP 503.
- Branch-specific Vercel preview setting RESEARCHBETS_BENDER_MOUNT=1 now configured on ResearchBets integration branch.

**Still NO-GO**: Official Vercel deployment/build quota HTTP 402, protected preview SSO prevents public Bender reverse proxy, cross-zone authentication/navigation/screenshot e2e and physical iPhone acceptance unverified. The Bender rewrite currently references a protected branch-preview hostname that must be replaced with a stable publicly accessible integration zone. Production unchanged.

## Integration release review (2026-11-22)

- Added and verified the ResearchBets branch-specific domain `research-bets-bender.vercel.app`, pinned to `feat/v12-unified-sports-entry-20261121`. It resolves in Vercel's project-domain and deployment records, and retains the existing standalone production domain. Its public HTTP behavior has not been independently tested end to end.
- Changed all 74 Bender ResearchBets rewrites to the integration domain. Verified the config has unique, scoped rewrite sources and does not shadow Bender's exact local BTC/SPY endpoint names.
- Deployed Bender preview from commit `46b0b352247e0b24e3a0013c41dd8e14a91ccb0c` with explicit `site/` project root, Node 22, and `npm test` build gate. Vercel recorded READY and **77/77 passing Node tests**. The first deployment attempt omitted root/test build settings and is not usable as proof; use only the explicitly configured preview and later descendants.
- Updated the review UI build marker to `BETA v1.2` (commit `d14d35c4d8bd03ab4da8ae195de0453947008825`). This commit still requires its own preview build and release QA.
- The Vercel quota limit documented on November 21 is not currently blocking these Bender previews; it may recur if deployment limits are reached. ResearchBets' latest feature deployment also reports READY, but its original preview hostname is protected; the new domain's public access and proxied behavior still require real HTTP/iPhone verification.
- GitHub Actions `unit-tests` checks continue to fail before runner steps appear, despite Vercel's passing Bender Node suite. A workflow rerun has been requested. The standalone Python suite and end-to-end browser tests still require CI or equivalent new-commit verification.

**Release gate remains NO-GO:** Do not merge the stacked PRs or promote the production deployment until both projects' latest-commit previews, public proxy routing, screenshot OCR, app navigation/auth cookies, live provider provenance, BTC/SPY regressions, and physical mobile acceptance are confirmed. Keep `bender-one-nu.vercel.app` unchanged meanwhile.
