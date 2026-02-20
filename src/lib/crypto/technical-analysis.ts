/**
 * Technical Analysis Module
 * Implements RSI, MACD, Bollinger Bands, Moving Averages, Support/Resistance
 */

import type {
  CandleData,
  TechnicalIndicators,
  SupportResistanceLevels,
  PriceLevel,
} from './types';

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }

  return result;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA value is SMA
  let ema: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // First EMA = SMA
      ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(ema);
    } else {
      // EMA = (Close - previous EMA) * multiplier + previous EMA
      ema = (data[i] - (ema as number)) * multiplier + (ema as number);
      result.push(ema);
    }
  }

  return result;
}

/**
 * Calculate Standard Deviation
 */
export function calculateStdDev(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const squaredDiffs = slice.map(value => Math.pow(value - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      result.push(Math.sqrt(variance));
    }
  }

  return result;
}

// ==================== RSI (Relative Strength Index) ====================

/**
 * Calculate RSI
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 */
export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate gains and losses
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
    } else if (i === period) {
      // First RSI calculation using SMA
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    } else {
      // Subsequent calculations using EMA-like smoothing
      const prevRSI = result[i - 1] as number;
      const prevAvgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const prevAvgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

      const currentGain = gains[i - 1];
      const currentLoss = losses[i - 1];

      const avgGain = (prevAvgGain * (period - 1) + currentGain) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + currentLoss) / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    }
  }

  return result;
}

/**
 * Get RSI signal
 */
export function getRSISignal(rsi: number): { signal: string; strength: number } {
  if (rsi <= 20) return { signal: 'STRONG_OVERSOLD', strength: 5 };
  if (rsi <= 30) return { signal: 'OVERSOLD', strength: 4 };
  if (rsi <= 40) return { signal: 'SLIGHTLY_OVERSOLD', strength: 2 };
  if (rsi >= 80) return { signal: 'STRONG_OVERBOUGHT', strength: -5 };
  if (rsi >= 70) return { signal: 'OVERBOUGHT', strength: -4 };
  if (rsi >= 60) return { signal: 'SLIGHTLY_OVERBOUGHT', strength: -2 };
  return { signal: 'NEUTRAL', strength: 0 };
}

// ==================== MACD (Moving Average Convergence Divergence) ====================

/**
 * Calculate MACD
 * MACD = EMA(12) - EMA(26)
 * Signal = EMA(MACD, 9)
 * Histogram = MACD - Signal
 */
export function calculateMACD(closes: number[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLine: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] === null || ema26[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(ema12[i]! - ema26[i]!);
    }
  }

  // Calculate signal line (9-period EMA of MACD)
  const validMacd = macdLine.map(v => v ?? 0);
  const signalLine = calculateEMA(validMacd, 9);

  // Calculate histogram
  const histogram: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macdLine[i]! - signalLine[i]!);
    }
  }

  return {
    macd: macdLine,
    signal: signalLine,
    histogram,
  };
}

/**
 * Get MACD signal
 */
export function getMACDSignal(
  macd: number | null,
  signal: number | null,
  histogram: number | null,
  prevHistogram: number | null
): { signal: string; strength: number } {
  if (macd === null || signal === null || histogram === null) {
    return { signal: 'NEUTRAL', strength: 0 };
  }

  // Bullish crossover
  if (prevHistogram !== null && histogram > 0 && prevHistogram <= 0) {
    return { signal: 'BULLISH_CROSSOVER', strength: 4 };
  }

  // Bearish crossover
  if (prevHistogram !== null && histogram < 0 && prevHistogram >= 0) {
    return { signal: 'BEARISH_CROSSOVER', strength: -4 };
  }

  // Histogram direction
  if (histogram > 0) {
    return { signal: 'BULLISH', strength: histogram > 0.5 ? 2 : 1 };
  } else {
    return { signal: 'BEARISH', strength: histogram < -0.5 ? -2 : -1 };
  }
}

// ==================== BOLLINGER BANDS ====================

/**
 * Calculate Bollinger Bands
 * Middle = SMA(20)
 * Upper = Middle + (2 * StdDev)
 * Lower = Middle - (2 * StdDev)
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
  width: (number | null)[];
} {
  const middle = calculateSMA(closes, period);
  const stdDev = calculateStdDev(closes, period);

  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const width: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null || stdDev[i] === null) {
      upper.push(null);
      lower.push(null);
      width.push(null);
    } else {
      const upperBand = middle[i]! + (stdDevMultiplier * stdDev[i]!);
      const lowerBand = middle[i]! - (stdDevMultiplier * stdDev[i]!);

      upper.push(upperBand);
      lower.push(lowerBand);

      // Band width (normalized)
      if (middle[i] !== 0) {
        width.push((upperBand - lowerBand) / middle[i]!);
      } else {
        width.push(null);
      }
    }
  }

  return { upper, middle, lower, width };
}

/**
 * Get Bollinger Band signal
 */
