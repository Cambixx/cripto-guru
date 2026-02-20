// Technical Analysis Library
// Implements RSI, MACD, Bollinger Bands, Moving Averages, and more

import type { OHLCVData } from './crypto-apis'

// ==================== Types ====================

export interface TechnicalIndicators {
  rsi: number | null
  macd: number | null
  macdSignal: number | null
  macdHistogram: number | null
  bollingerUpper: number | null
  bollingerMiddle: number | null
  bollingerLower: number | null
  ema20: number | null
  ema50: number | null
  ema200: number | null
  sma20: number | null
  sma50: number | null
  sma200: number | null
  support: number | null
  resistance: number | null
  atr: number | null
  volumeProfile: number | null
  relativeVolume: number | null
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  signal: 'BUY' | 'SELL' | 'HOLD'
  confidence: number // 0-100
}

export interface IndicatorResult {
  value: number
  signal: 'BUY' | 'SELL' | 'NEUTRAL'
  strength: number // 0-100
}

export interface SupportResistance {
  support: number[]
  resistance: number[]
  pivot: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
}

export interface AnalysisResult {
  indicators: TechnicalIndicators
  recommendation: string
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  signals: {
    name: string
    value: number | string
    signal: 'BUY' | 'SELL' | 'NEUTRAL'
    strength: number
  }[]
}

// ==================== Helper Functions ====================

function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null
  const slice = data.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function calculateEMA(data: number[], period: number): number | null {
  if (data.length < period) return null
  
  const multiplier = 2 / (period + 1)
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema
  }
  
  return ema
}

function calculateStandardDeviation(data: number[], period: number): number | null {
  if (data.length < period) return null
  
  const slice = data.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const squaredDiffs = slice.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period)
}

// ==================== RSI (Relative Strength Index) ====================

export function calculateRSI(closes: number[], period: number = 14): IndicatorResult {
  if (closes.length < period + 1) {
    return { value: 50, signal: 'NEUTRAL', strength: 0 }
  }
  
  const changes = []
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1])
  }
  
  let gains = 0
  let losses = 0
  
  // Calculate initial average
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      gains += changes[i]
    } else {
      losses += Math.abs(changes[i])
    }
  }
  
  let avgGain = gains / period
  let avgLoss = losses / period
  
  // Use smoothed average for remaining periods
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period
    }
  }
  
  if (avgLoss === 0) {
    return { value: 100, signal: 'SELL', strength: 100 }
  }
  
  const rs = avgGain / avgLoss
  const rsi = 100 - (100 / (1 + rs))
  
  // Determine signal
  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  let strength = 0
  
  if (rsi < 30) {
    signal = 'BUY'
    strength = Math.round((30 - rsi) / 30 * 100)
  } else if (rsi > 70) {
    signal = 'SELL'
    strength = Math.round((rsi - 70) / 30 * 100)
  } else if (rsi < 40) {
    signal = 'BUY'
    strength = Math.round((40 - rsi) / 40 * 50)
  } else if (rsi > 60) {
    signal = 'SELL'
    strength = Math.round((rsi - 60) / 40 * 50)
  }
  
  return { value: rsi, signal, strength }
}

// ==================== MACD (Moving Average Convergence Divergence) ====================

