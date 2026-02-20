import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketDataWithFallback, getOHLCData, SYMBOL_TO_COINGECKO, getBestOHLCData, getBinanceTicker24h } from '@/lib/crypto/apis';
import { performTechnicalAnalysis, findSupportResistance, getNearestLevels } from '@/lib/crypto/technical-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/crypto/scan
 * Scan market for buy/sell opportunities
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      minMarketCap = 0,
      maxMarketCap = Infinity,
      minVolume = 0,
      rsiRange = [0, 100],
      signalFilter = ['STRONG_BUY', 'BUY'],
      limit = 20,
    } = body || {};

    // Fetch market data
    const marketData = await fetchMarketDataWithFallback();

    // Fetch Binance tickers to filter only available coins
    const binanceTickers = await getBinanceTicker24h();
    const binanceSymbols = new Set(binanceTickers.map((t: any) => t.symbol));

    // Filter by market criteria AND presence on Binance
    const filtered = marketData.filter((crypto) => {
      const bSymbol = `${crypto.symbol.toUpperCase()}USDT`;
      if (!binanceSymbols.has(bSymbol)) return false;
      if ((crypto.market_cap || 0) < minMarketCap) return false;
      if ((crypto.market_cap || 0) > maxMarketCap) return false;
      if ((crypto.total_volume || 0) < minVolume) return false;
      return true;
    });

    // Analyze top cryptos (limit to 40 for more comprehensive scanning)
    const toAnalyze = filtered.slice(0, 40);

    const opportunities: any[] = [];

    // Process sequentially with small delays to respect Coingecko rate limits
    // and avoid 500 errors due to concurrent DB/API pressure
    for (const crypto of toAnalyze) {
      try {
        console.log(`[SCAN] Analyzing ${crypto.symbol}...`);

        // Get historical data using optimized hybrid function
        const ohlcData = await getBestOHLCData(crypto.id, crypto.symbol, 30);

        if (!ohlcData || ohlcData.length < 50) {
          console.log(`[SCAN] Skip ${crypto.symbol}: not enough candles (${ohlcData?.length || 0})`);
          continue;
        }

        const candles = ohlcData.map((ohlc) => ({
          timestamp: ohlc.timestamp,
          open: ohlc.open,
          high: ohlc.high,
          low: ohlc.low,
          close: ohlc.close,
          volume: 0,
        }));

        // Perform analysis
        const analysis = performTechnicalAnalysis(candles);
        const supportResistance = findSupportResistance(candles);
        const nearest = getNearestLevels(
          candles[candles.length - 1].close,
          supportResistance
        );

        const lastPrice = candles[candles.length - 1].close;
        const priceChangePercent = crypto.price_change_percentage_24h || 0;

        // Check if passes filters
        if (analysis.rsi !== null) {
          if (analysis.rsi < rsiRange[0] || analysis.rsi > rsiRange[1]) {
            continue;
          }
        }

        if (!signalFilter.includes(analysis.signal)) {
          continue;
        }

        // Generate triggers
        const triggers: string[] = [];
        if (analysis.rsi !== null && analysis.rsi < 35) triggers.push(`RSI sobrevendido (${analysis.rsi.toFixed(1)})`);
        if (analysis.bollingerBands.lower && lastPrice < analysis.bollingerBands.lower) triggers.push('Precio bajo banda Bollinger inferior');
        if (analysis.macd.histogram !== null && analysis.macd.histogram > 0) triggers.push('MACD alcista');
        if (nearest.distanceToSupport < 5) triggers.push(`Cerca de soporte (${nearest.distanceToSupport.toFixed(1)}%)`);
        if (analysis.signal === 'STRONG_BUY') triggers.push('Señal fuerte de compra');

        // Calculate confidence
        let confidence = 0;
        if (analysis.rsi !== null && analysis.rsi < 30) confidence += 0.2;
        if (nearest.distanceToSupport < 3) confidence += 0.2;
        if (analysis.macd.histogram !== null && analysis.macd.histogram > 0) confidence += 0.15;
        if (analysis.signal === 'STRONG_BUY') confidence += 0.25;
        if (analysis.trend === 'BULLISH') confidence += 0.1;
        if (analysis.volume.ratio !== null && analysis.volume.ratio > 1.5) confidence += 0.1;
        confidence = Math.min(1, confidence);

        opportunities.push({
          cryptoId: crypto.id,
          symbol: crypto.symbol.toUpperCase(),
          name: crypto.name,
          imageUrl: crypto.image,
          currentPrice: lastPrice,
          priceChange24h: crypto.price_change_24h || 0,
          priceChangePercent24h: priceChangePercent,
          marketCap: crypto.market_cap,
          volume24h: crypto.total_volume,
          rsi: analysis.rsi,
          signal: analysis.signal,
          signalScore: analysis.signalScore,
          trend: analysis.trend,
          distanceFromLow: ((lastPrice - crypto.low_24h!) / lastPrice) * 100,
          distanceFromSupport: nearest.distanceToSupport,
          distanceFromResistance: nearest.distanceToResistance,
          nearestSupport: nearest.nearestSupport?.price || null,
          nearestResistance: nearest.nearestResistance?.price || null,
          volumeRatio: analysis.volume.ratio,
          triggers,
          recommendation: generateRecommendation(analysis, nearest, priceChangePercent),
          confidence,
        });

        // Very tiny delay to not bombard the connection pool
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        console.error(`Error analyzing ${crypto.symbol}:`, error);
      }
    }

    // Filter out nulls and sort by signal score
    const validOpportunities = opportunities
      .filter(Boolean)
      .sort((a, b) => (b?.signalScore || 0) - (a?.signalScore || 0))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        opportunities: validOpportunities,
        scanned: toAnalyze.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('CRITICAL: Scan API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Scan failed',
        details: 'Check server logs for database connection issues or rate limits'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate recommendation text
 */
function generateRecommendation(
  analysis: ReturnType<typeof performTechnicalAnalysis>,
  nearest: ReturnType<typeof getNearestLevels>,
  priceChangePercent: number
): string {
  const parts: string[] = [];

  if (analysis.signal === 'STRONG_BUY') {
    parts.push('🟢 OPORTUNIDAD DE COMPRA FUERTE');
  } else if (analysis.signal === 'BUY') {
    parts.push('🟡 Posible oportunidad de compra');
  } else {
    parts.push('⚪ Sin señal clara');
  }

  if (analysis.rsi !== null && analysis.rsi < 30) {
    parts.push(`RSI indica zona de sobrevendido (${analysis.rsi.toFixed(1)})`);
  }

  if (nearest.distanceToSupport < 3) {
    parts.push(`Precio cerca de soporte principal`);
  }

  if (priceChangePercent < -10) {
    parts.push(`Caída significativa del ${Math.abs(priceChangePercent).toFixed(1)}% en 24h`);
  }

  return parts.join('. ');
}
