# data_loader.py
"""
Data loading module for fetching and cleaning historical stock data from yfinance.
"""
import yfinance as yf
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def fetch_stock_data(symbol: str, interval: str = '1d', period: str = None) -> pd.DataFrame:
    """
    Fetches OHLCV historical market data for a given symbol.
    
    Parameters:
    - symbol: Stock ticker symbol (e.g. 'RELIANCE.NS')
    - interval: Data interval (1m, 5m, 15m, 1h, 1d)
    - period: Retrieval period (e.g. 1mo, 1y, 5y). If None, defaults based on interval.
    
    Returns:
    - cleaned pandas DataFrame with Datetime index and standard columns:
      ['Open', 'High', 'Low', 'Close', 'Volume']
    """
    from config import INTERVAL_PERIODS
    
    if not period:
        period = INTERVAL_PERIODS.get(interval, '1y')
        
    logging.info(f"Fetching data for {symbol} (Interval: {interval}, Period: {period})...")
    
    try:
        # Fetch data
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            logging.warning(f"No data returned for {symbol}")
            return pd.DataFrame()
            
        # Flatten MultiIndex columns if present (common in newer yfinance versions)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        # Ensure correct column casing and keep standard OHLCV
        required_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        df = df[[col for col in required_cols if col in df.columns]]
        
        # Check if all required columns exist
        missing_cols = set(required_cols) - set(df.columns)
        if missing_cols:
            logging.error(f"Missing required columns {missing_cols} for {symbol}")
            return pd.DataFrame()
            
        # Ensure values are numeric and drop rows with empty values in OHLC
        for col in required_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
        df = df.dropna(subset=['Open', 'High', 'Low', 'Close'])
        
        # Reset index to make 'Datetime' or 'Date' a column and establish a clean index
        df = df.reset_index()
        if 'Date' in df.columns:
            df = df.rename(columns={'Date': 'Datetime'})
            
        logging.info(f"Successfully loaded {len(df)} candles for {symbol}")
        return df
        
    except Exception as e:
        logging.error(f"Error fetching data for {symbol}: {str(e)}")
        return pd.DataFrame()

def fetch_multiple_stocks(symbols: list, interval: str = '1d', period: str = None) -> dict:
    """
    Fetches market data for multiple symbols in a loop.
    Returns a dict mapping symbol -> DataFrame.
    """
    results = {}
    for sym in symbols:
        df = fetch_stock_data(sym, interval, period)
        if not df.empty:
            results[sym] = df
    return results

if __name__ == '__main__':
    # Simple test
    test_df = fetch_stock_data('RELIANCE.NS', '1d', '1mo')
    print(test_df.head())