export function getBollingerSignal(
  price: number,
  upper: number | null,
  middle: number | null,
  lower: number | null
): { signal: string; strength: number; position: number } {
  if (upper === null || middle === null || lower === null) {
    return { signal: 'NEUTRAL', strength: 0, position: 0.5 };
  }

  // Calculate %B (position within bands)
  const percentB = (price - lower) / (upper - lower);

  if (price > upper) {
    return { signal: 'ABOVE_UPPER', strength: -3, position: percentB };
  }
  if (price < lower) {
    return { signal: 'BELOW_LOWER', strength: 3, position: percentB };
  }
  if (price > middle) {
    return { signal: 'UPPER_HALF', strength: 1, position: percentB };
  }
  return { signal: 'LOWER_HALF', strength: -1, position: percentB };
}

// ==================== SUPPORT & RESISTANCE ====================

/**
 * Find pivot points
 */
export function calculatePivotPoints(
  high: number,
  low: number,
  close: number
): {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
} {
  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);
  const r3 = high + 2 * (pivot - low);
  const s3 = low - 2 * (high - pivot);

  return { pivot, r1, r2, r3, s1, s2, s3 };
}

/**
 * Find support and resistance levels from price history
 */
export function findSupportResistance(
  candles: CandleData[],
  lookback: number = 100,
  threshold: number = 0.02
): SupportResistanceLevels {
  if (candles.length < 10) {
    return {
      supports: [],
      resistances: [],
      pivotPoint: candles[candles.length - 1]?.close || 0,
    };
  }

  const recentCandles = candles.slice(-lookback);
  const levels: PriceLevel[] = [];

  // Find local highs and lows
  for (let i = 2; i < recentCandles.length - 2; i++) {
    const candle = recentCandles[i];
    const prev1 = recentCandles[i - 1];
    const prev2 = recentCandles[i - 2];
    const next1 = recentCandles[i + 1];
    const next2 = recentCandles[i + 2];

    // Local high (resistance)
    if (
      candle.high > prev1.high &&
      candle.high > prev2.high &&
      candle.high > next1.high &&
      candle.high > next2.high
    ) {
      levels.push({
        price: candle.high,
        type: 'resistance',
        strength: 1,
        touches: 1,
        lastTouch: candle.timestamp,
      });
    }

    // Local low (support)
    if (
      candle.low < prev1.low &&
      candle.low < prev2.low &&
      candle.low < next1.low &&
      candle.low < next2.low
    ) {
      levels.push({
        price: candle.low,
        type: 'support',
        strength: 1,
        touches: 1,
        lastTouch: candle.timestamp,
      });
    }
  }

  // Merge nearby levels
  const mergedLevels: PriceLevel[] = [];
  const sortedLevels = [...levels].sort((a, b) => a.price - b.price);

  for (const level of sortedLevels) {
    const nearby = mergedLevels.find(
      l => l.type === level.type && Math.abs(l.price - level.price) / level.price < threshold
    );

    if (nearby) {
      nearby.price = (nearby.price * nearby.touches + level.price) / (nearby.touches + 1);
      nearby.touches++;
      nearby.strength = Math.min(5, nearby.touches);
    } else {
      mergedLevels.push({ ...level });
    }
  }

  // Calculate pivot point
  const lastCandle = candles[candles.length - 1];
  const pivotData = calculatePivotPoints(
    recentCandles[recentCandles.length - 1].high,
    recentCandles[recentCandles.length - 1].low,
    recentCandles[recentCandles.length - 1].close
  );

  return {
    supports: mergedLevels.filter(l => l.type === 'support').sort((a, b) => b.price - a.price),
    resistances: mergedLevels.filter(l => l.type === 'resistance').sort((a, b) => a.price - b.price),
    pivotPoint: pivotData.pivot,
  };
}

/**
 * Get nearest support and resistance
 */
export function getNearestLevels(
  currentPrice: number,
  levels: SupportResistanceLevels
): {
  nearestSupport: PriceLevel | null;
  nearestResistance: PriceLevel | null;
  distanceToSupport: number;
  distanceToResistance: number;
} {
  const nearestSupport = levels.supports.find(s => s.price < currentPrice) || null;
  const nearestResistance = levels.resistances.find(r => r.price > currentPrice) || null;

  return {
    nearestSupport,
    nearestResistance,
    distanceToSupport: nearestSupport
      ? ((currentPrice - nearestSupport.price) / currentPrice) * 100
      : 100,
    distanceToResistance: nearestResistance
      ? ((nearestResistance.price - currentPrice) / currentPrice) * 100
      : 100,
  };
}

