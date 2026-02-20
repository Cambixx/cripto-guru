import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketDataWithFallback, getOHLCData, SYMBOL_TO_COINGECKO } from '@/lib/crypto/apis';
import { performTechnicalAnalysis, findSupportResistance, getNearestLevels } from '@/lib/crypto/technical-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for cron jobs

/**
 * GET /api/cron/analyze
 * Cron job endpoint for periodic market analysis
 * Can be called by Vercel Cron Jobs or external schedulers
 *
 * Vercel Cron configuration (vercel.json):
 * Schedule: every 5 minutes
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify authorization (optional security measure)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Allow if no secret configured or if secret matches
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Still allow Vercel Cron Jobs (they don't send auth)
      const userAgent = request.headers.get('user-agent') || '';
      if (!userAgent.includes('vercel')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    console.log('[CRON] Starting market analysis...');
    
    // Fetch market data
    const marketData = await fetchMarketDataWithFallback();
    console.log(`[CRON] Fetched ${marketData.length} cryptocurrencies`);
    
    // Analyze top cryptos
    const topCryptos = marketData.slice(0, 20);
    const analysisResults = [];
    const alerts: Array<{
      cryptoId: string;
      symbol: string;
      type: string;
      message: string;
      severity: string;
    }> = [];
    
    for (const crypto of topCryptos) {
      try {
        // Get OHLC data
        const ohlcData = await getOHLCData(crypto.id, 'usd', 30);
        
        if (ohlcData.length < 50) continue;
        
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
        
        const currentPrice = candles[candles.length - 1].close;
        
        analysisResults.push({
          cryptoId: crypto.id,
          symbol: crypto.symbol.toUpperCase(),
          name: crypto.name,
          currentPrice,
          signal: analysis.signal,
          signalScore: analysis.signalScore,
          rsi: analysis.rsi,
          trend: analysis.trend,
          nearestSupport: nearest.nearestSupport?.price || null,
          nearestResistance: nearest.nearestResistance?.price || null,
        });
        
        // Generate alerts for significant signals
        if (analysis.signal === 'STRONG_BUY') {
          alerts.push({
            cryptoId: crypto.id,
            symbol: crypto.symbol.toUpperCase(),
            type: 'STRONG_BUY',
            message: `${crypto.symbol.toUpperCase()} muestra señal de COMPRA FUERTE. RSI: ${analysis.rsi?.toFixed(1)}, Precio: $${currentPrice.toFixed(2)}`,
            severity: 'CRITICAL',
          });
        } else if (analysis.signal === 'BUY') {
          alerts.push({
            cryptoId: crypto.id,
            symbol: crypto.symbol.toUpperCase(),
            type: 'BUY',
            message: `${crypto.symbol.toUpperCase()} muestra señal de compra. RSI: ${analysis.rsi?.toFixed(1)}`,
            severity: 'WARNING',
          });
        }
        
        // RSI alerts
        if (analysis.rsi !== null && analysis.rsi < 25) {
          alerts.push({
            cryptoId: crypto.id,
            symbol: crypto.symbol.toUpperCase(),
            type: 'RSI_OVERSOLD',
            message: `${crypto.symbol.toUpperCase()} RSI extremadamente sobrevendido: ${analysis.rsi.toFixed(1)}`,
            severity: 'CRITICAL',
          });
        }
        
        // Near support alert
        if (nearest.distanceToSupport < 2) {
          alerts.push({
            cryptoId: crypto.id,
            symbol: crypto.symbol.toUpperCase(),
            type: 'NEAR_SUPPORT',
            message: `${crypto.symbol.toUpperCase()} cerca de soporte (${nearest.distanceToSupport.toFixed(1)}%)`,
            severity: 'WARNING',
          });
        }
        
      } catch (error) {
        console.error(`[CRON] Error analyzing ${crypto.symbol}:`, error);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Log summary
    console.log(`[CRON] Analysis complete in ${duration}ms`);
    console.log(`[CRON] Generated ${alerts.length} alerts`);
    
    // Sort by signal score
    analysisResults.sort((a, b) => b.signalScore - a.signalScore);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      summary: {
        totalAnalyzed: analysisResults.length,
        strongBuys: analysisResults.filter(r => r.signal === 'STRONG_BUY').length,
        buys: analysisResults.filter(r => r.signal === 'BUY').length,
        strongSells: analysisResults.filter(r => r.signal === 'STRONG_SELL').length,
        sells: analysisResults.filter(r => r.signal === 'SELL').length,
      },
      topOpportunities: analysisResults
        .filter(r => r.signal === 'STRONG_BUY' || r.signal === 'BUY')
        .slice(0, 10),
      alerts,
      allResults: analysisResults,
    });
    
  } catch (error) {
    console.error('[CRON] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/analyze
 * Manual trigger for analysis (for testing)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