export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number | null; signal: number | null; histogram: number | null; result: IndicatorResult } {
  if (closes.length < slowPeriod + signalPeriod) {
    return { macd: null, signal: null, histogram: null, result: { value: 0, signal: 'NEUTRAL', strength: 0 } }
  }
  
  // Calculate EMAs
  const fastEMA: number[] = []
  const slowEMA: number[] = []
  
  const fastMultiplier = 2 / (fastPeriod + 1)
  const slowMultiplier = 2 / (slowPeriod + 1)
  
  // Initial SMA values
  let fastSMA = closes.slice(0, fastPeriod).reduce((a, b) => a + b, 0) / fastPeriod
  let slowSMA = closes.slice(0, slowPeriod).reduce((a, b) => a + b, 0) / slowPeriod
  
  fastEMA.push(fastSMA)
  slowEMA.push(slowSMA)
  
  // Calculate EMAs
  for (let i = fastPeriod; i < closes.length; i++) {
    fastSMA = (closes[i] - fastSMA) * fastMultiplier + fastSMA
    fastEMA.push(fastSMA)
    
    if (i >= slowPeriod - 1) {
      slowSMA = (closes[i] - slowSMA) * slowMultiplier + slowSMA
      slowEMA.push(slowSMA)
    }
  }
  
  // Calculate MACD line
  const macdLine: number[] = []
  const startIndex = slowPeriod - fastPeriod
  
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + startIndex] - slowEMA[i])
  }
  
  // Calculate Signal line (EMA of MACD)
  const signalMultiplier = 2 / (signalPeriod + 1)
  let signalValue = macdLine.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod
  
  for (let i = signalPeriod; i < macdLine.length; i++) {
    signalValue = (macdLine[i] - signalValue) * signalMultiplier + signalValue
  }
  
  const macd = macdLine[macdLine.length - 1]
  const histogram = macd - signalValue
  
  // Determine signal
  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  let strength = 0
  
  // Histogram crossover signals
  if (histogram > 0 && macdLine[macdLine.length - 2] - signalValue < 0) {
    signal = 'BUY'
    strength = 80
  } else if (histogram < 0 && macdLine[macdLine.length - 2] - signalValue > 0) {
    signal = 'SELL'
    strength = 80
  } else if (histogram > 0) {
    signal = 'BUY'
    strength = Math.min(50, Math.abs(histogram) * 1000)
  } else if (histogram < 0) {
    signal = 'SELL'
    strength = Math.min(50, Math.abs(histogram) * 1000)
  }
  
  return {
    macd,
    signal: signalValue,
    histogram,
    result: { value: macd, signal, strength }
  }
}

// ==================== Bollinger Bands ====================

export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number | null; middle: number | null; lower: number | null; result: IndicatorResult } {
  if (closes.length < period) {
    return { upper: null, middle: null, lower: null, result: { value: 0, signal: 'NEUTRAL', strength: 0 } }
  }
  
  const sma = calculateSMA(closes, period)
  const std = calculateStandardDeviation(closes, period)
  
  if (sma === null || std === null) {
    return { upper: null, middle: null, lower: null, result: { value: 0, signal: 'NEUTRAL', strength: 0 } }
  }
  
  const upper = sma + (stdDev * std)
  const lower = sma - (stdDev * std)
  const currentPrice = closes[closes.length - 1]
  
  // Calculate bandwidth and position
  const bandwidth = (upper - lower) / sma * 100
  const percentB = (currentPrice - lower) / (upper - lower) * 100
  
  // Determine signal based on position
  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  let strength = 0
  
  if (currentPrice <= lower) {
    signal = 'BUY'
    strength = 90
  } else if (currentPrice >= upper) {
    signal = 'SELL'
    strength = 90
  } else if (percentB < 20) {
    signal = 'BUY'
    strength = Math.round((20 - percentB) / 20 * 70)
  } else if (percentB > 80) {
    signal = 'SELL'
    strength = Math.round((percentB - 80) / 20 * 70)
  }
  
  return {
    upper,
    middle: sma,
    lower,
    result: { value: percentB, signal, strength }
  }
}

// ==================== Moving Averages ====================

export function calculateMovingAverages(closes: number[]): {
  ema20: number | null
  ema50: number | null
  ema200: number | null
  sma20: number | null
  sma50: number | null
  sma200: number | null
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  result: IndicatorResult
} {
  const ema20 = calculateEMA(closes, 20)
  const ema50 = calculateEMA(closes, 50)
  const ema200 = calculateEMA(closes, 200)
  const sma20 = calculateSMA(closes, 20)
  const sma50 = calculateSMA(closes, 50)
  const sma200 = calculateSMA(closes, 200)
  
  const currentPrice = closes[closes.length - 1]
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  let strength = 0
  
  // Determine trend based on EMA alignment
  if (ema20 && ema50 && ema200) {
    if (ema20 > ema50 && ema50 > ema200) {
      trend = 'BULLISH'
      signal = 'BUY'
      strength = 70
    } else if (ema20 < ema50 && ema50 < ema200) {
      trend = 'BEARISH'
      signal = 'SELL'
      strength = 70
    }
  } else if (ema20 && ema50) {
    if (ema20 > ema50) {
      trend = 'BULLISH'
      signal = 'BUY'
      strength = 50
    } else {
      trend = 'BEARISH'
      signal = 'SELL'
      strength = 50
    }
  }
  
  // Check for golden cross / death cross
  if (sma50 && sma200) {
    if (currentPrice > sma50 && currentPrice > sma200) {
      signal = 'BUY'
      strength = Math.max(strength, 60)
    } else if (currentPrice < sma50 && currentPrice < sma200) {
      signal = 'SELL'
      strength = Math.max(strength, 60)
    }
  }
  
  return {
    ema20,
    ema50,
    ema200,
    sma20,
    sma50,
    sma200,
    trend,
    result: { value: currentPrice, signal, strength }
  }
}