// ==================== VOLUME ANALYSIS ====================

/**
 * Calculate volume metrics
 */
export function analyzeVolume(
  volumes: number[],
  period: number = 20
): {
  sma: (number | null)[];
  ratio: (number | null)[];
} {
  const sma = calculateSMA(volumes, period);
  const ratio: (number | null)[] = [];

  for (let i = 0; i < volumes.length; i++) {
    if (sma[i] === null || sma[i] === 0) {
      ratio.push(null);
    } else {
      ratio.push(volumes[i] / sma[i]!);
    }
  }

  return { sma, ratio };
}

/**
 * Get volume signal
 */
export function getVolumeSignal(
  volumeRatio: number | null,
  priceChange: number
): { signal: string; strength: number } {
  if (volumeRatio === null) {
    return { signal: 'NEUTRAL', strength: 0 };
  }

  // High volume with price increase = bullish
  if (volumeRatio > 2 && priceChange > 0) {
    return { signal: 'HIGH_VOLUME_BULLISH', strength: 3 };
  }

  // High volume with price decrease = bearish
  if (volumeRatio > 2 && priceChange < 0) {
    return { signal: 'HIGH_VOLUME_BEARISH', strength: -3 };
  }

  // Low volume = weak move
  if (volumeRatio < 0.5) {
    return { signal: 'LOW_VOLUME', strength: 0 };
  }

  return { signal: 'NORMAL', strength: 0 };
}

// ==================== COMPREHENSIVE ANALYSIS ====================

/**
 * Perform complete technical analysis
 */
export function performTechnicalAnalysis(candles: CandleData[]): TechnicalIndicators {
  if (candles.length < 200) {
    console.warn('Not enough candles for full analysis (need at least 200)');
  }

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const lastCandle = candles[candles.length - 1];

  // Calculate all indicators
  const rsiArray = calculateRSI(closes, 14);
  const rsi = rsiArray[rsiArray.length - 1];

  const macdResult = calculateMACD(closes);
  const macd = macdResult.macd[macdResult.macd.length - 1];
  const macdSignal = macdResult.signal[macdResult.signal.length - 1];
  const macdHistogram = macdResult.histogram[macdResult.histogram.length - 1];
  const prevHistogram = macdResult.histogram[macdResult.histogram.length - 2];

  const bollinger = calculateBollingerBands(closes, 20, 2);
  const bollingerUpper = bollinger.upper[bollinger.upper.length - 1];
  const bollingerMiddle = bollinger.middle[bollinger.middle.length - 1];
  const bollingerLower = bollinger.lower[bollinger.lower.length - 1];
  const bollingerWidth = bollinger.width[bollinger.width.length - 1];

  const sma20 = calculateSMA(closes, 20)[closes.length - 1];
  const sma50 = calculateSMA(closes, 50)[closes.length - 1];
  const sma200 = calculateSMA(closes, 200)[closes.length - 1];
  const ema20 = calculateEMA(closes, 20)[closes.length - 1];
  const ema50 = calculateEMA(closes, 50)[closes.length - 1];
  const ema200 = calculateEMA(closes, 200)[closes.length - 1];

  const volumeAnalysis = analyzeVolume(volumes, 20);
  const volumeSma20 = volumeAnalysis.sma[volumeAnalysis.sma.length - 1];
  const volumeRatio = volumeAnalysis.ratio[volumeAnalysis.ratio.length - 1];

  const supportResistance = findSupportResistance(candles);
  const nearest = getNearestLevels(lastCandle.close, supportResistance);

  // Calculate signal scores
  let signalScore = 0;

  // RSI contribution
  const rsiSignal = getRSISignal(rsi || 50);
  signalScore += rsiSignal.strength * 4;

  // MACD contribution
  const macdSignalResult = getMACDSignal(macd, macdSignal, macdHistogram, prevHistogram);
  signalScore += macdSignalResult.strength * 3;

  // Bollinger contribution
  const bollingerSignal = getBollingerSignal(
    lastCandle.close,
    bollingerUpper,
    bollingerMiddle,
    bollingerLower
  );
  signalScore += bollingerSignal.strength * 2;

  // MA alignment
  if (sma20 !== null && sma50 !== null) {
    if (sma20 > sma50) signalScore += 2;
    else signalScore -= 2;
  }

  if (sma50 !== null && sma200 !== null) {
    if (sma50 > sma200) signalScore += 2;
    else signalScore -= 2;
  }

  // Price vs MA
  if (sma20 !== null) {
    if (lastCandle.close > sma20) signalScore += 1;
    else signalScore -= 1;
  }

  // Volume contribution (CRITICAL for Spot confirmation)
  const priceChange = closes[closes.length - 1] - closes[closes.length - 2];
  const volumeSignal = getVolumeSignal(volumeRatio, priceChange);
  signalScore += volumeSignal.strength * 3; // Increased from 1 to 3

  // Long-term Trend Context (Don't buy against a crash)
  if (ema200 !== null) {
    if (lastCandle.close < ema200) {
      signalScore -= 6; // Heavy penalty for bear market context
    } else {
      signalScore += 4; // Bonus for bull market health
    }
  }

  // Support/Resistance contribution
  if (nearest.distanceToSupport < 1.5) {
    const strengthBonus = nearest.nearestSupport?.strength || 1;
    signalScore += 2 + strengthBonus; // Dynamic bonus based on support strength
  }
  if (nearest.distanceToResistance < 1.5) {
    signalScore -= 5; // More aggressive penalty near resistance
  }

  // Determine trend
  let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
  if (ema20 !== null && ema50 !== null && lastCandle.close > ema20 && ema20 > ema50) {
    trend = 'BULLISH';
  } else if (ema20 !== null && ema50 !== null && lastCandle.close < ema20 && ema20 < ema50) {
    trend = 'BEARISH';
  }

  // Determine signal (Endurecido para Spot)
  let signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  if (signalScore >= 22) signal = 'STRONG_BUY'; // Increased from 15
  else if (signalScore >= 10) signal = 'BUY';    // Increased from 5
  else if (signalScore <= -22) signal = 'STRONG_SELL';
  else if (signalScore <= -10) signal = 'SELL';
  else signal = 'NEUTRAL';

  return {
    rsi,
    macd: {
      macd,
      signal: macdSignal,
      histogram: macdHistogram,
    },
    bollingerBands: {
      upper: bollingerUpper,
      middle: bollingerMiddle,
      lower: bollingerLower,
      width: bollingerWidth,
    },
    movingAverages: {
      sma20,
      sma50,
      sma200,
      ema20,
      ema50,
      ema200,
    },
    volume: {
      sma20: volumeSma20,
      ratio: volumeRatio,
    },
    supportResistance: {
      support1: nearest.nearestSupport?.price || null,
      support2: levels.supports[1]?.price || null,
      resistance1: nearest.nearestResistance?.price || null,
      resistance2: levels.resistances[1]?.price || null,
      pivot: supportResistance.pivotPoint,
    },
    trend,
    signal,
    signalScore,
  };
}

