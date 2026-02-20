import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketDataWithFallback, getOHLCData } from '@/lib/crypto/apis';
import { 
  performTechnicalAnalysis, 
  calculateRSI, 
  calculateMACD, 
  calculateBollingerBands 
} from '@/lib/crypto/technical-analysis';
import type { BacktestConfig, BacktestResult, BacktestTrade } from '@/lib/crypto/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/backtest
 * Run backtesting on a trading strategy
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config: BacktestConfig = {
      cryptoId: body.cryptoId || 'bitcoin',
      startDate: new Date(body.startDate || Date.now() - 365 * 24 * 60 * 60 * 1000),
      endDate: new Date(body.endDate || Date.now()),
      initialCapital: body.initialCapital || 10000,
      rsiOversold: body.rsiOversold || 30,
      rsiOverbought: body.rsiOverbought || 70,
      stopLossPercent: body.stopLossPercent || 5,
      takeProfitPercent: body.takeProfitPercent || 20,
      positionSizePercent: body.positionSizePercent || 10,
      maxPositions: body.maxPositions || 3,
    };
    
    // Calculate days for API
    const days = Math.ceil(
      (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Fetch historical data
    const ohlcData = await getOHLCData(config.cryptoId, 'usd', Math.min(days, 365));
    
    if (ohlcData.length < 50) {
      return NextResponse.json({
        success: false,
        error: 'Not enough historical data for backtesting',
      }, { status: 400 });
    }
    
    // Transform to candles
    const candles = ohlcData.map((ohlc) => ({
      timestamp: ohlc.timestamp,
      open: ohlc.open,
      high: ohlc.high,
      low: ohlc.low,
      close: ohlc.close,
      volume: 0,
    }));
    
    // Calculate indicators for all candles
    const closes = candles.map(c => c.close);
    const rsiValues = calculateRSI(closes, 14);
    const macdResult = calculateMACD(closes);
    const bollinger = calculateBollingerBands(closes, 20, 2);
    
    // Run backtest
    const result = runBacktest(
      candles,
      rsiValues,
      macdResult,
      bollinger,
      config
    );
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Backtest API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Backtest failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * Run backtest simulation
 */
function runBacktest(
  candles: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>,
  rsiValues: (number | null)[],
  macdResult: { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] },
  bollinger: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] },
  config: BacktestConfig
): BacktestResult {
  let capital = config.initialCapital;
  let position = 0;
  let entryPrice = 0;
  let stopLoss = 0;
  let takeProfit = 0;
  
  const trades: BacktestTrade[] = [];
  const equityCurve: Array<{ timestamp: number; value: number }> = [];
  
  let winningTrades = 0;
  let losingTrades = 0;
  let totalPnL = 0;
  let maxDrawdown = 0;
  let peakEquity = capital;
  
  // Simulate trading
  for (let i = 50; i < candles.length; i++) {
    const candle = candles[i];
    const rsi = rsiValues[i];
    const macdHistogram = macdResult.histogram[i];
    const prevHistogram = macdResult.histogram[i - 1];
    const lowerBand = bollinger.lower[i];
    
    // Current equity
    const currentEquity = capital + (position * candle.close);
    equityCurve.push({ timestamp: candle.timestamp, value: currentEquity });
    
    // Update max drawdown
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const drawdown = (peakEquity - currentEquity) / peakEquity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    
    // Check stop loss / take profit if in position
    if (position > 0) {
      // Stop loss hit
      if (candle.low <= stopLoss) {
        const pnl = (stopLoss - entryPrice) * position;
        capital += stopLoss * position;
        
        trades.push({
          type: 'SELL',
          timestamp: new Date(candle.timestamp),
          price: stopLoss,
          quantity: position,
          total: stopLoss * position,
          reason: 'Stop Loss',
          pnl,
          pnlPercent: (pnl / (entryPrice * position)) * 100,
        });
        
        if (pnl < 0) losingTrades++;
        totalPnL += pnl;
        position = 0;
        entryPrice = 0;
        continue;
      }
      
      // Take profit hit
      if (candle.high >= takeProfit) {
        const pnl = (takeProfit - entryPrice) * position;
        capital += takeProfit * position;
        
        trades.push({
          type: 'SELL',
          timestamp: new Date(candle.timestamp),
          price: takeProfit,
          quantity: position,
          total: takeProfit * position,
          reason: 'Take Profit',
          pnl,
          pnlPercent: (pnl / (entryPrice * position)) * 100,
        });
        
        if (pnl > 0) winningTrades++;
        totalPnL += pnl;
        position = 0;
        entryPrice = 0;
        continue;
      }
    }
    
    // Buy signal
    if (position === 0 && capital > 0) {
      const buySignals: string[] = [];
      
      // RSI oversold
      if (rsi !== null && rsi < config.rsiOversold) {
        buySignals.push('RSI oversold');
      }
      
      // MACD crossover
      if (
        macdHistogram !== null && 
        prevHistogram !== null &&
        macdHistogram > 0 && 
        prevHistogram <= 0
      ) {
        buySignals.push('MACD bullish crossover');
      }
      
      // Price below lower Bollinger Band
      if (lowerBand !== null && candle.close < lowerBand) {
        buySignals.push('Below Bollinger Band');
      }
      
      // Execute buy if we have signals
      if (buySignals.length >= 1) {
        const positionSize = (capital * config.positionSizePercent) / 100;
        const quantity = positionSize / candle.close;
        
        position = quantity;
        entryPrice = candle.close;
        stopLoss = candle.close * (1 - config.stopLossPercent / 100);
        takeProfit = candle.close * (1 + config.takeProfitPercent / 100);
        capital -= positionSize;
        
        trades.push({
          type: 'BUY',
          timestamp: new Date(candle.timestamp),
          price: candle.close,
          quantity,
          total: positionSize,
          reason: buySignals.join(', '),
        });
      }
    }
    
    // Sell signal (if in position)
    if (position > 0) {
      const sellSignals: string[] = [];
      
      // RSI overbought
      if (rsi !== null && rsi > config.rsiOverbought) {
        sellSignals.push('RSI overbought');
      }
      
      // MACD bearish crossover
      if (
        macdHistogram !== null && 
        prevHistogram !== null &&
        macdHistogram < 0 && 
        prevHistogram >= 0
      ) {
        sellSignals.push('MACD bearish crossover');
      }
      
      if (sellSignals.length >= 1) {
        const pnl = (candle.close - entryPrice) * position;
        capital += candle.close * position;
        
        trades.push({
          type: 'SELL',
          timestamp: new Date(candle.timestamp),
          price: candle.close,
          quantity: position,
          total: candle.close * position,
          reason: sellSignals.join(', '),
          pnl,
          pnlPercent: (pnl / (entryPrice * position)) * 100,
        });
        
        if (pnl > 0) winningTrades++;
        else losingTrades++;
        totalPnL += pnl;
        position = 0;
        entryPrice = 0;
      }
    }
  }
  
  // Close any remaining position
  if (position > 0) {
    const lastCandle = candles[candles.length - 1];
    const pnl = (lastCandle.close - entryPrice) * position;
    capital += lastCandle.close * position;
    
    trades.push({
      type: 'SELL',
      timestamp: new Date(lastCandle.timestamp),
      price: lastCandle.close,
      quantity: position,
      total: lastCandle.close * position,
      reason: 'End of backtest',
      pnl,
      pnlPercent: (pnl / (entryPrice * position)) * 100,
    });
    
    if (pnl > 0) winningTrades++;
    else losingTrades++;
    totalPnL += pnl;
  }
  
  const totalReturn = capital - config.initialCapital;
  const totalReturnPercent = (totalReturn / config.initialCapital) * 100;
  const annualizedReturn = totalReturnPercent * (365 / Math.max(1, candles.length / 24));
  const totalTrades = winningTrades + losingTrades;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  
  // Calculate Sharpe ratio (simplified)
  const returns = trades
    .filter(t => t.pnl !== undefined)
    .map(t => (t.pnlPercent || 0) / 100);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1 
    ? Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  
  return {
    config,
    totalReturn,
    totalReturnPercent,
    annualizedReturn,
    maxDrawdown: maxDrawdown * 100,
    sharpeRatio,
    winRate,
    totalTrades,
    winningTrades,
    losingTrades,
    trades,
    equityCurve,
    analysis: generateBacktestAnalysis(
      totalReturnPercent,
      winRate,
      maxDrawdown,
      sharpeRatio,
      totalTrades
    ),
  };
}