// ==================== ATR (Average True Range) ====================

export function calculateATR(data: OHLCVData[], period: number = 14): number | null {
  if (data.length < period + 1) return null
  
  const trueRanges: number[] = []
  
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high
    const low = data[i].low
    const prevClose = data[i - 1].close
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    )
    trueRanges.push(tr)
  }
  
  // Calculate initial ATR
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  // Smooth ATR
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period
  }
  
  return atr
}

// ==================== Support & Resistance ====================

export function calculateSupportResistance(data: OHLCVData[]): SupportResistance {
  if (data.length < 5) {
    return {
      support: [],
      resistance: [],
      pivot: 0,
      r1: 0,
      r2: 0,
      r3: 0,
      s1: 0,
      s2: 0,
      s3: 0
    }
  }
  
  // Use the most recent candle for pivot point calculation
  const lastCandle = data[data.length - 1]
  const high = lastCandle.high
  const low = lastCandle.low
  const close = lastCandle.close
  
  // Classic Pivot Points
  const pivot = (high + low + close) / 3
  const r1 = 2 * pivot - low
  const r2 = pivot + (high - low)
  const r3 = high + 2 * (pivot - low)
  const s1 = 2 * pivot - high
  const s2 = pivot - (high - low)
  const s3 = low - 2 * (high - pivot)
  
  // Find historical support and resistance levels
  const supportLevels: number[] = []
  const resistanceLevels: number[] = []
  
  for (let i = 2; i < data.length - 2; i++) {
    const current = data[i]
    
    // Local low detection
    if (current.low < data[i - 1].low && current.low < data[i - 2].low &&
        current.low < data[i + 1].low && current.low < data[i + 2].low) {
      supportLevels.push(current.low)
    }
    
    // Local high detection
    if (current.high > data[i - 1].high && current.high > data[i - 2].high &&
        current.high > data[i + 1].high && current.high > data[i + 2].high) {
      resistanceLevels.push(current.high)
    }
  }
  
  // Sort and get unique levels
  const support = [...new Set(supportLevels)].sort((a, b) => b - a).slice(0, 3)
  const resistance = [...new Set(resistanceLevels)].sort((a, b) => a - b).slice(0, 3)
  
  return {
    support,
    resistance,
    pivot,
    r1,
    r2,
    r3,
    s1,
    s2,
    s3
  }
}

// ==================== Volume Analysis ====================

export function calculateVolumeAnalysis(data: OHLCVData[], period: number = 20): {
  volumeProfile: number | null
  relativeVolume: number | null
  result: IndicatorResult
} {
  if (data.length < period) {
    return { volumeProfile: null, relativeVolume: null, result: { value: 0, signal: 'NEUTRAL', strength: 0 } }
  }
  
  const volumes = data.map(d => d.volume)
  const avgVolume = volumes.slice(-period).reduce((a, b) => a + b, 0) / period
  const currentVolume = volumes[volumes.length - 1]
  
  const relativeVolume = avgVolume > 0 ? currentVolume / avgVolume : null
  const volumeProfile = currentVolume
  
  // Volume-based signal
  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  let strength = 0
  
  if (relativeVolume && relativeVolume > 2) {
    // High volume - check price direction
    const priceChange = data[data.length - 1].close - data[data.length - 2].close
    signal = priceChange > 0 ? 'BUY' : 'SELL'
    strength = Math.min(80, relativeVolume * 20)
  } else if (relativeVolume && relativeVolume < 0.5) {
    signal = 'NEUTRAL'
    strength = 20
  }
  
  return {
    volumeProfile,
    relativeVolume,
    result: { value: relativeVolume || 0, signal, strength }
  }
}

// ==================== Complete Analysis ====================

