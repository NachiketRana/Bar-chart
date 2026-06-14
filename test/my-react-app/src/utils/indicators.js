/**
 * indicators.js
 * Technical Analysis Indicators calculated client-side in React.
 * Upgraded to AEWO: Adaptive EWO, 6 structural gates, and 3-Tier Signal Engine.
 */

import { detectZigZag } from './elliottWave';

// Calculate Simple Moving Average (SMA)
export function calculateSMA(data, period, key = 'close') {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        // Handle array of numbers or array of objects
        const val = typeof data[j] === 'number' ? data[j] : parseFloat(data[j][key]);
        sum += isNaN(val) ? 0 : val;
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

// Calculate Exponential Moving Average (EMA)
export function calculateEMA(data, period, key = 'close') {
  const ema = [];
  if (data.length === 0) return [];

  const k = 2 / (period + 1);
  let val = typeof data[0] === 'number' ? data[0] : parseFloat(data[0][key]);
  ema.push(val);

  // Pad the first period - 1 items with null to match standard indicator length
  for (let i = 1; i < data.length; i++) {
    const cur = typeof data[i] === 'number' ? data[i] : parseFloat(data[i][key]);
    val = (cur - val) * k + val;

    if (i >= period - 1) {
      ema.push(val);
    } else {
      ema.push(null);
    }
  }
  return ema;
}

// Calculate Average True Range (ATR)
export function calculateATR(data, period = 14) {
  const atr = [];
  if (data.length === 0) return [];

  const tr = [data[0].high - data[0].low];
  for (let i = 1; i < data.length; i++) {
    const h = data[i].high;
    const l = data[i].low;
    const prevClose = data[i - 1].close;
    const val1 = h - l;
    const val2 = Math.abs(h - prevClose);
    const val3 = Math.abs(l - prevClose);
    tr.push(Math.max(val1, val2, val3));
  }

  // Calculate SMA of True Range
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      atr.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += tr[j];
      }
      atr.push(sum / period);
    }
  }
  return atr;
}

// Calculate Relative Strength Index (RSI)
export function calculateRSI(data, period = 14) {
  const rsi = [];
  if (data.length <= period) {
    return new Array(data.length).fill(null);
  }

  let gains = 0;
  let losses = 0;

  // First period calculations
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = 0; i < period; i++) {
    rsi.push(null);
  }

  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(100 - (100 / (1 + firstRS)));

  // Smooth RSI
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    let gain = 0;
    let loss = 0;
    if (diff > 0) {
      gain = diff;
    } else {
      loss = -diff;
    }

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  return rsi;
}

/**
 * Main function to enrich stock candles with indicators and early Elliott wave signals.
 */
