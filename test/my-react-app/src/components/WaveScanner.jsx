import React, { useMemo } from 'react';
import { calculateAllIndicatorsAndSignals } from '../utils/indicators';
import { calculateElliottWave } from '../utils/elliottWave';
import './WaveScanner.css';

const WaveScanner = ({ allStocksData, selectedSymbol, onSelectSymbol }) => {
  // Scan all stocks in memory
  const scanResults = useMemo(() => {
    const results = [];
    
    Object.keys(allStocksData).forEach((symbol) => {
      const data = allStocksData[symbol];
      if (!data || data.length < 30) return;

      // Calculate indicators
      const enriched = calculateAllIndicatorsAndSignals(data);
      if (enriched.length === 0) return;

      const lastRow = enriched[enriched.length - 1];

      // Find historical labels count
      const waveResult = calculateElliottWave(enriched);
      let latestLabel = 'None';
      if (waveResult && waveResult.points.length > 0) {
        // Find latest point before index of last row
        const pts = waveResult.points;
        const labels = pts.map((p, idx) => ({
          idx: p.index,
          lbl: idx <= 5 ? `${idx}` : idx === 6 ? 'A' : idx === 7 ? 'B' : 'C'
        }));
        // Sort descending
        labels.sort((a, b) => b.idx - a.idx);
        if (labels.length > 0) {
          latestLabel = labels[0].lbl;
        }
      }

      // Search from the end for the latest active signal (lookback of 6 candles)
      let activeSignal = 'neutral';
      let confidence = 0.0;
      let signalOffset = 0; // 0 = current candle, 1 = 1 candle ago, etc.
      
      for (let offset = 0; offset < 6; offset++) {
        const idx = enriched.length - 1 - offset;
        if (idx < 0) break;
        const row = enriched[idx];
        if (row.wave_signal && row.wave_signal !== 'neutral') {
          activeSignal = row.wave_signal;
          confidence = row.confidence;
          signalOffset = offset;
          break;
        }
      }

      results.push({
        symbol,
        price: parseFloat(lastRow.close),
        signal: activeSignal,
        confidence: confidence,
        signalOffset: signalOffset,
        rsi: lastRow.rsi,
        ewo: lastRow.ewo,
        latestLabel,
        volume: lastRow.volume,
        candleCount: data.length
      });
    });

    // Sort to place signals on top
    return results.sort((a, b) => {
      const order = { t3_confirm: 0, t2_cross: 1, t1_pre: 2, w5_exhaustion: 3, neutral: 4 };
      const orderA = order[a.signal] !== undefined ? order[a.signal] : 4;
      const orderB = order[b.signal] !== undefined ? order[b.signal] : 4;
      if (orderA !== orderB) return orderA - orderB;
      return b.confidence - a.confidence;
    });
  }, [allStocksData]);

  const activeSignalsCount = useMemo(() => {
    return scanResults.filter(r => r.signal !== 'neutral').length;
  }, [scanResults]);

  const fmt = (val, symbol) => {
    if (val === undefined || val === null) return 'N/A';
    const isIndian = symbol && (symbol.toUpperCase().endsWith('.NS') || symbol.toUpperCase().endsWith('.BO'));
    return new Intl.NumberFormat(isIndian ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: isIndian ? 'INR' : 'USD',
      minimumFractionDigits: 2
    }).format(val);
  };
  const fmtVol = (val) => {
    if (!val) return '0';
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(2) + 'K';
    return val.toString();
  };

  return (
    <div className="wave-scanner-panel glass-panel animate-fade-in">
      <div className="scanner-header">
        <div>
          <h2>🔍 Nifty 50 & Global Wave Scanner</h2>
          <p className="scanner-subtitle">Scanning seeded stock assets for immediate Elliott Wave setups</p>
        </div>
        <div className="active-badge">
          <span className="pulse-dot"></span>
          {activeSignalsCount} Active Signals
        </div>
      </div>

      <div className="scanner-table-container">
        <table className="scanner-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Current Price</th>
              <th>Wave Setup Signal</th>
              <th>Confidence</th>
              <th>Latest Wave Label</th>
              <th>RSI (14)</th>
              <th>EWO</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            {scanResults.map((row) => {
              const isSelected = row.symbol === selectedSymbol;
              
              return (
                <tr 
                  key={row.symbol} 
                  className={`scanner-row ${isSelected ? 'row-selected' : ''}`}
                  onClick={() => onSelectSymbol(row.symbol)}
                >
                  <td className="cell-symbol">
                    <strong>{row.symbol}</strong>
                  </td>
                  <td className="cell-price">{fmt(row.price, row.symbol)}</td>
                  <td>
                    {row.signal === 't1_pre' && (
                      <span className="badge-signal badge-t1">🟣 T1 Pre-Signal {row.signalOffset > 0 && `(${row.signalOffset} bars ago)`}</span>
                    )}
                    {row.signal === 't2_cross' && (
                      <span className="badge-signal badge-t2">🟢 T2 Crossover {row.signalOffset > 0 && `(${row.signalOffset} bars ago)`}</span>
                    )}
                    {row.signal === 't3_confirm' && (
                      <span className="badge-signal badge-t3">🔥 T3 Confirmed {row.signalOffset > 0 && `(${row.signalOffset} bars ago)`}</span>
                    )}
                    {row.signal === 'w5_exhaustion' && (
                      <span className="badge-signal badge-sell">⚠️ SELL: Wave 5 {row.signalOffset > 0 && `(${row.signalOffset} bars ago)`}</span>
                    )}
                    {row.signal === 'neutral' && (
                      <span className="badge-signal badge-neutral">Neutral</span>
                    )}
                  </td>
                  <td>
                    {row.signal !== 'neutral' ? (
                      <div className="confidence-wrapper">
                        <span className="confidence-text">{Math.round(row.confidence * 100)}%</span>
                        <div className="progress-bar-bg">
                          <div 
                            className={`progress-bar-fill ${
                              row.signal === 'w5_exhaustion' ? 'fill-sell' : 
                              row.signal === 't3_confirm' ? 'fill-t3' :
                              row.signal === 't2_cross' ? 'fill-t2' : 'fill-t1'
                            }`}
                            style={{ width: `${row.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="neutral-text">-</span>
                    )}
                  </td>
                  <td>
                    <span className="cell-label-badge">{row.latestLabel}</span>
                  </td>
                  <td className="cell-rsi">
                    {row.rsi ? (
                      <span className={row.rsi > 70 || row.rsi < 30 ? 'text-warn' : ''}>
                        {row.rsi.toFixed(2)}
                      </span>
                    ) : 'N/A'}
                  </td>
                  <td className="cell-ewo">
                    {row.ewo ? (
                      <span className={row.ewo >= 0 ? 'text-up' : 'text-down'}>
                        {row.ewo.toFixed(4)}
                      </span>
                    ) : 'N/A'}
                  </td>
                  <td className="cell-volume">{fmtVol(row.volume)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WaveScanner;
