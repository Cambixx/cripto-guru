import { NextRequest, NextResponse } from 'next/server';
import { getOHLCData, getMarketChart } from '@/lib/crypto/apis';
import { performTechnicalAnalysis, findSupportResistance, getNearestLevels } from '@/lib/crypto/technical-analysis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crypto/analysis/[id]
 * Get detailed analysis for a specific cryptocurrency
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Fetch OHLC data using hybrid approach
    const { getBestOHLCData, getSymbolFromId } = await import('@/lib/crypto/apis');
    const symbol = getSymbolFromId(id) || id;
    const ohlcData = await getBestOHLCData(id, symbol, days);

    if (ohlcData.length < 20) {
      return NextResponse.json({
        success: false,
        error: 'Not enough historical data',
      }, { status: 400 });
    }

    // Transform to candle format
    const candles = ohlcData.map((ohlc) => ({
      timestamp: ohlc.timestamp,
      open: ohlc.open,
      high: ohlc.high,
      low: ohlc.low,
      close: ohlc.close,
      volume: 0,
    }));

    // Perform technical analysis
    const indicators = performTechnicalAnalysis(candles);
    const supportResistance = findSupportResistance(candles);
    const nearestLevels = getNearestLevels(
      candles[candles.length - 1].close,
      supportResistance
    );

    // Volume data from Binance (already in candles or skip if not critical)
    let volumeData: Array<{ timestamp: number; volume: number }> = [];

    // Calculate price statistics
    const prices = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const currentPrice = prices[prices.length - 1];
    const periodHigh = Math.max(...highs);
    const periodLow = Math.min(...lows);
    const priceFromHigh = ((currentPrice - periodHigh) / periodHigh) * 100;
    const priceFromLow = ((currentPrice - periodLow) / periodLow) * 100;

    // Generate alerts based on analysis
    const alerts = generateAlerts(indicators, nearestLevels, currentPrice);

    return NextResponse.json({
      success: true,
      data: {
        cryptoId: id,
        currentPrice,
        priceStats: {
          periodHigh,
          periodLow,
          priceFromHigh,
          priceFromLow,
        },
        indicators,
        supportResistance: {
          levels: supportResistance,
          nearest: nearestLevels,
        },
        volumeData: volumeData.slice(-30), // Last 30 data points
        alerts,
        candles: candles.slice(-100), // Last 100 candles for charting
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate alerts based on technical analysis
 */
function generateAlerts(
  indicators: ReturnType<typeof performTechnicalAnalysis>,
  nearestLevels: ReturnType<typeof getNearestLevels>,
  currentPrice: number
): Array<{ type: string; severity: string; message: string }> {
  const alerts: Array<{ type: string; severity: string; message: string }> = [];

  // RSI alerts
  if (indicators.rsi !== null) {
    if (indicators.rsi < 25) {
      alerts.push({
        type: 'RSI_OVERSOLD',
        severity: 'CRITICAL',
        message: `RSI extremadamente sobrevendido (${indicators.rsi.toFixed(1)}). Posible oportunidad de compra.`,
      });
    } else if (indicators.rsi < 30) {
      alerts.push({
        type: 'RSI_OVERSOLD',
        severity: 'WARNING',
        message: `RSI sobrevendido (${indicators.rsi.toFixed(1)}). Zona de posible rebote.`,
      });
    } else if (indicators.rsi > 75) {
      alerts.push({
        type: 'RSI_OVERBOUGHT',
        severity: 'CRITICAL',
        message: `RSI extremadamente sobrecomprado (${indicators.rsi.toFixed(1)}). Considerar toma de ganancias.`,
      });
    } else if (indicators.rsi > 70) {
      alerts.push({
        type: 'RSI_OVERBOUGHT',
        severity: 'WARNING',
        message: `RSI sobrecomprado (${indicators.rsi.toFixed(1)}). Posible corrección próxima.`,
      });
    }
  }

  // Bollinger Band alerts
  if (indicators.bollingerBands.lower && currentPrice < indicators.bollingerBands.lower) {
    alerts.push({
      type: 'BOLLINGER_BREAKOUT',
      severity: 'WARNING',
      message: 'Precio por debajo de banda Bollinger inferior. Posible reversión al alza.',
    });
  }
  if (indicators.bollingerBands.upper && currentPrice > indicators.bollingerBands.upper) {
    alerts.push({
      type: 'BOLLINGER_BREAKOUT',
      severity: 'WARNING',
      message: 'Precio por encima de banda Bollinger superior. Posible corrección.',
    });
  }

  // Support/Resistance alerts
  if (nearestLevels.distanceToSupport < 2) {
    alerts.push({
      type: 'NEAR_SUPPORT',
      severity: 'INFO',
      message: `Precio cerca de soporte (${nearestLevels.distanceToSupport.toFixed(1)}% por encima).`,
    });
  }
  if (nearestLevels.distanceToResistance < 2) {
    alerts.push({
      type: 'NEAR_RESISTANCE',
      severity: 'INFO',
      message: `Precio cerca de resistencia (${nearestLevels.distanceToResistance.toFixed(1)}% por debajo).`,
    });
  }

  // MACD alerts
  if (indicators.macd.histogram !== null && indicators.macd.histogram > 0) {
    alerts.push({
      type: 'MACD_BULLISH',
      severity: 'INFO',
      message: 'MACD muestra momentum alcista.',
    });
  } else if (indicators.macd.histogram !== null && indicators.macd.histogram < 0) {
    alerts.push({
      type: 'MACD_BEARISH',
      severity: 'INFO',
      message: 'MACD muestra momentum bajista.',
    });
  }

  // Signal alert
  if (indicators.signal === 'STRONG_BUY') {
    alerts.push({
      type: 'STRONG_BUY_SIGNAL',
      severity: 'CRITICAL',
      message: '🔥 Señal de COMPRA FUERTE detectada. Múltiples indicadores alineados.',
    });
  } else if (indicators.signal === 'BUY') {
    alerts.push({
      type: 'BUY_SIGNAL',
      severity: 'WARNING',
      message: 'Señal de compra detectada. Condiciones favorables.',
    });
  } else if (indicators.signal === 'STRONG_SELL') {
    alerts.push({
      type: 'STRONG_SELL_SIGNAL',
      severity: 'CRITICAL',
      message: '⚠️ Señal de VENTA FUERTE detectada. Considerar salir de posición.',
    });
  } else if (indicators.signal === 'SELL') {
    alerts.push({
      type: 'SELL_SIGNAL',
      severity: 'WARNING',
      message: 'Señal de venta detectada. Precaución.',
    });
  }

  return alerts;
}
