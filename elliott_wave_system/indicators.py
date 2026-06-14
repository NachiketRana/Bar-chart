# indicators.py
"""
Indicator calculations: EWO, RSI, Fibonacci levels, Volume Analysis,
Market Structure (BOS, CHOCH), and LuxAlgo-style Smart Money signals.
"""
import pandas as pd
import numpy as np
from ta.momentum import RSIIndicator
from config import DEFAULT_RSI_PERIOD, DEFAULT_EWO_FAST, DEFAULT_EWO_SLOW, DEFAULT_SWING_LOOKBACK, FIB_RET_LEVELS

def add_ewo(df: pd.DataFrame, fast: int = DEFAULT_EWO_FAST, slow: int = DEFAULT_EWO_SLOW) -> pd.DataFrame:
    """Calculates the Elliott Wave Oscillator (EWO): SMA(5) - SMA(35) of Close."""
    df = df.copy()
    df['sma_fast'] = df['Close'].rolling(window=fast).mean()
    df['sma_slow'] = df['Close'].rolling(window=slow).mean()
    df['ewo'] = df['sma_fast'] - df['sma_slow']
    
    # Clean up intermediate SMAs
    df = df.drop(columns=['sma_fast', 'sma_slow'])
    return df

def add_rsi(df: pd.DataFrame, period: int = DEFAULT_RSI_PERIOD) -> pd.DataFrame:
    """Calculates RSI using the ta library."""
    df = df.copy()
    if len(df) >= period:
        rsi_ind = RSIIndicator(close=df['Close'], window=period)
        df['rsi'] = rsi_ind.rsi()
    else:
        df['rsi'] = np.nan
    return df

def add_volume_analysis(df: pd.DataFrame, period: int = 20) -> pd.DataFrame:
    """Analyses volume vs its average and outputs volume breakouts."""
    df = df.copy()
    df['vol_sma_20'] = df['Volume'].rolling(window=period).mean()
    df['vol_ratio'] = df['Volume'] / (df['vol_sma_20'].replace(0, np.nan))
    
    # Classify volume strength
    conditions = [
        (df['vol_ratio'] >= 1.8),
        (df['vol_ratio'] >= 1.2) & (df['vol_ratio'] < 1.8),
        (df['vol_ratio'] < 1.2)
    ]
    choices = ['breakout', 'strong', 'normal']
    df['vol_signal'] = np.select(conditions, choices, default='normal')
    return df

def add_fibonacci(df: pd.DataFrame, lookback: int = DEFAULT_SWING_LOOKBACK) -> pd.DataFrame:
    """
    Finds local swing highs and lows and calculates Fibonacci retracement levels
    relative to the most recent swing range at each point in time (no look-forward bias).
    """
    df = df.copy()
    
    # Initialize columns
    df['swing_high'] = np.nan
    df['swing_low'] = np.nan
    for level in FIB_RET_LEVELS.keys():
        df[level] = np.nan
        
    if len(df) < lookback:
        return df

    # Find swing highs and lows historically
    highs = df['High'].values
    lows = df['Low'].values
    
    recent_sh_val = np.nan
    recent_sl_val = np.nan
    
    for i in range(lookback, len(df)):
        # Centered peak check for swing high
        is_high = True
        is_low = True
        
        val_high = highs[i - lookback//2]
        val_low = lows[i - lookback//2]
        
        # Check window
        start_idx = max(0, i - lookback)
        end_idx = i + 1
        
        if val_high != max(highs[start_idx:end_idx]):
            is_high = False
        if val_low != min(lows[start_idx:end_idx]):
            is_low = False
            
        if is_high:
            recent_sh_val = val_high
        if is_low:
            recent_sl_val = val_low
            
        df.loc[i, 'swing_high'] = recent_sh_val
        df.loc[i, 'swing_low'] = recent_sl_val
        
        # If we have both, calculate retracements
        if not np.isnan(recent_sh_val) and not np.isnan(recent_sl_val):
            diff = abs(recent_sh_val - recent_sl_val)
            is_uptrend = recent_sh_val > recent_sl_val  # Simple trend check
            
            for name, pct in FIB_RET_LEVELS.items():
                if is_uptrend:
                    # In an uptrend, retracement is measured down from the high
                    df.loc[i, name] = recent_sh_val - (pct * diff)
                else:
                    # In a downtrend, retracement is measured up from the low
                    df.loc[i, name] = recent_sl_val + (pct * diff)
                    
    return df

def add_market_structure(df: pd.DataFrame, lookback: int = 5) -> pd.DataFrame:
    """
    Detects Higher Highs (HH), Higher Lows (HL), Lower Highs (LH), Lower Lows (LL)
    and Break of Structure (BOS) / Change of Character (CHOCH).
    """
    df = df.copy()
    df['structure'] = 'neutral'
    df['bos'] = False
    
    if len(df) < lookback * 2:
        return df
        
    highs = df['High'].values
    lows = df['Low'].values
    closes = df['Close'].values
    
    last_high = highs[lookback]
    last_low = lows[lookback]
    
    current_trend = 'neutral' # 'bullish', 'bearish'
    
    for i in range(lookback * 2, len(df)):
        close = closes[i]
        
        # Bullish Break of Structure (BOS): price closes above last swing high
        if close > last_high:
            df.loc[i, 'bos'] = True
            current_trend = 'bullish'
            # Update high pivot
            last_high = max(highs[i-lookback:i+1])
            
        # Bearish Break of Structure (BOS): price closes below last swing low
        elif close < last_low:
            df.loc[i, 'bos'] = True
            current_trend = 'bearish'
            # Update low pivot
            last_low = min(lows[i-lookback:i+1])
            
        df.loc[i, 'structure'] = current_trend
        
    return df

def add_luxalgo_signals(df: pd.DataFrame) -> pd.DataFrame:
    """
    Smart Money Concept (SMC) signals inspired by LuxAlgo.
    Detects momentum shifts at key support and resistance zones.
    """
    df = df.copy()
    df['lux_buy'] = False
    df['lux_sell'] = False
    
    if 'rsi' not in df.columns:
        df = add_rsi(df)
    if 'swing_high' not in df.columns:
        df = add_fibonacci(df)
        
    closes = df['Close'].values
    rsis = df['rsi'].values
    shs = df['swing_high'].values
    sls = df['swing_low'].values
    
    for i in range(20, len(df)):
        close = closes[i]
        rsi = rsis[i]
        sh = shs[i]
        sl = sls[i]
        
        if np.isnan(rsi) or np.isnan(sh) or np.isnan(sl):
            continue
            
        # LuxAlgo Bullish Signal:
        # Price is near the swing low support, and RSI is oversold (< 35) and starts ticking up
        if abs(close - sl) / sl < 0.015 and rsi < 38:
            if rsis[i] > rsis[i-1]:
                df.loc[i, 'lux_buy'] = True
                
        # LuxAlgo Bearish Signal:
        # Price is near the swing high resistance, and RSI is overbought (> 65) and starts ticking down
        elif abs(close - sh) / sh < 0.015 and rsi > 62:
            if rsis[i] < rsis[i-1]:
                df.loc[i, 'lux_sell'] = True
                
    return df

def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Applies all indicator calculations to the DataFrame."""
    df = add_ewo(df)
    df = add_rsi(df)
    df = add_volume_analysis(df)
    df = add_fibonacci(df)
    df = add_market_structure(df)
    df = add_luxalgo_signals(df)
    return df
