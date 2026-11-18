"""Bender Streamlit chart analyst. Run: streamlit run app.py"""
import streamlit as st
import plotly.graph_objects as go
from bender.data import demo, kraken
from bender.engine import analyze

st.set_page_config(page_title="Bender | Chart Intelligence", page_icon="📊", layout="wide")
st.title("Bender")
st.caption("Goated at reading charts • Research prototype built by Chris × Omar")
st.warning("Signal scores represent rule agreement, NOT win probability or financial advice. No automated trading.")
with st.sidebar:
    st.header("Analyze market")
    source = st.radio("Market data", ["Live Kraken crypto", "Simulated demo"])
    interval = st.selectbox("Candle timeframe", [5, 15], format_func=lambda n: f"{n} minutes")
    symbol = st.selectbox("Pair", ["BTC/USD", "ETH/USD", "SOL/USD"]) if source == "Live Kraken crypto" else "DEMO"
    trend = st.selectbox("Demo trend", ["bullish", "bearish", "sideways"]) if source == "Simulated demo" else None
    go_button = st.button("Read chart", type="primary")
if not go_button:
    st.info("Select a market and timeframe, then click **Read chart**. The demo runs without an API key.")
    st.stop()
try:
    source_label = "KRAKEN" if source == "Live Kraken crypto" else "DEMO"
    candles = kraken(symbol, interval) if source_label == "KRAKEN" else demo(trend, interval)
    result = analyze(candles, symbol=symbol, interval=interval, source=source_label)
except Exception as exc:
    st.error(f"No valid signal available: {exc}")
    st.stop()
if source_label == "DEMO":
    st.error("SIMULATED DATA — NOT LIVE MARKET PRICES")
a, b, c = st.columns(3)
a.metric("Market bias", result["bias"])
b.metric("Rule alignment", f'{result["score"]:+d} / ±{result["max_score"]}')
c.metric("Last closed price", f'{result["last_close"]:,.4f}')
st.caption(f'{result["source"]} • Last closed candle: {result["candle_time_utc"]}')
for warning in result["warnings"]:
    st.warning(warning)
f = result["chart"].tail(140)
chart = go.Figure(data=[go.Candlestick(x=f.timestamp, open=f.open, high=f.high, low=f.low, close=f.close, name="Price")])
for col in ("ema9", "ema20", "ema50", "vwap50"):
    chart.add_trace(go.Scatter(x=f.timestamp, y=f[col], mode="lines", name=col.upper()))
chart.update_layout(xaxis_rangeslider_visible=False, height=540)
st.plotly_chart(chart, use_container_width=True)
st.subheader("Why Bender classified this chart")
for v in result["votes"]:
    direction = "Bullish" if v["direction"] > 0 else "Bearish" if v["direction"] < 0 else "Neutral"
    st.write(f'**{v["factor"]} — {direction}:** {v["evidence"]}')
st.caption("No verified predictive edge, out-of-sample backtest, or risk-adjusted performance yet.")
