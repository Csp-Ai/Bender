# Bender contributor / AI agent instructions

Read README.md, docs/PRODUCT.md and docs/ROADMAP.md before changes. This is a **read-only market research application**.

- All signals must be computed from timestamped, valid, *completed* candles. State feed provenance and warnings.
- Never claim an 8-rule score is a win probability, forecast accuracy, profitability proof or investment recommendation.
- Never fabricate quotes, backtest results, accuracy or market data.
- Never add auto-execution, brokerage orders, wallets, or credentials without explicit product-owner authorization and separate risk/security review.
- Preserve a deterministic demo mode, with prominent SIMULATED labels.
- Any new indicator must include description and tests covering boundaries and invalid input.
- API keys belong in environment variables, not committed files or log output.
- Prefer small reviewable PRs. Run `python -m unittest discover -s tests -v` before merges.
