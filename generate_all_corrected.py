import requests
import pandas as pd
import numpy as np
import yfinance as yf
import time
import os

# Available Indian stock symbols from App.jsx
SYMBOLS = [
    'RELIANCE.NS', 'VEDL.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS', 
    'BHARTIARTL.NS', 'SBIN.NS', 'LICI.NS', 'ITC.NS', 'LT.NS', 
    'TATASTEEL.NS', 'SUNPHARMA.NS', 'AXISBANK.NS', 'KOTAKBANK.NS', 
    'WIPRO.NS', 'HINDUNILVR.NS', 'ADANIENT.NS', 'ADANIPORTS.NS', 
    'ASIANPAINT.NS', 'BAJFINANCE.NS', 'BAJAJFINSV.NS', 'BPCL.NS', 
    'CIPLA.NS', 'COALINDIA.NS', 'DRREDDY.NS', 'EICHERMOT.NS', 
    'GRASIM.NS', 'HCLTECH.NS', 'HINDALCO.NS', 'JSWSTEEL.NS', 
    'MARUTI.NS', 'NESTLEIND.NS', 'NTPC.NS', 'ONGC.NS', 'POWERGRID.NS', 
    'TATACONSUM.NS', 'TECHM.NS', 'TITAN.NS', 'ULTRACEMCO.NS', 'BEL.NS', 'HDFCLIFE.NS'
]

THRESHOLD = 2.0
PUBLIC_DIR = r"c:\Users\nachi\OneDrive\Desktop\bar chart\test\my-react-app\public"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.screener.in/"
}

def get_screener_company_id(ticker):
    """
    Queries Screener search suggest API to find the company ID for a given ticker.
    """
    search_url = f"https://www.screener.in/api/company/search/?q={ticker}"
    r = requests.get(search_url, headers=headers, timeout=15)
    r.raise_for_status()
    results = r.json()
    
    if not results:
        return None
        
    # 1. Look for exact match in URL path component
    for item in results:
        url_part = item.get('url', '').split('/')
        if len(url_part) > 2 and url_part[2].upper() == ticker.upper():
            return item['id']
            
    # 2. Fallback to the first item's ID
    return results[0]['id']

def process_symbol(symbol):
    print(f"\n==================================================")
    print(f"PROCESSING: {symbol}")
    print(f"==================================================")
    
    ticker = symbol.split('.')[0]
    
    # 1. Resolve Screener Company ID
    try:
        screener_id = get_screener_company_id(ticker)
        if not screener_id:
            print(f"[ERROR] Could not resolve Screener ID for {ticker}")
            return False
        print(f"[OK] Resolved Screener ID: {screener_id}")
    except Exception as e:
        print(f"[ERROR] Screener ID search failed: {e}")
        return False
        
    # 2. Download Yahoo Finance Data
    try:
        print("Downloading Yahoo Finance Data...")
        yf_df = yf.download(symbol, period="max", auto_adjust=False, progress=False)
        if yf_df.empty:
            print(f"[ERROR] Yahoo Finance returned empty dataframe for {symbol}")
            return False
            
        yf_df.reset_index(inplace=True)
        yf_df = yf_df[["Date", "Close"]]
        yf_df.columns = ["date", "yahoo_close"]
        yf_df["date"] = pd.to_datetime(yf_df["date"])
    except Exception as e:
        print(f"[ERROR] Yahoo Finance download failed: {e}")
        return False
        
    # 3. Download Screener Data
    try:
        print("Downloading Screener Data...")
        url = f"https://www.screener.in/api/company/{screener_id}/chart/?q=Price&days=3650&consolidated=true"
        r = requests.get(url, headers=headers, timeout=20)
        r.raise_for_status()
        data = r.json()
        
        values = data["datasets"][0]["values"]
        screener_df = pd.DataFrame(values, columns=["date", "screener_close"])
        screener_df["date"] = pd.to_datetime(screener_df["date"])
        screener_df["screener_close"] = screener_df["screener_close"].astype(float)
    except Exception as e:
        print(f"[ERROR] Screener Data download failed: {e}")
        return False
        
    # 4. Calculate Ratio & Perform Correction Logic
    try:
        # Filter Fridays for Yahoo Data
        fridays = yf_df[yf_df["date"].dt.dayofweek == 4].copy()
        
        # Merge Friday quotes with Screener Close
        weekly_ratio = pd.merge(fridays, screener_df, on="date", how="inner")
        if weekly_ratio.empty:
            print(f"[ERROR] No overlapping weekly Friday data found between Yahoo and Screener for {symbol}")
            return False
            
        weekly_ratio["ratio"] = weekly_ratio["screener_close"] / weekly_ratio["yahoo_close"]
        weekly_ratio = weekly_ratio[["date", "ratio"]]
        
        # Merge ratios back to Daily Data
        daily = pd.merge(yf_df, weekly_ratio, on="date", how="left")
        daily["ratio"] = daily["ratio"].ffill() # Do not bfill to prevent backward estimation before Screener starts
        
        # Generate Estimates and Adjustments
        daily["estimated_screener"] = daily["yahoo_close"] * daily["ratio"]
        daily["ratio_diff_pct"] = (daily["ratio"] - 1).abs() * 100
        
        daily["corrected_close"] = np.where(
            daily["ratio"].isna(),
            np.nan,
            np.where(
                daily["ratio_diff_pct"] >= THRESHOLD,
                daily["estimated_screener"],
                daily["yahoo_close"]
            )
        )
        daily["was_corrected"] = (daily["ratio_diff_pct"] >= THRESHOLD) & daily["ratio"].notna()
        
        # Save output CSV directly to React public folder
        out_path = os.path.join(PUBLIC_DIR, f"{symbol}_corrected.csv")
        daily.to_csv(out_path, index=False)
        
        print(f"[OK] Saved corrected CSV: {out_path}")
        print(f"[OK] Summary: Total Rows={len(daily)}, Corrected Rows={daily['was_corrected'].sum()}")
        return True
        
    except Exception as e:
        print(f"[ERROR] Correction process failed: {e}")
        return False

def main():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    success_count = 0
    
    for sym in SYMBOLS:
        success = process_symbol(sym)
        if success:
            success_count += 1
        # Sleep for a short duration to avoid hitting rate limits
        time.sleep(1.5)
        
    print(f"\n==================================================")
    print(f"COMPLETED! Processed {success_count} / {len(SYMBOLS)} symbols successfully.")
    print(f"==================================================")

if __name__ == "__main__":
    main()
