import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import './CandlestickChart.css';
import { calculateElliottWave } from '../utils/elliottWave';

const CandlestickChart = ({ data }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [stockSymbol, setStockSymbol] = useState('');
  const [chartError, setChartError] = useState(null);
  
  // Indicator states
  const [showEMA, setShowEMA] = useState(false);
  const [showSMA, setShowSMA] = useState(false);
  const [showElliottWave, setShowElliottWave] = useState(false);
  const [detectedWaveType, setDetectedWaveType] = useState(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    if (!chartContainerRef.current) return;

    let isCancelled = false;
    try {
      setChartError(null);
      setDetectedWaveType(null);

      // Get the first symbol from data
      const symbol = data[0]?.symbol || 'STOCK';
      setStockSymbol(symbol);

      // Filter data for that symbol
      const symbolData = data.filter(row => row.symbol === symbol);

      // Transform and sort for lightweight-charts (Unix seconds timestamps)
      const candleData = symbolData
        .map(row => {
          const dt = row.datetime || row.time || row.date;
          const timestamp = Math.floor(new Date(dt).getTime() / 1000);
          return {
            time: timestamp,
            open: parseFloat(row.open),
            high: parseFloat(row.high),
            low: parseFloat(row.low),
            close: parseFloat(row.close),
            volume: parseFloat(row.volume),
            sma50: row.sma50,
            ema20: row.ema20
          };
        })
        .filter(d => !isNaN(d.time) && !isNaN(d.open) && !isNaN(d.close))
        .sort((a, b) => a.time - b.time);

      // Deduplicate timestamps — keep last occurrence
      const seen = new Map();
      candleData.forEach(d => seen.set(d.time, d));
      const uniqueData = Array.from(seen.values());

      if (uniqueData.length === 0) {
        setChartError('No valid candle data to display.');
        return;
      }

      // Destroy old chart instance
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const containerWidth = chartContainerRef.current.clientWidth || 800;

      // Create chart — v5 API
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: '#0d1117' },
          textColor: '#c9d1d9',
        },
        grid: {
          vertLines: { color: '#1c2128' },
          horzLines: { color: '#1c2128' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: '#30363d',
        },
        timeScale: {
          borderColor: '#30363d',
          timeVisible: true,
          secondsVisible: false,
        },
        width: containerWidth,
        height: 420,
      });

      chartRef.current = chart;

      // v5: addSeries(SeriesType, options)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a641',
        downColor: '#f85149',
        borderUpColor: '#26a641',
        borderDownColor: '#f85149',
        wickUpColor: '#26a641',
        wickDownColor: '#f85149',
      });
      candleSeries.setData(uniqueData);

      // === START OF VEDANTA ANOMALY TEST SNIPPET ===
      let yfSeries = null;
      let scrSeries = null;

      const loadAnomalyTestData = async () => {
        try {
          const response = await fetch(`/${symbol}_corrected.csv`);
          if (!response.ok) {
            // Quietly return if there is no anomaly CSV file uploaded for this symbol
            return;
          }
          const text = await response.text();

          // Parse CSV rows
          const lines = text.split(/\r?\n/);
          if (lines.length < 2) return;

          // Detect header index mapping
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const dateIdx = headers.indexOf('date');
          
          let yfIdx = headers.indexOf('yfinance_raw');
          if (yfIdx === -1) yfIdx = headers.indexOf('yahoo_close');
          
          let scrIdx = headers.indexOf('screener_adj');
          if (scrIdx === -1) scrIdx = headers.indexOf('corrected_close');
          if (scrIdx === -1) scrIdx = headers.indexOf('estimated_screener');

          if (dateIdx === -1 || yfIdx === -1 || scrIdx === -1) {
            console.warn(`CSV for ${symbol} is missing required headers`);
            return;
          }

          const yfinanceData = [];
          const screenerData = [];

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length <= Math.max(dateIdx, yfIdx, scrIdx)) continue;

            const dateStr = parts[dateIdx].trim();
            const yfVal = parseFloat(parts[yfIdx].trim());
            const scrVal = parseFloat(parts[scrIdx].trim());

             if (dateStr) {
               const timeValue = Math.floor(new Date(dateStr).getTime() / 1000);
               
               if (!isNaN(yfVal)) {
                 yfinanceData.push({ time: timeValue, value: yfVal });
               }
               if (!isNaN(scrVal)) {
                 screenerData.push({ time: timeValue, value: scrVal });
               }
             }
          }

          // Sort data chronologically
          yfinanceData.sort((a, b) => a.time - b.time);
          screenerData.sort((a, b) => a.time - b.time);

          if (isCancelled) return;

          // Add two new line series using v5 addSeries API on chart
          yfSeries = chart.addSeries(LineSeries, {
            color: '#dc2626', // Rich crimson red (darker & highly visible)
            lineWidth: 3,
            title: 'YFinance Raw'
          });

          scrSeries = chart.addSeries(LineSeries, {
            color: '#2563eb', // Rich royal blue (darker & highly visible)
            lineWidth: 3,
            title: 'Screener Adj'
          });

          yfSeries.setData(yfinanceData);
          scrSeries.setData(screenerData);

        } catch (error) {
          console.warn(`Could not load anomaly CSV for ${symbol}:`, error.message);
        }
      };

      loadAnomalyTestData();
      // === END OF VEDANTA ANOMALY TEST SNIPPET ===

      let emaSeries = null;
      let smaSeries = null;
      let waveSeries = null;

      if (showEMA) {
        emaSeries = chart.addSeries(LineSeries, {
          color: '#ff9800',
          lineWidth: 2,
          crosshairMarkerVisible: false,
        });
        const emaData = uniqueData
          .filter(d => d.ema20 !== null && d.ema20 !== undefined)
          .map(d => ({ time: d.time, value: d.ema20 }));
        emaSeries.setData(emaData);
      }

      if (showSMA) {
        smaSeries = chart.addSeries(LineSeries, {
          color: '#2196f3',
          lineWidth: 2,
          crosshairMarkerVisible: false,
        });
        const smaData = uniqueData
          .filter(d => d.sma50 !== null && d.sma50 !== undefined)
          .map(d => ({ time: d.time, value: d.sma50 }));
        smaSeries.setData(smaData);
      }

      if (showElliottWave) {
        const waveResult = calculateElliottWave(uniqueData);
        if (waveResult) {
          setDetectedWaveType(waveResult.type);
          waveSeries = chart.addSeries(LineSeries, {
            color: '#e91e63',
            lineWidth: 3,
            crosshairMarkerVisible: false,
          });
          const waveData = waveResult.points.map(p => ({
            time: p.time,
            value: p.price,
          }));
          waveSeries.setData(waveData);

          // Add numeric markers on top of the wave vertices (0-5, then A, B, C)
          const markersPlugin = createSeriesMarkers(waveSeries);
          markersPlugin.setMarkers(
            waveResult.points.map((p, index) => ({
              time: p.time,
              position: p.type === 'high' ? 'aboveBar' : 'belowBar',
              color: '#e91e63',
              shape: 'circle',
              text: index <= 5 ? `${index}` : index === 6 ? 'A' : index === 7 ? 'B' : 'C',
              size: 2,
            }))
          );
        } else {
          setDetectedWaveType('None Detected');
        }
      }

      // Volume histogram
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#388bfd',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(
        uniqueData.map(d => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? '#26a64155' : '#f8514955',
        }))
      );

      // Crosshair tooltip
      chart.subscribeCrosshairMove(param => {
        if (!param || !param.time) {
          setTooltip(null);
          return;
        }
        const candlePoint = param.seriesData.get(candleSeries);
        const volPoint = param.seriesData.get(volumeSeries);
        const emaPoint = emaSeries ? param.seriesData.get(emaSeries) : null;
        const smaPoint = smaSeries ? param.seriesData.get(smaSeries) : null;
        const yfPoint = yfSeries ? param.seriesData.get(yfSeries) : null;
        const scrPoint = scrSeries ? param.seriesData.get(scrSeries) : null;

        if (!candlePoint) {
          setTooltip(null);
          return;
        }
        setTooltip({
          time: new Date(param.time * 1000).toLocaleString(),
          open: candlePoint.open,
          high: candlePoint.high,
          low: candlePoint.low,
          close: candlePoint.close,
          volume: volPoint?.value ?? 0,
          bullish: candlePoint.close >= candlePoint.open,
          ema20: emaPoint?.value,
          sma50: smaPoint?.value,
          yfValue: yfPoint?.value,
          scrValue: scrPoint?.value,
        });
      });

      chart.timeScale().fitContent();

      // Responsive resize
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        isCancelled = true;
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    } catch (err) {
      console.error('Chart error:', err);
      setChartError(`Chart failed to load: ${err.message}`);
    }
  }, [data, showEMA, showSMA, showElliottWave]);

  const fmt = (n) =>
    n !== undefined && n !== null ? `$${parseFloat(n).toFixed(2)}` : 'N/A';

  const fmtVol = (v) => {
    if (!v && v !== 0) return 'N/A';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
    if (v >= 1_000) return (v / 1_000).toFixed(2) + 'K';
    return v.toString();
  };

  if (!data || data.length === 0) return null;

  if (chartError) {
    return (
      <div className="chart-panel glass-panel">
        <p style={{ color: '#f85149', padding: '1rem' }}>⚠️ {chartError}</p>
      </div>
    );
  }

  return (
    <div className="chart-panel glass-panel animate-fade-in">
      <div className="chart-header">
        <div className="chart-title">
          <span className="symbol-badge-large">{stockSymbol}</span>
          <span className="chart-label">Candlestick Chart</span>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowEMA(!showEMA)}
              style={{
                background: showEMA ? '#ff9800' : 'transparent',
                color: showEMA ? '#fff' : '#ff9800',
                border: '1px solid #ff9800',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
            >
              EMA 20
            </button>
            <button
              onClick={() => setShowSMA(!showSMA)}
              style={{
                background: showSMA ? '#2196f3' : 'transparent',
                color: showSMA ? '#fff' : '#2196f3',
                border: '1px solid #2196f3',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
            >
              SMA 50
            </button>
            <button
              onClick={() => setShowElliottWave(!showElliottWave)}
              style={{
                background: showElliottWave ? '#e91e63' : 'transparent',
                color: showElliottWave ? '#fff' : '#e91e63',
                border: '1px solid #e91e63',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
            >
              Elliott Wave
            </button>
            {showElliottWave && detectedWaveType && (
              <span style={{
                fontSize: '0.75rem',
                background: detectedWaveType.includes('None') ? '#21262d' : '#e91e6322',
                color: detectedWaveType.includes('None') ? '#8b949e' : '#e91e63',
                border: `1px solid ${detectedWaveType.includes('None') ? '#30363d' : '#e91e6344'}`,
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center'
              }}>
                Pattern: {detectedWaveType}
              </span>
            )}
          </div>
        </div>
        {tooltip ? (
          <div className={`ohlcv-tooltip ${tooltip.bullish ? 'bullish' : 'bearish'}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span className="tooltip-time">{tooltip.time}</span>
            <span>O: <strong>{fmt(tooltip.open)}</strong></span>
            <span>H: <strong>{fmt(tooltip.high)}</strong></span>
            <span>L: <strong>{fmt(tooltip.low)}</strong></span>
            <span>C: <strong className={tooltip.bullish ? 'text-up' : 'text-down'}>{fmt(tooltip.close)}</strong></span>
            <span>Vol: <strong>{fmtVol(tooltip.volume)}</strong></span>
            {tooltip.ema20 && <span style={{color: '#ff9800'}}>EMA20: <strong>{fmt(tooltip.ema20)}</strong></span>}
            {tooltip.sma50 && <span style={{color: '#2196f3'}}>SMA50: <strong>{fmt(tooltip.sma50)}</strong></span>}
            {tooltip.yfValue !== undefined && <span style={{color: '#dc2626'}}>YF Raw: <strong>{fmt(tooltip.yfValue)}</strong></span>}
            {tooltip.scrValue !== undefined && <span style={{color: '#2563eb'}}>Screener Adj: <strong>{fmt(tooltip.scrValue)}</strong></span>}
          </div>
        ) : (
          <span className="tooltip-hint">Hover over the chart to see OHLCV data</span>
        )}
      </div>
      <div ref={chartContainerRef} className="chart-container" />
    </div>
  );
};

export default CandlestickChart;
