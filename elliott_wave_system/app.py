# app.py
"""
Streamlit Web Dashboard for Elliott Wave Detection System.
Provides a premium dark-themed UI to analyze symbols, inspect indicators,
and view scanner outputs for Nifty 50 stocks.
"""
# pyrefly: ignore [missing-import]
import streamlit as st
import pandas as pd
import numpy as np
import logging
from config import NIFTY_50_TICKERS, INTERVAL_PERIODS
from data_loader import fetch_stock_data
from indicators import add_all_indicators
from wave_detector import detect_waves_and_signals
from scanner import scan_nifty50
from visualization import plot_full_chart

logging.basicConfig(level=logging.INFO)

# Page configuration
st.set_page_config(
    page_title="Elliott Wave Detection System",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling (Dark Mode Harmony)
st.markdown("""
    <style>
    .main {
        background-color: #0e1117;
    }
    .metric-card {
        background-color: #1e222b;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #2e323b;
        text-align: center;
    }
    .signal-card {
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        font-weight: bold;
        font-size: 20px;
    }
    </style>
""", unsafe_allow_html=True)

st.title("📈 Professional Multi-Indicator Elliott Wave Detection System")
st.markdown("Early-stage pattern identification and scanning across Nifty 50 stocks.")

# Sidebar Configuration
st.sidebar.header("⚙️ Configuration")

mode = st.sidebar.radio("Navigation", ["Single Stock Analysis", "Nifty 50 Market Scanner"])

interval = st.sidebar.selectbox(
    "Candle Interval",
    options=["1d", "1h", "15m", "5m", "1m"],
    index=0
)

# Set corresponding defaults for period based on interval
default_period = INTERVAL_PERIODS.get(interval, '1y')
period_options = {
    '1d': ['1y', '2y', '5y', '6mo'],
    '1h': ['60d', '730d', '30d'],
    '15m': ['60d', '30d', '7d'],
    '5m': ['60d', '7d', '1d'],
    '1m': ['7d', '1d']
}
period = st.sidebar.selectbox(
    "Data Period",
    options=period_options.get(interval, ['1y']),
    index=0
)

if mode == "Single Stock Analysis":
    st.sidebar.subheader("Stock Selection")
    symbol = st.sidebar.selectbox(
        "Nifty 50 Ticker",
        options=NIFTY_50_TICKERS,
        index=37  # Defaults to RELIANCE.NS
    )
    
    st.sidebar.markdown("""
    ### ℹ️ Wave Key
    * **1, 3, 5**: Impulse Highs
    * **2, 4**: Corrective Lows
    * **A, B, C**: Correction Phase
    * **▲ Buy W3**: Early Wave 3 Trigger
    * **▼ Sell W5**: Wave 5 Exhaustion Warning
    """)
    
    # Run Single Stock Pipeline
    with st.spinner(f"Loading and processing {symbol}..."):
        df = fetch_stock_data(symbol, interval, period)
        
        if not df.empty:
            df = add_all_indicators(df)
            df = detect_waves_and_signals(df)
            
            last_row = df.iloc[-1]
            price = last_row['Close']
            prev_price = df.iloc[-2]['Close'] if len(df) > 1 else price
            price_change = price - prev_price
            price_change_pct = (price_change / prev_price) * 100
            
            sig = last_row['wave_signal']
            conf = last_row['confidence']
            rsi = last_row['rsi'] if 'rsi' in last_row else np.nan
            ewo = last_row['ewo'] if 'ewo' in last_row else np.nan
            
            # Metrics Row
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric(
                    label="Current Price",
                    value=f"₹{price:.2f}",
                    delta=f"{price_change:+.2f} ({price_change_pct:+.2f}%)"
                )
            with col2:
                st.metric(
                    label="RSI (14)",
                    value=f"{rsi:.2f}" if not np.isnan(rsi) else "N/A",
                    delta="Overbought (>70)" if rsi > 70 else ("Oversold (<30)" if rsi < 30 else "Neutral")
                )
            with col3:
                st.metric(
                    label="EWO (5/35)",
                    value=f"{ewo:.4f}" if not np.isnan(ewo) else "N/A"
                )
            with col4:
                # Color code signals
                if sig == 'early_w3':
                    st.markdown('<div class="signal-card" style="background-color: #1b5e20; color: #a5d6a7;">🚀 BUY: Early Wave 3</div>', unsafe_allow_html=True)
                elif sig == 'w5_exhaustion':
                    st.markdown('<div class="signal-card" style="background-color: #b71c1c; color: #ff8a80;">⚠️ SELL: Wave 5 Exhaustion</div>', unsafe_allow_html=True)
                else:
                    st.markdown('<div class="signal-card" style="background-color: #37474f; color: #eceff1;">Neutral Setup</div>', unsafe_allow_html=True)
            
            # Draw interactive plotly chart
            fig = plot_full_chart(df, symbol)
            st.plotly_chart(fig, use_container_width=True)
            
            # Detail Section
            st.subheader("📊 Latest 5 Candles Data Table")
            display_cols = ['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume', 'rsi', 'ewo', 'wave_label', 'wave_signal', 'confidence']
            display_cols = [c for c in display_cols if c in df.columns]
            st.dataframe(df[display_cols].tail(5).style.format({
                'Open': '{:.2f}', 'High': '{:.2f}', 'Low': '{:.2f}', 'Close': '{:.2f}',
                'rsi': '{:.2f}', 'ewo': '{:.4f}', 'confidence': '{:.2f}'
            }))
            
        else:
            st.error(f"Failed to fetch data for {symbol} with the selected options.")

else:
    # Mode: Nifty 50 Market Scanner
    st.subheader("🔍 Nifty 50 Real-time Scanner")
    st.write("Scan the whole market to look for active wave trading setups.")
    
    scan_btn = st.button("🚀 Start Market Scan")
    
    if scan_btn:
        with st.spinner("Scanning Nifty 50 tickers... (takes a few seconds)"):
            scan_df = scan_nifty50(interval, period)
            
            if not scan_df.empty:
                # Filter active signals
                signals_only = scan_df[scan_df['Signal'] != 'neutral']
                
                # Layout results
                st.subheader("🚨 Active Buy / Sell Setup Triggers")
                if not signals_only.empty:
                    st.dataframe(signals_only.style.highlight_max(axis=0, subset=['Confidence'], color='#1b5e20'))
                else:
                    st.info("No active setups triggered. All tickers are currently neutral.")
                    
                st.subheader("📋 All Scanned Tickers")
                st.dataframe(scan_df)
            else:
                st.error("No scanner results were fetched.")
                
    st.markdown("""
    ### 💡 How the Scanner works
    1. **Early Wave 3 (BUY):** Identifies stocks that have completed Wave 1 (high pivot) and Wave 2 (low pivot), are currently sitting on the Fibonacci $50\% - 78.6\%$ retracement zone, and have an expanding EWO and high volume.
    2. **Wave 5 Exhaustion (SELL):** Identifies stocks that have completed Waves 1-4, are pushing above the Wave 3 peak to make a new high, but show a bearish divergence on both RSI and EWO.
    """)
