import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import { calculateElliottWave } from '../utils/elliottWave';
import { calculateAllIndicatorsAndSignals } from '../utils/indicators';
import './AdvancedWaveChart.css';

const AdvancedWaveChart = ({ data }) => {
  const chartContainers = {
    price: useRef(null),
    ewo: useRef(null),
    rsi: useRef(null),
    vol: useRef(null),
  };

  const chartInstances = useRef({
    price: null,
    ewo: null,
    rsi: null,
    vol: null,
  });

  const [tooltip, setTooltip] = useState(null);
  const [stockSymbol, setStockSymbol] = useState('');
  const [chartError, setChartError] = useState(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    if (
      !chartContainers.price.current ||
      !chartContainers.ewo.current ||
      !chartContainers.rsi.current ||
      !chartContainers.vol.current
    )
      return;

    let isDisposed = false;

    try {
      setChartError(null);

      const symbol = data[0]?.symbol || 'STOCK';
      setStockSymbol(symbol);

      // Filter and enrich data for the symbol
      const symbolData = data.filter((row) => row.symbol === symbol);
      const enrichedData = calculateAllIndicatorsAndSignals(symbolData);

      // Transform data for lightweight-charts
      const formattedData = enrichedData
        .map((row) => {
          const dt = row.datetime || row.time || row.date;
          const timestamp = Math.floor(new Date(dt).getTime() / 1000);
          return {
            time: timestamp,
            open: parseFloat(row.open),
            high: parseFloat(row.high),
            low: parseFloat(row.low),
            close: parseFloat(row.close),
            volume: parseFloat(row.volume),
            ewo: row.ewo,
            rsi: row.rsi,
            volSma20: row.volSma20,
            wave_signal: row.wave_signal,
            confidence: row.confidence,
            fib50: row.fib_level_50,
            fib618: row.fib_level_618,
            fib786: row.fib_level_786,
            swingHigh: row.swing_high,
            swingLow: row.swing_low,
          };
        })
        .filter((d) => !isNaN(d.time) && !isNaN(d.open) && !isNaN(d.close))
        .sort((a, b) => a.time - b.time);

      // Deduplicate timestamps
      const seen = new Map();
      formattedData.forEach((d) => seen.set(d.time, d));
      const uniqueData = Array.from(seen.values());

      if (uniqueData.length === 0) {
        setChartError('No valid data points available.');
        return;
      }

      // Destroy old chart instances if they exist (safe check)
      Object.keys(chartInstances.current).forEach((key) => {
        if (chartInstances.current[key]) {
          try {
            chartInstances.current[key].remove();
          } catch (e) {
            // ignore if already disposed
          }
          chartInstances.current[key] = null;
        }
      });

      const containerWidth = chartContainers.price.current.clientWidth || 800;

      const commonOptions = {
        layout: {
          background: { color: '#0b0e17' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: '#1e293b' },
          horzLines: { color: '#1e293b' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.08)',
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          timeVisible: true,
        },
        width: containerWidth,
      };

      // 1. Price Chart Instance
      const chartPrice = createChart(chartContainers.price.current, {
        ...commonOptions,
        height: 380,
      });

      // 2. EWO Chart Instance
      const chartEwo = createChart(chartContainers.ewo.current, {
        ...commonOptions,
        height: 140,
        timeScale: { ...commonOptions.timeScale, visible: false },
      });

      // 3. RSI Chart Instance
      const chartRsi = createChart(chartContainers.rsi.current, {
        ...commonOptions,
        height: 140,
        timeScale: { ...commonOptions.timeScale, visible: false },
      });

      // 4. Volume Chart Instance
      const chartVol = createChart(chartContainers.vol.current, {
        ...commonOptions,
        height: 140,
        timeScale: { ...commonOptions.timeScale, visible: false },
      });

      chartInstances.current = {
        price: chartPrice,
        ewo: chartEwo,
        rsi: chartRsi,
        vol: chartVol,
      };

      // -------------------------------------------------------------
      // Add Series and Load Data
      // -------------------------------------------------------------

      // 1. Price Candlesticks
      const candleSeries = chartPrice.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
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

          if (isDisposed) return;

          // Add two new line series using v5 addSeries API on chartPrice
          yfSeries = chartPrice.addSeries(LineSeries, {
            color: '#dc2626', // Rich crimson red (darker & highly visible)
            lineWidth: 3,
            title: 'YFinance Raw'
          });

          scrSeries = chartPrice.addSeries(LineSeries, {
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
      // Draw Fibonacci Levels if present on last row
      const last = uniqueData[uniqueData.length - 1];
      if (last.swingHigh && last.swingLow) {
        const startIdx = Math.max(0, uniqueData.length - 30);
        const fibXData = uniqueData.slice(startIdx);

        const addFibLine = (val, color, name) => {
          const s = chartPrice.addSeries(LineSeries, {
            color,
            lineWidth: 1.5,
            lineStyle: 2,
            crosshairMarkerVisible: false,
          });
          s.setData(fibXData.map((d) => ({ time: d.time, value: val })));
        };

        addFibLine(last.swingHigh, '#f59e0b', 'Swing High');
        addFibLine(last.fib50, '#10b981', 'Fib 50.0%');
        addFibLine(last.fib618, '#3b82f6', 'Fib 61.8%');
        addFibLine(last.fib786, '#a855f7', 'Fib 78.6%');
        addFibLine(last.swingLow, '#ec4899', 'Swing Low');
      }

      // Draw Elliott Wave motive/corrective lines
      const waveResult = calculateElliottWave(uniqueData);
      const markers = [];

      if (waveResult) {
        const waveSeries = chartPrice.addSeries(LineSeries, {
          color: '#ec4899',
          lineWidth: 2.5,
          crosshairMarkerVisible: false,
        });
        waveSeries.setData(
          waveResult.points.map((p) => ({ time: p.time, value: p.price }))
        );

        waveResult.points.forEach((p, idx) => {
          markers.push({
            time: p.time,
            position: p.type === 'high' ? 'aboveBar' : 'belowBar',
            color: '#ec4899',
            shape: 'circle',
            text: idx <= 5 ? `${idx}` : idx === 6 ? 'A' : idx === 7 ? 'B' : 'C',
            size: 2,
          });
        });
      }

      // Add Buy / Sell signals as markers on the candle series
      uniqueData.forEach((d) => {
        if (d.wave_signal === 't1_pre') {
          markers.push({
            time: d.time,
            position: 'belowBar',
            color: '#c084fc',
            shape: 'diamond',
            text: `Pre W3`,
            size: 2,
          });
        } else if (d.wave_signal === 't2_cross') {
          markers.push({
            time: d.time,
            position: 'belowBar',
            color: '#10b981',
            shape: 'arrowUp',
            text: `Buy W3`,
            size: 2,
          });
        } else if (d.wave_signal === 't3_confirm') {
          markers.push({
            time: d.time,
            position: 'belowBar',
            color: '#047857',
            shape: 'arrowUp',
            text: `W3 Confirm`,
            size: 3,
          });
        } else if (d.wave_signal === 'w5_exhaustion') {
          markers.push({
            time: d.time,
            position: 'aboveBar',
            color: '#ef4444',
            shape: 'arrowDown',
            text: `Sell W5`,
            size: 2,
          });
        }
      });

      if (markers.length > 0) {
        const markerPlugin = createSeriesMarkers(candleSeries);
        markerPlugin.setMarkers(markers.sort((a, b) => a.time - b.time));
      }

      // 2. EWO Panel
      const ewoSeries = chartEwo.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
      });
      ewoSeries.setData(
        uniqueData.map((d) => ({
          time: d.time,
          value: d.ewo ?? 0,
          color: (d.ewo ?? 0) >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)',
        }))
      );

      const ewoSigSeries = chartEwo.addSeries(LineSeries, {
        color: '#ff9800',
        lineWidth: 1.5,
        crosshairMarkerVisible: false,
      });
      ewoSigSeries.setData(
        uniqueData
          .filter((d) => d.ewoSig !== null && d.ewoSig !== undefined)
          .map((d) => ({ time: d.time, value: d.ewoSig }))
      );

      // 3. RSI Panel
      const rsiSeries = chartRsi.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
      });
      rsiSeries.setData(
        uniqueData
          .filter((d) => d.rsi !== null)
          .map((d) => ({ time: d.time, value: d.rsi }))
      );

      // RSI boundary lines (30 / 70)
      const rsi30 = chartRsi.addSeries(LineSeries, {
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 3,
        crosshairMarkerVisible: false,
      });
      rsi30.setData(uniqueData.map((d) => ({ time: d.time, value: 30 })));

      const rsi70 = chartRsi.addSeries(LineSeries, {
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 3,
        crosshairMarkerVisible: false,
      });
      rsi70.setData(uniqueData.map((d) => ({ time: d.time, value: 70 })));

      // 4. Volume Panel
      const volSeries = chartVol.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
      });
      volSeries.setData(
        uniqueData.map((d) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }))
      );

      const volSmaSeries = chartVol.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1.5,
        crosshairMarkerVisible: false,
      });
      volSmaSeries.setData(
        uniqueData
          .filter((d) => d.volSma20 !== null)
          .map((d) => ({ time: d.time, value: d.volSma20 }))
      );

      // -------------------------------------------------------------
      // Synchronize Timescales (Scrolling / Zooming)
      // -------------------------------------------------------------
      let isSyncing = false;
      const listCharts = [chartPrice, chartEwo, chartRsi, chartVol];

      listCharts.forEach((sourceChart, idx) => {
        const targets = listCharts.filter((_, tIdx) => tIdx !== idx);
        sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncing || isDisposed) return;
          isSyncing = true;
          targets.forEach((targetChart) => {
            try {
              if (targetChart) {
                targetChart.timeScale().setVisibleLogicalRange(range);
              }
            } catch (err) {
              // ignore target disposed error
            }
          });
          isSyncing = false;
        });
      });

      // Synchronize Tooltip & Crosshairs
      chartPrice.subscribeCrosshairMove((param) => {
        if (!param || !param.time) {
          setTooltip(null);
          return;
        }

        const candlePoint = param.seriesData.get(candleSeries);
        const volPoint = param.seriesData.get(volSeries);
        const ewoPoint = param.seriesData.get(ewoSeries);
        const rsiPoint = param.seriesData.get(rsiSeries);
        const yfPoint = yfSeries ? param.seriesData.get(yfSeries) : null;
        const scrPoint = scrSeries ? param.seriesData.get(scrSeries) : null;

        if (!candlePoint) {
          setTooltip(null);
          return;
        }

        setTooltip({
          time: new Date(param.time * 1000).toLocaleDateString(),
          open: candlePoint.open,
          high: candlePoint.high,
          low: candlePoint.low,
          close: candlePoint.close,
          volume: volPoint?.value ?? 0,
          ewo: ewoPoint?.value ?? 0,
          rsi: rsiPoint?.value ?? 0,
          bullish: candlePoint.close >= candlePoint.open,
          yfValue: yfPoint?.value,
          scrValue: scrPoint?.value,
        });
      });

      // Fit charts
      chartPrice.timeScale().fitContent();

      // Window Resize Listener
      const handleResize = () => {
        if (isDisposed || !chartContainers.price.current) return;
        const w = chartContainers.price.current.clientWidth;
        listCharts.forEach((c) => {
          try {
            c.applyOptions({ width: w });
          } catch (e) {
            // ignore
          }
        });
      };
      window.addEventListener('resize', handleResize);

      return () => {
        isDisposed = true;
        window.removeEventListener('resize', handleResize);
        Object.keys(chartInstances.current).forEach((key) => {
          if (chartInstances.current[key]) {
            try {
              chartInstances.current[key].remove();
            } catch (e) {
              // ignore
            }
            chartInstances.current[key] = null;
          }
        });
      };
    } catch (err) {
      console.error(err);
      setChartError(`Failed to load multi-indicator chart: ${err.message}`);
    }
  }, [data]);

  const fmt = (val) => (val !== undefined && val !== null ? `$${parseFloat(val).toFixed(2)}` : 'N/A');
  const fmtVol = (val) => {
    if (!val) return '0';
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(2) + 'K';
    return val.toString();
  };

  if (chartError) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', color: '#ef4444', textAlign: 'center' }}>
        ⚠️ {chartError}
      </div>
    );
  }

  return (
    <div className="advanced-chart-panel glass-panel animate-fade-in">
      <div className="chart-head-details">
        <div className="details-left">
          <span className="details-symbol">{stockSymbol}</span>
          <span className="details-badge">Synced Wave Analyzer</span>
        </div>
        {tooltip ? (
          <div className="details-tooltip">
            <span>O: <strong className="val">{fmt(tooltip.open)}</strong></span>
            <span>H: <strong className="val">{fmt(tooltip.high)}</strong></span>
            <span>L: <strong className="val">{fmt(tooltip.low)}</strong></span>
            <span>C: <strong className={`val ${tooltip.bullish ? 'text-green' : 'text-red'}`}>{fmt(tooltip.close)}</strong></span>
            <span>Vol: <strong className="val">{fmtVol(tooltip.volume)}</strong></span>
            <span>EWO: <strong className="val">{tooltip.ewo.toFixed(4)}</strong></span>
            <span>RSI: <strong className="val">{tooltip.rsi.toFixed(2)}</strong></span>
            {tooltip.yfValue !== undefined && <span>YF Raw: <strong className="val" style={{color: '#dc2626'}}>{fmt(tooltip.yfValue)}</strong></span>}
            {tooltip.scrValue !== undefined && <span>Screener Adj: <strong className="val" style={{color: '#2563eb'}}>{fmt(tooltip.scrValue)}</strong></span>}
          </div>
        ) : (
          <div className="details-hint">Hover chart to explore index analytics</div>
        )}
      </div>

      <div className="synced-grid">
        <div className="pane-container">
          <div className="pane-title">Price & Elliott Waves</div>
          <div ref={chartContainers.price} />
        </div>
        <div className="pane-container">
          <div className="pane-title">Elliott Wave Oscillator (EWO)</div>
          <div ref={chartContainers.ewo} />
        </div>
        <div className="pane-container">
          <div className="pane-title">Relative Strength Index (RSI 14)</div>
          <div ref={chartContainers.rsi} />
        </div>
        <div className="pane-container">
          <div className="pane-title">Trading Volume & Volume SMA(20)</div>
          <div ref={chartContainers.vol} />
        </div>
      </div>
    </div>
  );
};

export default AdvancedWaveChart;
