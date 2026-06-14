/**
 * Elliott Wave Detection Utility
 * Uses a ZigZag pivot detector followed by rule validation.
 * Detects both the 5-Wave Impulse and the subsequent A-B-C Correction.
 */

/**
 * Detects local peaks and troughs (pivots) in the stock candlestick data.
 * Alternates between high peaks and low troughs.
 */
export function detectZigZag(data, minPercent = 2.0) {
  if (!data || data.length < 10) return [];

  const pivots = [];
  let trend = 0; // 1 = up, -1 = down
  let lastPivotPrice = data[0].close;
  let tempExtremaIndex = 0;
  let tempExtremaPrice = data[0].close;

  // Find initial direction
  for (let i = 1; i < data.length; i++) {
    const price = data[i].close;
    const diffPct = ((price - lastPivotPrice) / lastPivotPrice) * 100;

    if (Math.abs(diffPct) >= minPercent) {
      trend = diffPct > 0 ? 1 : -1;
      tempExtremaIndex = i;
      tempExtremaPrice = price;
      // Push first point
      pivots.push({
        index: 0,
        time: data[0].time,
        price: data[0].close,
        type: trend === 1 ? 'low' : 'high'
      });
      lastPivotPrice = price;
      break;
    }
  }

  if (trend === 0) return [];

  // Main loop to find alternating peaks and valleys
  for (let i = tempExtremaIndex + 1; i < data.length; i++) {
    const price = data[i].close;

    if (trend === 1) {
      // In uptrend, looking for higher peak
      if (price > tempExtremaPrice) {
        tempExtremaPrice = price;
        tempExtremaIndex = i;
      } else {
        // Check for reversal
        const dropPct = ((tempExtremaPrice - price) / tempExtremaPrice) * 100;
        if (dropPct >= minPercent) {
          pivots.push({
            index: tempExtremaIndex,
            time: data[tempExtremaIndex].time,
            price: tempExtremaPrice,
            type: 'high'
          });
          trend = -1;
          tempExtremaPrice = price;
          tempExtremaIndex = i;
        }
      }
    } else {
      // In downtrend, looking for lower trough
      if (price < tempExtremaPrice) {
        tempExtremaPrice = price;
        tempExtremaIndex = i;
      } else {
        // Check for reversal
        const risePct = ((price - tempExtremaPrice) / tempExtremaPrice) * 100;
        if (risePct >= minPercent) {
          pivots.push({
            index: tempExtremaIndex,
            time: data[tempExtremaIndex].time,
            price: tempExtremaPrice,
            type: 'low'
          });
          trend = 1;
          tempExtremaPrice = price;
          tempExtremaIndex = i;
        }
      }
    }
  }

  // Push the final point to complete the series
  pivots.push({
    index: tempExtremaIndex,
    time: data[tempExtremaIndex].time,
    price: tempExtremaPrice,
    type: trend === 1 ? 'high' : 'low'
  });

  return pivots;
}

/**
 * Checks a 6-point sequence for a Bullish 5-Wave Impulse Pattern
 */
function isValidBullishWave(p0, p1, p2, p3, p4, p5) {
  if (
    p0.type !== 'low' ||
    p1.type !== 'high' ||
    p2.type !== 'low' ||
    p3.type !== 'high' ||
    p4.type !== 'low' ||
    p5.type !== 'high'
  ) {
    return false;
  }

  if (p1.price <= p0.price) return false;
  if (p2.price >= p1.price) return false;
  if (p3.price <= p2.price) return false;
  if (p4.price >= p3.price) return false;
  if (p5.price <= p4.price) return false;

  // Rule 1: Wave 2 does not retrace below Wave 1 origin
  if (p2.price <= p0.price) return false;

  // Rule 3: Wave 3 exceeds Wave 1 peak
  if (p3.price <= p1.price) return false;

  // Rule 4: Wave 4 does not enter Wave 1 price territory (no overlap)
  if (p4.price <= p1.price) return false;

  // Rule 2: Wave 3 is not the shortest of Waves 1, 3, and 5
  const w1 = p1.price - p0.price;
  const w3 = p3.price - p2.price;
  const w5 = p5.price - p4.price;

  if (w3 < w1 && w3 < w5) return false;

  // Gate 4: Wave 2 Retracement Check (38.2% to 78.6% of W1)
  const w2_ret = (p1.price - p2.price) / w1;
  if (w2_ret < 0.382 || w2_ret > 0.786) return false;

  // Gate 5: Wave 3 Extension Check (minimum 100% of W1)
  const w3_ext = w3 / w1;
  if (w3_ext < 1.0) return false;

  return true;
}

/**
 * Checks a 6-point sequence for a Bearish 5-Wave Impulse Pattern
 */
