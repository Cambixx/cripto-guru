import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketDataWithFallback, getOHLCData, SYMBOL_TO_COINGECKO } from '@/lib/crypto/apis';
import { performTechnicalAnalysis, getNearestLevels, findSupportResistance } from '@/lib/crypto/technical-analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/**
 * GET /api/crypto/market
 * Get market data for all cryptocurrencies
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '50');
    
    const marketData = await fetchMarketDataWithFallback();
    
    return NextResponse.json({
      success: true,
      data: {
        cryptocurrencies: marketData,
        pagination: {
          page,
          perPage,
          total: marketData.length,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Market API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch market data' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crypto/market
 * Get analysis for specific cryptocurrencies
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols, days = 30 } = body as { symbols: string[]; days?: number };
    
    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json(
        { success: false, error: 'Symbols array is required' },
        { status: 400 }
      );
    }
    
    const results = await Promise.all(
      symbols.slice(0, 10).map(async (symbol) => {
        try {
          const coingeckoId = SYMBOL_TO_COINGECKO[symbol.toUpperCase()] || symbol.toLowerCase();
          const ohlcData = await getOHLCData(coingeckoId, 'usd', days);
          
          if (ohlcData.length < 50) {
            return {
              symbol,
              error: 'Not enough data for analysis',
            };
          }
          
          const candles = ohlcData.map((ohlc) => ({
            timestamp: ohlc.timestamp,
            open: ohlc.open,
            high: ohlc.high,
            low: ohlc.low,
            close: ohlc.close,
            volume: 0, // OHLC doesn't include volume
          }));
          
          const analysis = performTechnicalAnalysis(candles);
          const supportResistance = findSupportResistance(candles);
          const nearest = getNearestLevels(
            candles[candles.length - 1].close,
            supportResistance
          );
          
          return {
            symbol,
            currentPrice: candles[candles.length - 1].close,
            analysis,
            supportResistance: {
              nearestSupport: nearest.nearestSupport?.price || null,
              nearestResistance: nearest.nearestResistance?.price || null,
              distanceToSupport: nearest.distanceToSupport,
              distanceToResistance: nearest.distanceToResistance,
            },
            recommendation: generateRecommendation(analysis, nearest),
          };
        } catch (err) {
          return {
            symbol,
            error: err instanceof Error ? err.message : 'Analysis failed',
          };
        }
      })
    );
    
    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
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
 * Generate buy/sell recommendation
 */
function generateRecommendation(
  analysis: ReturnType<typeof performTechnicalAnalysis>,
  nearest: ReturnType<typeof getNearestLevels>
): { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  
  // RSI signals
  if (analysis.rsi !== null) {
    if (analysis.rsi < 25) {
      reasons.push('RSI muy sobrevendido');
      score += 3;
    } else if (analysis.rsi < 35) {
      reasons.push('RSI sobrevendido');
      score += 2;
    } else if (analysis.rsi > 75) {
      reasons.push('RSI muy sobrecomprado');
      score -= 3;
    } else if (analysis.rsi > 65) {
      reasons.push('RSI sobrecomprado');
      score -= 2;
    }
  }
  
  // MACD signals
  if (analysis.macd.histogram !== null && analysis.macd.histogram > 0) {
    reasons.push('MACD alcista');
    score += 1;
  } else if (analysis.macd.histogram !== null && analysis.macd.histogram < 0) {
    reasons.push('MACD bajista');
    score -= 1;
  }
  
  // Bollinger Bands
  if (analysis.bollingerBands.lower && analysis.bollingerBands.middle) {
    const currentPrice = analysis.supportResistance.pivot * 0.99; // Approximate
    if (currentPrice < analysis.bollingerBands.lower) {
      reasons.push('Precio bajo banda Bollinger inferior');
      score += 2;
    }
  }
  
  // Support/Resistance
  if (nearest.distanceToSupport < 3) {
    reasons.push('Cerca de soporte');
    score += 2;
  }
  if (nearest.distanceToResistance < 3) {
    reasons.push('Cerca de resistencia');
    score -= 2;
  }
  
  // Trend
  if (analysis.trend === 'BULLISH') {
    reasons.push('Tendencia alcista');
    score += 1;
  } else if (analysis.trend === 'BEARISH') {
    reasons.push('Tendencia bajista');
    score -= 1;
  }
  
  // Determine action
  let action: 'BUY' | 'SELL' | 'HOLD';
  if (score >= 4) action = 'BUY';
  else if (score <= -4) action = 'SELL';
  else action = 'HOLD';
  
  const confidence = Math.min(1, Math.abs(score) / 6);
  
  return { action, confidence, reasons };
}