export function calculateAllIndicatorsAndSignals(data, minPercent = 2.0) {
  if (!data || data.length === 0) return [];

  // Parse all numeric inputs upfront to float numbers
  const parsedData = data.map((d) => ({
    ...d,
    open: parseFloat(d.open),
    high: parseFloat(d.high),
    low: parseFloat(d.low),
    close: parseFloat(d.close),
    volume: parseFloat(d.volume),
  }));

  // 1. Calculate base indicator lists
  const ema5 = calculateEMA(parsedData, 5, 'close');
  const ema34 = calculateEMA(parsedData, 34, 'close');
  const volSma20 = calculateSMA(parsedData, 20, 'volume');
  const rsi = calculateRSI(parsedData, 14);
  const atr = calculateATR(parsedData, 14);
  
  // Calculate EWO as EMA(5) - EMA(34)
  const ewo = [];
  for (let i = 0; i < parsedData.length; i++) {
    if (ema5[i] !== null && ema34[i] !== null) {
      ewo.push(ema5[i] - ema34[i]);
    } else {
      ewo.push(null);
    }
  }

  // Calculate 50-period SMA of ATR for volatility check
  const atrSmaInput = atr.map((v) => (v === null ? 0 : v));
  const atrAvg = calculateSMA(atrSmaInput, 50);

  // 2. Adaptive EWO Signal Line calculation (Stage 2)
  const ewoSig = [];
  let currentSig = null;
  for (let i = 0; i < parsedData.length; i++) {
    const curEwo = ewo[i];
    if (curEwo === null) {
      ewoSig.push(null);
      continue;
    }

    if (currentSig === null) {
      currentSig = curEwo;
      ewoSig.push(currentSig);
      continue;
    }

    const atrVal = atr[i];
    const atrAvgVal = atrAvg[i];
    const isFast = (atrVal && atrAvgVal) ? (atrVal > atrAvgVal * 1.3) : false;
    const delay = isFast ? 3 : 5;
    const k = 2 / (delay + 1);

    currentSig = (curEwo - currentSig) * k + currentSig;
    ewoSig.push(currentSig);
  }

  // Calculate normalized EWO boundaries (Stage 2d)
  const thresh_lo = [];
  const thresh_hi = [];
  for (let i = 0; i < parsedData.length; i++) {
    const start = Math.max(0, i - 99);
    const windowEwo = ewo.slice(start, i + 1).filter((v) => v !== null);
    if (windowEwo.length === 0) {
      thresh_lo.push(0);
      thresh_hi.push(0);
    } else {
      const min = Math.min(...windowEwo);
      const max = Math.max(...windowEwo);
      thresh_lo.push(min * 0.20);
      thresh_hi.push(max * 0.20);
    }
  }

  // 3. Find ZigZag Pivots historically
  const pivots = detectZigZag(parsedData, minPercent);

  // Map enriched candles
  const enriched = parsedData.map((candle, idx) => {
    return {
      ...candle,
      ewo: ewo[idx],
      ewoSig: ewoSig[idx],
      rsi: rsi[idx],
      volSma20: volSma20[idx],
      wave_signal: 'neutral',
      confidence: 0.0,
      fib_level_50: null,
      fib_level_618: null,
      fib_level_786: null,
      swing_high: null,
      swing_low: null,
    };
  });

  if (pivots.length < 2) return enriched;

  // 4. Generate 3-Tier signals at each index
  for (let i = 15; i < enriched.length; i++) {
    const historicalPivots = pivots.filter((p) => p.index <= i);
    if (historicalPivots.length < 2) continue;

    const latestPivot = historicalPivots[historicalPivots.length - 1];
    const prevPivot = historicalPivots[historicalPivots.length - 2];

    const currentPrice = enriched[i].close;
    const currentVol = enriched[i].volume;
    const currentEWO = enriched[i].ewo;
    const prevEWO = enriched[i - 1].ewo;
    const prevEWO2 = enriched[i - 2].ewo;
    const currentSig = enriched[i].ewoSig;
    const prevSig = enriched[i - 1].ewoSig;
    const currentRSI = enriched[i].rsi;
    const avgVol = enriched[i].volSma20;

    // Track active swing range for Fibonacci levels
    if (latestPivot.type === 'high') {
      enriched[i].swing_high = latestPivot.price;
      enriched[i].swing_low = prevPivot.price;
    } else {
      enriched[i].swing_high = prevPivot.price;
      enriched[i].swing_low = latestPivot.price;
    }

    const sh = enriched[i].swing_high;
    const sl = enriched[i].swing_low;
    const w1Height = sh - sl;

    if (w1Height > 0) {
      enriched[i].fib_level_50 = sh - (0.50 * w1Height);
      enriched[i].fib_level_618 = sh - (0.618 * w1Height);
      enriched[i].fib_level_786 = sh - (0.786 * w1Height);
    }

    // Gap calculations
    const currentGap = currentSig - currentEWO;
    const prevGap = prevSig - prevEWO;
    const prevGap2 = (enriched[i - 2]?.ewoSig) - prevEWO2;

    // Validate structural rules for active wave detection
    const isBullishStructure = prevPivot.type === 'low' && latestPivot.type === 'high';

    if (isBullishStructure && w1Height > 0) {
      const fib50 = enriched[i].fib_level_50;
      const fib786 = enriched[i].fib_level_786;
      const isInFibZone = currentPrice <= fib50 && currentPrice >= fib786;
      const ewo_rising = currentEWO > prevEWO && prevEWO > prevEWO2;

      // ----------------------------
      // TIER 1 PRE-SIGNAL (Oversold Reversal)
      // ----------------------------
      const gap_shrink = currentGap < prevGap && prevGap < prevGap2;
      const isOversold = currentEWO < thresh_lo[i];
      if (currentEWO < 0 && ewo_rising && gap_shrink && isOversold && isInFibZone) {
        enriched[i].wave_signal = 't1_pre';
        enriched[i].confidence = 0.5;
      }

      // ----------------------------
      // TIER 2 CROSSOVER (Volume Confirmation)
      // ----------------------------
      const crossover = currentEWO > currentSig && prevEWO <= prevSig;
      const vol_ok = avgVol ? currentVol > avgVol * 1.1 : false;
      if (crossover && vol_ok && isInFibZone) {
        enriched[i].wave_signal = 't2_cross';
        enriched[i].confidence = 0.75;
      }

      // ----------------------------
      // TIER 3 CONFIRMED (Breakout)
      // ----------------------------
      const price_break = currentPrice > sh; // Break above Wave 1 Peak
      // EWO making new 50-period high
      const prevEwoValues = ewo.slice(Math.max(0, i - 50), i).filter(v => v !== null);
      const isEwoNewHigh = prevEwoValues.length > 0 ? currentEWO > Math.max(...prevEwoValues) : false;

      // If we crossed EWO recently and now price breaks out with new EWO peak
      const crossedRecently = (currentEWO > currentSig) || (enriched[i-1].wave_signal === 't2_cross') || (enriched[i-2].wave_signal === 't2_cross');
      if (crossedRecently && price_break && isEwoNewHigh) {
        enriched[i].wave_signal = 't3_confirm';
        enriched[i].confidence = 0.95;
      }
    }

    // ----------------------------
    // WAVE 5 EXHAUSTION SIGNAL (Bearish Setup)
    // ----------------------------
    if (historicalPivots.length >= 5) {
      const p0 = historicalPivots[historicalPivots.length - 5];
      const p1 = historicalPivots[historicalPivots.length - 4];
      const p2 = historicalPivots[historicalPivots.length - 3];
      const p3 = historicalPivots[historicalPivots.length - 2];
      const p4 = historicalPivots[historicalPivots.length - 1];

      const motivePartial = p0.type === 'low' && p1.type === 'high' && p2.type === 'low' && p3.type === 'high' && p4.type === 'low';

      if (motivePartial && currentPrice > p3.price) {
        let divergenceScore = 0.0;

        // RSI divergence
        const rsiW3 = rsi[p3.index];
        if (currentRSI && rsiW3 && currentRSI < rsiW3 && currentRSI > 60) {
          divergenceScore += 0.5;
        }

        // EWO divergence
        const ewoW3 = ewo[p3.index];
        if (currentEWO && ewoW3 && currentEWO < ewoW3) {
          divergenceScore += 0.5;
        }

        if (divergenceScore >= 0.5) {
          enriched[i].wave_signal = 'w5_exhaustion';
          enriched[i].confidence = divergenceScore;
        }
      }
    }
  }

  return enriched;
}