function isValidBearishWave(p0, p1, p2, p3, p4, p5) {
  if (
    p0.type !== 'high' ||
    p1.type !== 'low' ||
    p2.type !== 'high' ||
    p3.type !== 'low' ||
    p4.type !== 'high' ||
    p5.type !== 'low'
  ) {
    return false;
  }

  if (p1.price >= p0.price) return false;
  if (p2.price <= p1.price) return false;
  if (p3.price >= p2.price) return false;
  if (p4.price <= p3.price) return false;
  if (p5.price >= p4.price) return false;

  // Rule 1: Wave 2 does not retrace below Wave 1 origin
  if (p2.price >= p0.price) return false;

  // Rule 3: Wave 3 exceeds Wave 1 valley
  if (p3.price >= p1.price) return false;

  // Rule 4: Wave 4 does not enter Wave 1 price territory (no overlap)
  if (p4.price >= p1.price) return false;

  // Rule 2: Wave 3 is not the shortest of Waves 1, 3, and 5
  const w1 = p0.price - p1.price;
  const w3 = p2.price - p3.price;
  const w5 = p4.price - p5.price;

  if (w3 < w1 && w3 < w5) return false;

  // Gate 4: Wave 2 Retracement Check (38.2% to 78.6% of W1)
  const w2_ret = (p2.price - p1.price) / w1;
  if (w2_ret < 0.382 || w2_ret > 0.786) return false;

  // Gate 5: Wave 3 Extension Check (minimum 100% of W1)
  const w3_ext = w3 / w1;
  if (w3_ext < 1.0) return false;

  return true;
}

/**
 * Validates Bullish A-B-C corrective phase
 */
function isValidBullishABC(p5, pa, pb, pc) {
  if (pa.type !== 'low' || pb.type !== 'high' || pc.type !== 'low') return false;
  if (pa.price >= p5.price) return false;
  if (pb.price <= pa.price || pb.price >= p5.price) return false;
  if (pc.price >= pb.price) return false;
  return true;
}

/**
 * Validates Bearish A-B-C corrective phase
 */
function isValidBearishABC(p5, pa, pb, pc) {
  if (pa.type !== 'high' || pb.type !== 'low' || pc.type !== 'high') return false;
  if (pa.price <= p5.price) return false;
  if (pb.price >= pa.price || pb.price <= p5.price) return false;
  if (pc.price <= pb.price) return false;
  return true;
}

/**
 * Finds the latest valid Elliott wave pattern.
 * Prioritizes a full 9-point cycle (5 + ABC).
 * Falls back to a 6-point motive wave (0-5) if ABC isn't fully formed.
 */
export function findLatestElliottWave(pivots) {
  if (pivots.length < 6) return null;

  // 1. Try to find a full 9-point cycle (0-5 + A-B-C) first
  if (pivots.length >= 9) {
    for (let i = pivots.length - 9; i >= 0; i--) {
      const p0 = pivots[i];
      const p1 = pivots[i + 1];
      const p2 = pivots[i + 2];
      const p3 = pivots[i + 3];
      const p4 = pivots[i + 4];
      const p5 = pivots[i + 5];
      const pa = pivots[i + 6];
      const pb = pivots[i + 7];
      const pc = pivots[i + 8];

      if (isValidBullishWave(p0, p1, p2, p3, p4, p5) && isValidBullishABC(p5, pa, pb, pc)) {
        return {
          type: 'Bullish Cycle (5 + ABC)',
          points: [p0, p1, p2, p3, p4, p5, pa, pb, pc]
        };
      }

      if (isValidBearishWave(p0, p1, p2, p3, p4, p5) && isValidBearishABC(p5, pa, pb, pc)) {
        return {
          type: 'Bearish Cycle (5 + ABC)',
          points: [p0, p1, p2, p3, p4, p5, pa, pb, pc]
        };
      }
    }
  }

  // 2. Fall back to just the 6-point motive wave (0-5)
  for (let i = pivots.length - 6; i >= 0; i--) {
    const p0 = pivots[i];
    const p1 = pivots[i + 1];
    const p2 = pivots[i + 2];
    const p3 = pivots[i + 3];
    const p4 = pivots[i + 4];
    const p5 = pivots[i + 5];

    if (isValidBullishWave(p0, p1, p2, p3, p4, p5)) {
      return {
        type: 'Bullish Impulse (0-5)',
        points: [p0, p1, p2, p3, p4, p5]
      };
    }

    if (isValidBearishWave(p0, p1, p2, p3, p4, p5)) {
      return {
        type: 'Bearish Impulse (0-5)',
        points: [p0, p1, p2, p3, p4, p5]
      };
    }
  }

  return null;
}

/**
 * Master function to detect Elliott Wave in candle data.
 * Tries multiple deviation percentages to find a wave sequence.
 */
export function calculateElliottWave(data) {
  const thresholds = [2.0, 1.5, 2.5, 3.0, 1.0, 4.0, 5.0];

  for (const thresh of thresholds) {
    const pivots = detectZigZag(data, thresh);
    const wave = findLatestElliottWave(pivots);
    if (wave) {
      return wave;
    }
  }

  return null;
}
