# main.py
"""
CLI Entry Point for the Elliott Wave Detection System.
Usage:
  python main.py --symbol INFY.NS --interval 1d --period 1y
  python main.py --scan --interval 1d
"""
import argparse
import sys
import os
import logging
import pandas as pd
from data_loader import fetch_stock_data
from indicators import add_all_indicators
from wave_detector import detect_waves_and_signals
from scanner import scan_nifty50
from visualization import plot_full_chart

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def main():
    parser = argparse.ArgumentParser(description="Multi-indicator Elliott Wave Detection System")
    parser.add_argument("--symbol", type=str, help="Ticker symbol to analyze (e.g., RELIANCE.NS)")
    parser.add_argument("--interval", type=str, default="1d", choices=["1m", "5m", "15m", "1h", "1d"], help="Candle interval")
    parser.add_argument("--period", type=str, help="History period (e.g. 1mo, 6mo, 1y, 5y)")
    parser.add_argument("--scan", action="store_true", help="Scan Nifty 50 tickers for active setup configurations")
    
    args = parser.parse_args()
    
    if not args.symbol and not args.scan:
        parser.print_help()
        sys.exit(1)
        
    if args.scan:
        print(f"\nScanning Nifty 50 stocks on {args.interval} timeframe...")
        scan_results = scan_nifty50(interval=args.interval, period=args.period)
        
        if scan_results.empty:
            print("No tickers returned scan outputs.")
            sys.exit(0)
            
        print("\n" + "="*70)
        print(f" NIFTY 50 ELLIOTT WAVE SCAN REPORT (Interval: {args.interval})")
        print("="*70)
        
        # Format and display
        signals = scan_results[scan_results['Signal'] != 'neutral']
        if not signals.empty:
            print("\n[ACTIVE SIGNALS DETECTED]:")
            print(signals.to_string(index=False))
        else:
            print("\nNo active buy/sell signals detected at the moment.")
            
        print("\nAll scanned results (Top 15):")
        print(scan_results.head(15).to_string(index=False))
        
    else:
        # Single stock analysis
        df = fetch_stock_data(args.symbol, args.interval, args.period)
        if df.empty:
            print(f"Failed to fetch data for {args.symbol}")
            sys.exit(1)
            
        df = add_all_indicators(df)
        df = detect_waves_and_signals(df)
        
        # Print stats
        print("\n" + "="*50)
        print(f" Analysis Summary for {args.symbol} ({args.interval})")
        print("="*50)
        last_row = df.iloc[-1]
        print(f"Current Price: {last_row['Close']:.2f}")
        print(f"Current RSI:   {last_row['rsi']:.2f}" if 'rsi' in last_row else "RSI: N/A")
        print(f"Current EWO:   {last_row['ewo']:.4f}" if 'ewo' in last_row else "EWO: N/A")
        print(f"Current Signal: {last_row['wave_signal'].upper()}")
        print(f"Confidence:     {last_row['confidence']:.2f}")
        
        # Save Chart
        fig = plot_full_chart(df, args.symbol)
        output_file = f"{args.symbol.replace('.', '_')}_chart.html"
        fig.write_html(output_file)
        print(f"\n[INFO] Interactive chart saved to: {os.path.abspath(output_file)}")
        print("Open this HTML file in your browser to view the interactive chart.")

if __name__ == '__main__':
    main()
