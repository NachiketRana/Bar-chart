# config.py
"""
Configuration file for the Elliott Wave Detection System.
Contains default parameters, list of Nifty 50 stocks, and supported intervals.
"""

# Nifty 50 stocks list with yfinance suffix (.NS)
NIFTY_50_TICKERS = [
    "ADANIENT.NS", "ADANIPORTS.NS", "APOLLOHOSP.NS", "ASIANPAINT.NS", "AXISBANK.NS",
    "BAJAJ-AUTO.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS", "BPCL.NS", "BHARTIARTL.NS",
    "BRITANNIA.NS", "CIPLA.NS", "COALINDIA.NS", "DIVISLAB.NS", "DRREDDY.NS",
    "EICHERMOT.NS", "GRASIM.NS", "HCLTECH.NS", "HDFCBANK.NS", "HDFCLIFE.NS",
    "HEROMOTOCO.NS", "HINDALCO.NS", "HINDUNILVR.NS", "ICICIBANK.NS", "ITC.NS",
    "INDUSINDBK.NS", "INFY.NS", "JSWSTEEL.NS", "KOTAKBANK.NS", "LT.NS",
    "LTIM.NS", "M&M.NS", "MARUTI.NS", "NTPC.NS", "NESTLEIND.NS",
    "ONGC.NS", "POWERGRID.NS", "RELIANCE.NS", "SBILIFE.NS", "SBIN.NS",
    "SUNPHARMA.NS", "TCS.NS", "TATACONSUM.NS", "TATAMOTORS.NS", "TATASTEEL.NS",
    "TECHM.NS", "TITAN.NS", "ULTRACEMCO.NS", "WIPRO.NS"
]

# Indicator defaults
DEFAULT_RSI_PERIOD = 14
DEFAULT_EWO_FAST = 5
DEFAULT_EWO_SLOW = 35
DEFAULT_SWING_LOOKBACK = 20
DEFAULT_CONFIDENCE_THRESHOLD = 0.65

# Retracement and expansion targets
FIB_RET_LEVELS = {
    'level_236': 0.236,
    'level_382': 0.382,
    'level_500': 0.500,
    'level_618': 0.618,
    'level_786': 0.786
}

# Supported intervals and default fetching periods
INTERVAL_PERIODS = {
    '1m': '7d',
    '5m': '60d',
    '15m': '60d',
    '1h': '730d',
    '1d': '5y'
}
