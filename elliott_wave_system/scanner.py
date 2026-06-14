# scanner.py
"""
Stock scanner module.
Runs wave detection across all Nifty 50 stocks for a given timeframe,
filtering for high-confidence setup configurations (early Wave 3, Wave 5 exhaustion).
"""
import pandas as pd
import logging
from config import NIFTY_50_TICKERS
from data_loader import fetch_stock_data
from indicators import add_all_indicators
from wave_detector import detect_waves_and_signals

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def scan_nifty50(interval: str = '1d', period: str = None) -> pd.DataFrame:
    """
    Scans all Nifty 50 stocks and returns a summary DataFrame of detected signals.
    """
    results = []
    
    total = len(NIFTY_50_TICKERS)
    logging.info(f"Starting scan of {total} Nifty 50 stocks...")
    
    for idx, ticker in enumerate(NIFTY_50_TICKERS, 1):
        logging.info(f"[{idx}/{total}] Processing {ticker}...")
        
        # 1. Fetch data
        df = fetch_stock_data(ticker, interval, period)
        if df.empty or len(df) < 30:
            continue
            
        # 2. Add indicators
        df = add_all_indicators(df)
        
        # 3. Detect waves and signals
        df = detect_waves_and_signals(df)
        
        # Check the last row for signals
        last_row = df.iloc[-1]
        sig = last_row.get('wave_signal', 'neutral')
        conf = last_row.get('confidence', 0.0)
        price = last_row['Close']
        volume = last_row['Volume']
        
        # Check historical wave label count to see if we have labels
        has_wave_labels = df['wave_label'].dropna().tolist()
        latest_label = has_wave_labels[-1] if len(has_wave_labels) > 0 else 'None'
        
        results.append({
            'Ticker': ticker,
            'Price': round(price, 2),
            'Signal': sig,
            'Confidence': round(conf, 2),
            'Latest Label': latest_label,
            'Volume': int(volume)
        })
        
    scan_df = pd.DataFrame(results)
    if not scan_df.empty:
        # Sort so that active signals are on top
        scan_df['SortOrder'] = scan_df['Signal'].apply(lambda x: 0 if x == 'early_w3' else (1 if x == 'w5_exhaustion' else 2))
        scan_df = scan_df.sort_values(by=['SortOrder', 'Confidence'], ascending=[True, False]).drop(columns=['SortOrder'])
        
    return scan_df

if __name__ == '__main__':
    # Test scanner on daily timeframe
    res = scan_nifty50(interval='1d', period='6mo')
    print("\n--- SCAN RESULTS ---")
    print(res.to_string(index=False))