export function performCompleteAnalysis(data: OHLCVData[]): AnalysisResult {
  const closes = data.map(d => d.close)
  
  // Calculate all indicators
  const rsiResult = calculateRSI(closes)
  const macdResult = calculateMACD(closes)
  const bollingerResult = calculateBollingerBands(closes)
  const maResult = calculateMovingAverages(closes)
  const volumeResult = calculateVolumeAnalysis(data)
  const supportResistance = calculateSupportResistance(data)
  const atr = calculateATR(data)
  
  // Compile signals
  const signals: AnalysisResult['signals'] = [
    { name: 'RSI', value: rsiResult.value, signal: rsiResult.signal, strength: rsiResult.strength },
    { name: 'MACD', value: macdResult.macd?.toFixed(4) || 'N/A', signal: macdResult.result.signal, strength: macdResult.result.strength },
    { name: 'Bollinger %B', value: bollingerResult.result.value.toFixed(2), signal: bollingerResult.result.signal, strength: bollingerResult.result.strength },
    { name: 'Trend', value: maResult.trend, signal: maResult.result.signal, strength: maResult.result.strength },
    { name: 'Volume', value: volumeResult.relativeVolume?.toFixed(2) || 'N/A', signal: volumeResult.result.signal, strength: volumeResult.result.strength }
  ]
  
  // Calculate overall signal
  const buySignals = signals.filter(s => s.signal === 'BUY')
  const sellSignals = signals.filter(s => s.signal === 'SELL')
  
  const avgBuyStrength = buySignals.length > 0 
    ? buySignals.reduce((a, b) => a + b.strength, 0) / buySignals.length 
    : 0
  const avgSellStrength = sellSignals.length > 0 
    ? sellSignals.reduce((a, b) => a + b.strength, 0) / sellSignals.length 
    : 0
  
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
  let confidence = 0
  
  if (buySignals.length > sellSignals.length && avgBuyStrength > 50) {
    action = 'BUY'
    confidence = Math.round((buySignals.length / signals.length) * avgBuyStrength)
  } else if (sellSignals.length > buySignals.length && avgSellStrength > 50) {
    action = 'SELL'
    confidence = Math.round((sellSignals.length / signals.length) * avgSellStrength)
  } else if (avgBuyStrength > avgSellStrength + 20) {
    action = 'BUY'
    confidence = Math.round(avgBuyStrength * 0.8)
  } else if (avgSellStrength > avgBuyStrength + 20) {
    action = 'SELL'
    confidence = Math.round(avgSellStrength * 0.8)
  } else {
    confidence = 50 - Math.abs(avgBuyStrength - avgSellStrength)
  }
  
  // Generate recommendation text
  const currentPrice = closes[closes.length - 1]
  const indicators: TechnicalIndicators = {
    rsi: rsiResult.value,
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
    bollingerUpper: bollingerResult.upper,
    bollingerMiddle: bollingerResult.middle,
    bollingerLower: bollingerResult.lower,
    ema20: maResult.ema20,
    ema50: maResult.ema50,
    ema200: maResult.ema200,
    sma20: maResult.sma20,
    sma50: maResult.sma50,
    sma200: maResult.sma200,
    support: supportResistance.s1,
    resistance: supportResistance.r1,
    atr,
    volumeProfile: volumeResult.volumeProfile,
    relativeVolume: volumeResult.relativeVolume,
    trend: maResult.trend,
    signal: action,
    confidence
  }
  
  let recommendation = `Current price: $${currentPrice.toFixed(2)}. `
  
  if (action === 'BUY') {
    recommendation += `Bullish signals detected. RSI at ${rsiResult.value.toFixed(1)} suggests oversold conditions. `
    if (bollingerResult.lower && currentPrice <= bollingerResult.lower) {
      recommendation += `Price at lower Bollinger Band - potential bounce opportunity. `
    }
    recommendation += `Consider entry with stop loss at $${supportResistance.s1.toFixed(2)}.`
  } else if (action === 'SELL') {
    recommendation += `Bearish signals detected. RSI at ${rsiResult.value.toFixed(1)} suggests overbought conditions. `
    if (bollingerResult.upper && currentPrice >= bollingerResult.upper) {
      recommendation += `Price at upper Bollinger Band - potential reversal. `
    }
    recommendation += `Consider taking profits or setting stop loss at $${supportResistance.r1.toFixed(2)}.`
  } else {
    recommendation += `Mixed signals. Wait for clearer direction. `
    recommendation += `Support: $${supportResistance.s1.toFixed(2)}, Resistance: $${supportResistance.r1.toFixed(2)}.`
  }
  
  return {
    indicators,
    recommendation,
    action,
    confidence,
    signals
  }
}