// Import for levels reference
const levels = { supports: [] as PriceLevel[], resistances: [] as PriceLevel[] };

// ==================== OPPORTUNITY SCANNER ====================

export interface ScanOpportunity {
  symbol: string;
  price: number;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  signalScore: number;
  rsi: number | null;
  distanceFromSupport: number;
  triggers: string[];
}

/**
 * Scan for buy opportunities
 */
export function scanForOpportunities(
  cryptoData: Array<{
    symbol: string;
    candles: CandleData[];
  }>
): ScanOpportunity[] {
  const opportunities: ScanOpportunity[] = [];

  for (const crypto of cryptoData) {
    if (crypto.candles.length < 50) continue;

    const analysis = performTechnicalAnalysis(crypto.candles);
    const lastPrice = crypto.candles[crypto.candles.length - 1].close;

    const triggers: string[] = [];

    // Check for buy signals
    if (analysis.rsi !== null && analysis.rsi < 35) {
      triggers.push(`RSI oversold (${analysis.rsi.toFixed(1)})`);
    }

    if (analysis.bollingerBands.lower && lastPrice < analysis.bollingerBands.lower) {
      triggers.push('Price below lower Bollinger Band');
    }

    if (analysis.macd.histogram !== null && analysis.macd.histogram > 0) {
      triggers.push('MACD histogram positive');
    }

    if (analysis.supportResistance.support1 && lastPrice <= analysis.supportResistance.support1 * 1.02) {
      triggers.push('Near support level');
    }

    if (analysis.signal === 'BUY' || analysis.signal === 'STRONG_BUY') {
      opportunities.push({
        symbol: crypto.symbol,
        price: lastPrice,
        signal: analysis.signal,
        signalScore: analysis.signalScore,
        rsi: analysis.rsi,
        distanceFromSupport: analysis.supportResistance.support1
          ? ((lastPrice - analysis.supportResistance.support1) / lastPrice) * 100
          : 100,
        triggers,
      });
    }
  }

  // Sort by signal score (best opportunities first)
  return opportunities.sort((a, b) => b.signalScore - a.signalScore);
}
