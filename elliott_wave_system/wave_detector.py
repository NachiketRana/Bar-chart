# wave_detector.py
"""
Elliott Wave Detection Engine.
Implements:
1. ZigZag pivot point detection.
2. Rule-based Elliott Wave validation (Motive 1-5 & Corrective A-B-C).
3. Predictive scoring for early Wave 3 setups.
4. Divergence-based Wave 5 exhaustion signals.
"""
import pandas as pd
import numpy as np
import logging
from config import DEFAULT_CONFIDENCE_THRESHOLD, FIB_RET_LEVELS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def detect_zigzag_pivots(df: pd.DataFrame, min_percent: float = 2.0) -> list:
    """
    Detects alternating peak/valley pivots.
    Returns a list of dicts: [{'index': int, 'time': Timestamp, 'price': float, 'type': 'high'|'low'}]
    """
    if len(df) < 10:
        return []

    closes = df['Close'].values
    times = df['Datetime'].values
    
    pivots = []
    trend = 0  # 1 = up, -1 = down
    last_pivot_price = closes[0]
    temp_extrema_idx = 0
    temp_extrema_price = closes[0]

    # Find initial trend direction
    for i in range(1, len(df)):
        price = closes[i]
        diff_pct = ((price - last_pivot_price) / last_pivot_price) * 100
        if abs(diff_pct) >= min_percent:
            trend = 1 if diff_pct > 0 else -1
            temp_extrema_idx = i
            temp_extrema_price = price
            pivots.append({
                'index': 0,
                'time': times[0],
                'price': closes[0],
                'type': 'low' if trend == 1 else 'high'
            })
            last_pivot_price = price
            break

    if trend == 0:
        return []

    # Main detection loop
    for i in range(temp_extrema_idx + 1, len(df)):
        price = closes[i]

        if trend == 1:
            # In uptrend, looking for higher peak
            if price > temp_extrema_price:
                temp_extrema_price = price
                temp_extrema_idx = i
            else:
                # Check for trend reversal
                drop_pct = ((temp_extrema_price - price) / temp_extrema_price) * 100
                if drop_pct >= min_percent:
                    pivots.append({
                        'index': temp_extrema_idx,
                        'time': times[temp_extrema_idx],
                        'price': temp_extrema_price,
                        'type': 'high'
                    })
                    trend = -1
                    temp_extrema_price = price
                    temp_extrema_idx = i
        else:
            # In downtrend, looking for lower trough
            if price < temp_extrema_price:
                temp_extrema_price = price
                temp_extrema_idx = i
            else:
                # Check for trend reversal
                rise_pct = ((price - temp_extrema_price) / temp_extrema_price) * 100
                if rise_pct >= min_percent:
                    pivots.append({
                        'index': temp_extrema_idx,
                        'time': times[temp_extrema_idx],
                        'price': temp_extrema_price,
                        'type': 'low'
                    })
                    trend = 1
                    temp_extrema_price = price
                    temp_extrema_idx = i

    # Add final endpoint
    pivots.append({
        'index': temp_extrema_idx,
        'time': times[temp_extrema_idx],
        'price': temp_extrema_price,
        'type': 'high' if trend == 1 else 'low'
    })

    return pivots

def validate_motive_wave(p0, p1, p2, p3, p4, p5) -> str:
    """
    Validates classic 5-Wave Elliott motive structure.
    Returns 'bullish', 'bearish', or None.
    """
    # 1. Bullish Wave checks
    if (p0['type'] == 'low' and p1['type'] == 'high' and p2['type'] == 'low' and 
        p3['type'] == 'high' and p4['type'] == 'low' and p5['type'] == 'high'):
        
        # Rule 1: Wave 2 cannot retrace below Wave 1 origin
        if p2['price'] <= p0['price']: return None
        # Rule 2: Wave 3 is not the shortest
        w1 = p1['price'] - p0['price']
        w3 = p3['price'] - p2['price']
        w5 = p5['price'] - p4['price']
        if w3 < w1 and w3 < w5: return None
        # Rule 3: Wave 3 must exceed Wave 1 high
        if p3['price'] <= p1['price']: return None
        # Rule 4: Wave 4 cannot overlap with Wave 1 territory
        if p4['price'] <= p1['price']: return None
        
        return 'bullish'

    # 2. Bearish Wave checks
    elif (p0['type'] == 'high' and p1['type'] == 'low' and p2['type'] == 'high' and 
          p3['type'] == 'low' and p4['type'] == 'high' and p5['type'] == 'low'):
          
        # Rule 1: Wave 2 cannot retrace above Wave 1 origin
        if p2['price'] >= p0['price']: return None
        # Rule 2: Wave 3 is not the shortest
        w1 = p0['price'] - p1['price']
        w3 = p2['price'] - p3['price']
        w5 = p4['price'] - p5['price']
        if w3 < w1 and w3 < w5: return None
        # Rule 3: Wave 3 must exceed Wave 1 low
        if p3['price'] >= p1['price']: return None
        # Rule 4: Wave 4 cannot overlap with Wave 1 territory
        if p4['price'] >= p1['price']: return None
        
        return 'bearish'

    return None

def validate_abc_correction(p5, pa, pb, pc, impulse_type: str) -> bool:
    """Validates simple A-B-C correction sequence."""
    if impulse_type == 'bullish':
        # Bullish Correction goes down (A), up (B), down (C)
        if pa['type'] != 'low' or pb['type'] != 'high' or pc['type'] != 'low':
            return False
        if pa['price'] >= p5['price']: return False
        if pb['price'] <= pa['price'] or pb['price'] >= p5['price']: return False
        if pc['price'] >= pb['price']: return False
        return True
    else:
        # Bearish Correction goes up (A), down (B), up (C)
        if pa['type'] != 'high' or pb['type'] != 'low' or pc['type'] != 'high':
            return False
        if pa['price'] <= p5['price']: return False
        if pb['price'] >= pa['price'] or pb['price'] <= p5['price']: return False
        if pc['price'] <= pb['price']: return False
        return True