// ==================== Backtesting ====================

export interface BacktestTrade {
  type: 'BUY' | 'SELL'
  price: number
  timestamp: Date
  quantity: number
  reason: string
}

export interface BacktestResult {
  trades: BacktestTrade[]
  totalReturn: number
  totalReturnPercent: number
  winRate: number
  maxDrawdown: number
  sharpeRatio: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
}

export function runBacktest(
  data: OHLCVData[],
  initialCapital: number = 10000,
  rsiOversold: number = 30,
  rsiOverbought: number = 70
): BacktestResult {
  if (data.length < 50) {
    return {
      trades: [],
      totalReturn: 0,
      totalReturnPercent: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0
    }
  }
  
  const trades: BacktestTrade[] = []
  let capital = initialCapital
  let position = 0 // Number of units held
  let maxCapital = initialCapital
  let maxDrawdown = 0
  const returns: number[] = []
  
  for (let i = 50; i < data.length; i++) {
    const historicalData = data.slice(0, i)
    const closes = historicalData.map(d => d.close)
    const currentPrice = closes[closes.length - 1]
    
    const rsiResult = calculateRSI(closes)
    const macdResult = calculateMACD(closes)
    
    // Buy signal
    if (position === 0 && rsiResult.value < rsiOversold && macdResult.histogram && macdResult.histogram > 0) {
      const quantity = capital / currentPrice
      position = quantity
      capital = 0
      trades.push({
        type: 'BUY',
        price: currentPrice,
        timestamp: data[i].timestamp,
        quantity,
        reason: `RSI: ${rsiResult.value.toFixed(1)}, MACD crossover`
      })
    }
    // Sell signal
    else if (position > 0 && (rsiResult.value > rsiOverbought || (macdResult.histogram && macdResult.histogram < 0))) {
      capital = position * currentPrice
      trades.push({
        type: 'SELL',
        price: currentPrice,
        timestamp: data[i].timestamp,
        quantity: position,
        reason: rsiResult.value > rsiOverbought ? `RSI overbought: ${rsiResult.value.toFixed(1)}` : 'MACD bearish crossover'
      })
      position = 0
      
      // Track returns
      const lastBuy = trades.filter(t => t.type === 'BUY').slice(-1)[0]
      if (lastBuy) {
        const tradeReturn = (currentPrice - lastBuy.price) / lastBuy.price
        returns.push(tradeReturn)
      }
    }
    
    // Track max drawdown
    const currentValue = position > 0 ? position * currentPrice : capital
    if (currentValue > maxCapital) {
      maxCapital = currentValue
    }
    const drawdown = (maxCapital - currentValue) / maxCapital
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }
  
  // Close any remaining position
  const finalValue = position > 0 ? position * data[data.length - 1].close : capital
  
  // Calculate metrics
  const totalReturn = finalValue - initialCapital
  const totalReturnPercent = (totalReturn / initialCapital) * 100
  
  const buyTrades = trades.filter(t => t.type === 'BUY')
  const sellTrades = trades.filter(t => t.type === 'SELL')
  
  let winningTrades = 0
  let losingTrades = 0
  
  for (let i = 0; i < Math.min(buyTrades.length, sellTrades.length); i++) {
    if (sellTrades[i].price > buyTrades[i].price) {
      winningTrades++
    } else {
      losingTrades++
    }
  }
  
  const winRate = (winningTrades + losingTrades) > 0 
    ? (winningTrades / (winningTrades + losingTrades)) * 100 
    : 0
  
  // Calculate Sharpe Ratio (simplified)
  const avgReturn = returns.length > 0 
    ? returns.reduce((a, b) => a + b, 0) / returns.length 
    : 0
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / (returns.length - 1))
    : 0
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0
  
  return {
    trades,
    totalReturn,
    totalReturnPercent,
    winRate,
    maxDrawdown: maxDrawdown * 100,
    sharpeRatio,
    totalTrades: trades.length,
    winningTrades,
    losingTrades
  }
}