/**
 * Generate backtest analysis text
 */
function generateBacktestAnalysis(
  returnPercent: number,
  winRate: number,
  maxDrawdown: number,
  sharpe: number,
  totalTrades: number
): string {
  const parts: string[] = [];
  
  if (returnPercent > 50) {
    parts.push(`📈 Excelente rendimiento con retorno del ${returnPercent.toFixed(1)}%`);
  } else if (returnPercent > 20) {
    parts.push(`📊 Buen rendimiento con retorno del ${returnPercent.toFixed(1)}%`);
  } else if (returnPercent > 0) {
    parts.push(`📉 Rendimiento moderado del ${returnPercent.toFixed(1)}%`);
  } else {
    parts.push(`❌ Pérdida del ${Math.abs(returnPercent).toFixed(1)}%`);
  }
  
  if (winRate > 60) {
    parts.push(`Tasa de éxito alta del ${winRate.toFixed(1)}%`);
  } else if (winRate > 40) {
    parts.push(`Tasa de éxito moderada del ${winRate.toFixed(1)}%`);
  } else {
    parts.push(`Tasa de éxito baja del ${winRate.toFixed(1)}%`);
  }
  
  if (maxDrawdown > 30) {
    parts.push(`⚠️ Drawdown máximo alto del ${maxDrawdown.toFixed(1)}% - considerar ajustar stop loss`);
  } else if (maxDrawdown > 15) {
    parts.push(`Drawdown máximo del ${maxDrawdown.toFixed(1)}% - aceptable`);
  } else {
    parts.push(`Excelente control de riesgo con drawdown del ${maxDrawdown.toFixed(1)}%`);
  }
  
  if (sharpe > 1) {
    parts.push(`Ratio Sharpe excelente: ${sharpe.toFixed(2)}`);
  } else if (sharpe > 0.5) {
    parts.push(`Ratio Sharpe aceptable: ${sharpe.toFixed(2)}`);
  }
  
  parts.push(`Total de ${totalTrades} operaciones ejecutadas`);
  
  return parts.join('. ');
}
