# visualization.py
"""
Data visualization module.
Constructs premium interactive charts using Plotly for the Elliott Wave setups.
Includes subplots for price action, EWO, RSI, and Volume.
"""
import pandas as pd
import numpy as np
# pyrefly: ignore [missing-import]
import plotly.graph_objects as go
# pyrefly: ignore [missing-import]
from plotly.subplots import make_subplots

def plot_full_chart(df: pd.DataFrame, symbol: str) -> go.Figure:
    """
    Generates a premium, 4-panel interactive dark-mode dashboard chart.
    Panels:
    1. Candlestick + Swings + Fibonacci Retracements + Wave Labels + Signals
    2. Elliott Wave Oscillator (EWO) histogram
    3. Relative Strength Index (RSI) with 30/70 thresholds
    4. Volume bars + 20-period Volume SMA
    """
    # Create subplots
    fig = make_subplots(
        rows=4, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.03,
        row_heights=[0.55, 0.15, 0.15, 0.15],
        subplot_titles=(
            f"<b>{symbol} Price Action & Elliott Waves</b>",
            "<b>Elliott Wave Oscillator (EWO)</b>",
            "<b>Relative Strength Index (RSI)</b>",
            "<b>Trading Volume</b>"
        )
    )

    # Convert Datetime to string format for consistent x-axis spacing (hiding gaps)
    x_dates = df['Datetime'].dt.strftime('%Y-%m-%d %H:%M') if isinstance(df['Datetime'].iloc[0], pd.Timestamp) else df['Datetime'].astype(str)

    # 1. Price Panel: Candlesticks
    fig.add_trace(
        go.Candlestick(
            x=x_dates,
            open=df['Open'],
            high=df['High'],
            low=df['Low'],
            close=df['Close'],
            name="Candlesticks",
            increasing_line_color='#26a69a', decreasing_line_color='#ef5350',
            increasing_fillcolor='#26a69a', decreasing_fillcolor='#ef5350'
        ),
        row=1, col=1
    )

    # Draw Fibonacci Retracement horizontal lines for the latest swing range
    last_row = df.iloc[-1]
    if 'swing_high' in df.columns and not np.isnan(last_row['swing_high']) and not np.isnan(last_row['swing_low']):
        sh = last_row['swing_high']
        sl = last_row['swing_low']
        
        # Determine the start index for drawing Fib levels (usually around the recent low/high)
        # We can draw it across the last 30 periods for clarity
        start_idx = max(0, len(df) - 35)
        fib_x = x_dates.iloc[start_idx:]
        
        # Colors for Fib levels
        fib_colors = {
            'swing_high': '#ff9800',  # Orange
            'level_236': '#9c27b0',   # Purple
            'level_382': '#2196f3',   # Blue
            'level_500': '#4caf50',   # Green
            'level_618': '#ffeb3b',   # Yellow
            'level_786': '#ff5722',   # Deep Orange
            'swing_low': '#e91e63'    # Pink
        }
        
        # Add Swing lines
        fig.add_trace(go.Scatter(x=fib_x, y=[sh]*len(fib_x), mode='lines', line=dict(color=fib_colors['swing_high'], width=1.5, dash='dash'), name='Swing High (1.0)'), row=1, col=1)
        fig.add_trace(go.Scatter(x=fib_x, y=[df.loc[df.index[-1], 'level_236']]*len(fib_x), mode='lines', line=dict(color=fib_colors['level_236'], width=1), name='Fib 23.6%'), row=1, col=1)
        fig.add_trace(go.Scatter(x=fib_x, y=[df.loc[df.index[-1], 'level_382']]*len(fib_x), mode='lines', line=dict(color=fib_colors['level_382'], width=1), name='Fib 38.2%'), row=1, col=1)
        fig.add_trace(go.Scatter(x=fib_x, y=[df.loc[df.index[-1], 'level_500']]*len(fib_x), mode='lines', line=dict(color=fib_colors['level_500'], width=1.2), name='Fib 50.0%'), row=1, col=1)
        fig.add_trace(go.Scatter(x=fib_x, y=[df.loc[df.index[-1], 'level_618']]*len(fib_x), mode='lines', line=dict(color=fib_colors['level_618'], width=1.5), name='Fib 61.8% (Golden)'), row=1, col=1)
        fig.add_trace(go.Scatter(x=fib_x, y=[df.loc[df.index[-1], 'level_786']]*len(fib_x), mode='lines', line=dict(color=fib_colors['level_786'], width=1), name='Fib 78.6%'), row=1, col=1)
        fig.add_trace(go.Scatter(x=fib_x, y=[sl]*len(fib_x), mode='lines', line=dict(color=fib_colors['swing_low'], width=1.5, dash='dash'), name='Swing Low (0.0)'), row=1, col=1)

    # Add wave labels as text annotations above/below candles
    if 'wave_label' in df.columns:
        labeled_df = df.dropna(subset=['wave_label'])
        for idx, row in labeled_df.iterrows():
            lbl = row['wave_label']
            is_peak = lbl in ['1', '3', '5', 'B']
            y_val = row['High'] * 1.01 if is_peak else row['Low'] * 0.99
            pos = 'top center' if is_peak else 'bottom center'
            color = '#ffeb3b' if lbl in ['1', '2', '3', '4', '5'] else '#00e676'
            
            fig.add_trace(
                go.Scatter(
                    x=[x_dates.iloc[idx]],
                    y=[y_val],
                    mode='text+markers',
                    text=[f"<b>{lbl}</b>"],
                    textposition=pos,
                    textfont=dict(color=color, size=14),
                    marker=dict(symbol='circle', size=6, color=color),
                    showlegend=False
                ),
                row=1, col=1
            )

    # Add Buy/Sell Signals (Early Wave 3, Wave 5 Exhaustion)
    if 'wave_signal' in df.columns:
        # Early Wave 3 signals
        w3_signals = df[df['wave_signal'] == 'early_w3']
        if not w3_signals.empty:
            fig.add_trace(
                go.Scatter(
                    x=w3_signals['Datetime'].dt.strftime('%Y-%m-%d %H:%M') if isinstance(df['Datetime'].iloc[0], pd.Timestamp) else w3_signals['Datetime'].astype(str),
                    y=w3_signals['Low'] * 0.98,
                    mode='markers+text',
                    text=["▲ Buy W3"],
                    textposition="bottom center",
                    marker=dict(symbol='triangle-up', size=15, color='#00e676'),
                    textfont=dict(color='#00e676', size=11),
                    name='Early Wave 3 Buy'
                ),
                row=1, col=1
            )
            
        # Wave 5 Exhaustion signals
        w5_signals = df[df['wave_signal'] == 'w5_exhaustion']
        if not w5_signals.empty:
            fig.add_trace(
                go.Scatter(
                    x=w5_signals['Datetime'].dt.strftime('%Y-%m-%d %H:%M') if isinstance(df['Datetime'].iloc[0], pd.Timestamp) else w5_signals['Datetime'].astype(str),
                    y=w5_signals['High'] * 1.02,
                    mode='markers+text',
                    text=["▼ Sell W5"],
                    textposition="top center",
                    marker=dict(symbol='triangle-down', size=15, color='#ff1744'),
                    textfont=dict(color='#ff1744', size=11),
                    name='Wave 5 Exhaustion'
                ),
                row=1, col=1
            )

    # 2. Elliott Wave Oscillator (EWO) Panel
    if 'ewo' in df.columns:
        ewo_colors = ['#26a69a' if val >= 0 else '#ef5350' for val in df['ewo']]
        fig.add_trace(
            go.Bar(
                x=x_dates,
                y=df['ewo'],
                marker_color=ewo_colors,
                name="EWO"
            ),
            row=2, col=1
        )

    # 3. RSI Panel
    if 'rsi' in df.columns:
        fig.add_trace(
            go.Scatter(
                x=x_dates,
                y=df['rsi'],
                line=dict(color='#2196f3', width=1.5),
                name="RSI"
            ),
            row=3, col=1
        )
        # Threshold lines (30 / 70)
        fig.add_shape(type="line", x0=x_dates.iloc[0], y0=30, x1=x_dates.iloc[-1], y1=30, line=dict(color="red", width=1, dash="dash"), row=3, col=1)
        fig.add_shape(type="line", x0=x_dates.iloc[0], y0=70, x1=x_dates.iloc[-1], y1=70, line=dict(color="red", width=1, dash="dash"), row=3, col=1)

    # 4. Volume Panel
    if 'Volume' in df.columns:
        vol_colors = ['#26a69a' if df['Close'].iloc[i] >= df['Open'].iloc[i] else '#ef5350' for i in range(len(df))]
        fig.add_trace(
            go.Bar(
                x=x_dates,
                y=df['Volume'],
                marker_color=vol_colors,
                name="Volume"
            ),
            row=4, col=1
        )
        if 'vol_sma_20' in df.columns:
            fig.add_trace(
                go.Scatter(
                    x=x_dates,
                    y=df['vol_sma_20'],
                    line=dict(color='#ff9800', width=1),
                    name="Volume SMA(20)"
                ),
                row=4, col=1
            )

    # Update general layouts for dark mode aesthetic
    fig.update_layout(
        template='plotly_dark',
        height=850,
        showlegend=True,
        xaxis_rangeslider_visible=False,
        margin=dict(l=40, r=40, t=50, b=40),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )
    
    # Hide weekend gaps or non-trading hours by formatting x-axis type
    fig.update_xaxes(type='category')
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=True, gridcolor='#37474f')
    
    return fig
