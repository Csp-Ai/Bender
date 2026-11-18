# Bender web terminal
Production-ready **static frontend and read-only Vercel Node.js API**; the research Python app in the repository root remains independent.

The UI loads only completed 5/15-minute bars from Kraken, excludes the in-progress bar, and calculates 8 explainable indicators. Auto-check runs every 45 seconds while the page is open. A deterministic synthetic mode is available for testing and always explicitly labeled.

Vercel: link the GitHub repository \`Csp-Ai/Bender\` and configure the **Root Directory** to \`site\`; framework = Other. No environment keys or separate build command required. Code from \`site/api/candles.js\` runs as a serverless function.

This is a **research prototype**. No proven forecasting edge, backtests, trade execution, or guaranteed accuracy. Never treat directional rule alignment as odds. Next steps: check runtime health, out-of-sample evaluations, historical candles, alerts and optional SPY provider.

The repository has a separate Python Streamlit prototype under \`app.py\`, \`bender/\` and \`tests/\`; don't deploy that source as this web frontend.