def detect_waves_and_signals(df: pd.DataFrame, threshold: float = DEFAULT_CONFIDENCE_THRESHOLD) -> pd.DataFrame:
    """
    Main engine function.
    1. Runs ZigZag pivot search over different deviations.
    2. Labels validated waves (1-5 and A-B-C).
    3. Calculates real-time confidence scores for early Wave 3 setups.
    4. Evaluates Wave 5 exhaustion signals.
    """
    df = df.copy()
    df['wave_label'] = None
    df['wave_signal'] = 'neutral'
    df['confidence'] = 0.0

    if len(df) < 30:
        return df

    # Find the most matching ZigZag threshold
    deviations = [2.0, 1.5, 2.5, 3.0, 1.0, 4.0, 5.0]
    pivots = []
    
    for dev in deviations:
        pivots = detect_zigzag_pivots(df, dev)
        if len(pivots) >= 6:
            break
            
    if len(pivots) < 2:
        return df

    # 1. Label Validated Completed Waves (Historical)
    # Check sequences from end to start to find the most recent complete pattern
    labeled = False
    
    # Check for 9-point Cycle (0-5 + ABC)
    if len(pivots) >= 9:
        for idx in range(len(pivots) - 9, -1, -1):
            p = pivots[idx : idx + 9]
            motive_res = validate_motive_wave(p[0], p[1], p[2], p[3], p[4], p[5])
            if motive_res and validate_abc_correction(p[5], p[6], p[7], p[8], motive_res):
                # Write labels
                labels = ['0', '1', '2', '3', '4', '5', 'A', 'B', 'C']
                for pt, label in zip(p, labels):
                    df.loc[pt['index'], 'wave_label'] = label
                labeled = True
                break

    # If no 9-point cycle, look for 6-point Motive (0-5)
    if not labeled and len(pivots) >= 6:
        for idx in range(len(pivots) - 6, -1, -1):
            p = pivots[idx : idx + 6]
            motive_res = validate_motive_wave(p[0], p[1], p[2], p[3], p[4], p[5])
            if motive_res:
                labels = ['0', '1', '2', '3', '4', '5']
                for pt, label in zip(p, labels):
                    df.loc[pt['index'], 'wave_label'] = label
                break

    # 2. Predictive Signals for Live/Recent Candles
    # Look at the latest two pivots to see if they form a Wave 1 (p0 -> p1) and we are currently in Wave 2 retracement
    latest_p1 = pivots[-1]
    latest_p0 = pivots[-2]

    current_idx = len(df) - 1
    current_close = df.loc[current_idx, 'Close']
    current_volume = df.loc[current_idx, 'Volume']
    
    # Extract recent metrics
    avg_volume = df['Volume'].rolling(window=20).mean().iloc[-1]
    
    # ------------------
    # WAVE 3 EARLY SIGNAL (Bullish Setup)
    # ------------------
    if latest_p0['type'] == 'low' and latest_p1['type'] == 'high':
        w1_height = latest_p1['price'] - latest_p0['price']
        
        if w1_height > 0:
            # Fibonacci Levels
            fib50 = latest_p1['price'] - (0.50 * w1_height)
            fib786 = latest_p1['price'] - (0.786 * w1_height)
            
            # Check conditions
            is_in_fib_zone = fib786 <= current_close <= fib50
            
            # EWO checks
            ewo_slope_up = False
            if 'ewo' in df.columns and len(df) > 2:
                ewo_slope_up = df['ewo'].iloc[-1] > df['ewo'].iloc[-2]
                
            # Volume surge
            is_volume_strong = current_volume > (avg_volume * 1.3)
            
            # Scoring
            score = 0.0
            if is_in_fib_zone:
                score += 0.4
            if ewo_slope_up:
                score += 0.3
            if is_volume_strong:
                score += 0.3
                
            if score >= threshold:
                df.loc[current_idx, 'wave_signal'] = 'early_w3'
                df.loc[current_idx, 'confidence'] = score

    # ------------------
    # WAVE 5 EXHAUSTION SIGNAL (Bearish Setup)
    # ------------------
    # If we have at least 5 pivots, check if we are forming Wave 5
    if len(pivots) >= 5:
        p0, p1, p2, p3, p4 = pivots[-5:]
        motive_partial = (p0['type'] == 'low' and p1['type'] == 'high' and p2['type'] == 'low' and 
                          p3['type'] == 'high' and p4['type'] == 'low')
        
        if motive_partial and current_close > p3['price']:
            # Price broke Wave 3 high, forming Wave 5 peak candidate
            divergence_score = 0.0
            
            # Check RSI Bearish Divergence
            if 'rsi' in df.columns:
                rsi_w3 = df['rsi'].iloc[p3['index']]
                rsi_now = df['rsi'].iloc[-1]
                if rsi_now < rsi_w3 and rsi_now > 60:
                    divergence_score += 0.5
                    
            # Check EWO Bearish Divergence
            if 'ewo' in df.columns:
                ewo_w3 = df['ewo'].iloc[p3['index']]
                ewo_now = df['ewo'].iloc[-1]
                if ewo_now < ewo_w3:
                    divergence_score += 0.5
                    
            if divergence_score >= 0.5:
                df.loc[current_idx, 'wave_signal'] = 'w5_exhaustion'
                df.loc[current_idx, 'confidence'] = divergence_score

    return df
