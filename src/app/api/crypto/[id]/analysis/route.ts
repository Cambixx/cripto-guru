// Technical Analysis API Route
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBinanceKlines } from '@/lib/crypto-apis'
import { performCompleteAnalysis, type AnalysisResult } from '@/lib/technical-analysis'
import ZAI from 'z-ai-web-dev-sdk'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Fetch technical analysis for a cryptocurrency
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: cryptoId } = await params
    const searchParams = request.nextUrl.searchParams
    const useAI = searchParams.get('ai') === 'true'
    
    // Get crypto info
    const crypto = await db.cryptocurrency.findUnique({
      where: { id: cryptoId }
    })
    
    if (!crypto) {
      return NextResponse.json({ error: 'Cryptocurrency not found' }, { status: 404 })
    }
    
    // Get price history
    const priceHistory = await db.priceHistory.findMany({
      where: { cryptoId },
      orderBy: { timestamp: 'asc' },
      take: 200
    })
    
    // If not enough data, fetch from API
    let ohlcvData = priceHistory.map(h => ({
      timestamp: h.timestamp,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume || 0
    }))
    
    if (ohlcvData.length < 50) {
      try {
        const klines = await getBinanceKlines(crypto.symbol, '1d', 100)
        ohlcvData = klines
      } catch (error) {
        console.error('Failed to fetch klines:', error)
      }
    }
    
    // Perform technical analysis
    const analysis = performCompleteAnalysis(ohlcvData)
    
    // Save technical indicators to database
    await db.technicalIndicator.upsert({
      where: {
        // Create a unique constraint approach
        id: `${cryptoId}-latest`
      },
      create: {
        id: `${cryptoId}-latest`,
        cryptoId,
        rsi: analysis.indicators.rsi,
        macd: analysis.indicators.macd,
        macdSignal: analysis.indicators.macdSignal,
        macdHistogram: analysis.indicators.macdHistogram,
        bollingerUpper: analysis.indicators.bollingerUpper,
        bollingerMiddle: analysis.indicators.bollingerMiddle,
        bollingerLower: analysis.indicators.bollingerLower,
        ema20: analysis.indicators.ema20,
        ema50: analysis.indicators.ema50,
        ema200: analysis.indicators.ema200,
        support: analysis.indicators.support,
        resistance: analysis.indicators.resistance,
        volumeProfile: analysis.indicators.volumeProfile,
        relativeVolume: analysis.indicators.relativeVolume
      },
      update: {
        rsi: analysis.indicators.rsi,
        macd: analysis.indicators.macd,
        macdSignal: analysis.indicators.macdSignal,
        macdHistogram: analysis.indicators.macdHistogram,
        bollingerUpper: analysis.indicators.bollingerUpper,
        bollingerMiddle: analysis.indicators.bollingerMiddle,
        bollingerLower: analysis.indicators.bollingerLower,
        ema20: analysis.indicators.ema20,
        ema50: analysis.indicators.ema50,
        ema200: analysis.indicators.ema200,
        support: analysis.indicators.support,
        resistance: analysis.indicators.resistance,
        volumeProfile: analysis.indicators.volumeProfile,
        relativeVolume: analysis.indicators.relativeVolume
      }
    })
    
    // AI-powered analysis if requested
    let aiAnalysis = null
    if (useAI) {
      try {
        const zai = await ZAI.create()
        const prompt = `Analyze the following cryptocurrency data and provide a brief market analysis:

Cryptocurrency: ${crypto.name} (${crypto.symbol})
Current Price: $${crypto.currentPrice}
24h Change: ${crypto.priceChangePercent24h?.toFixed(2) || 0}%
Market Cap: $${crypto.marketCap?.toLocaleString() || 'N/A'}
24h Volume: $${crypto.volume24h?.toLocaleString() || 'N/A'}

Technical Indicators:
- RSI (14): ${analysis.indicators.rsi?.toFixed(2) || 'N/A'}
- MACD: ${analysis.indicators.macd?.toFixed(4) || 'N/A'}
- MACD Signal: ${analysis.indicators.macdSignal?.toFixed(4) || 'N/A'}
- MACD Histogram: ${analysis.indicators.macdHistogram?.toFixed(4) || 'N/A'}
- Bollinger Upper: $${analysis.indicators.bollingerUpper?.toFixed(2) || 'N/A'}
- Bollinger Lower: $${analysis.indicators.bollingerLower?.toFixed(2) || 'N/A'}
- EMA 20: $${analysis.indicators.ema20?.toFixed(2) || 'N/A'}
- EMA 50: $${analysis.indicators.ema50?.toFixed(2) || 'N/A'}
- EMA 200: $${analysis.indicators.ema200?.toFixed(2) || 'N/A'}
- Trend: ${analysis.indicators.trend}
- Support: $${analysis.indicators.support?.toFixed(2) || 'N/A'}
- Resistance: $${analysis.indicators.resistance?.toFixed(2) || 'N/A'}

Current Signal: ${analysis.action} with ${analysis.confidence}% confidence

Provide a concise 2-3 sentence analysis with your opinion on the current market position and potential trading strategy.`

        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a professional cryptocurrency market analyst. Provide concise, actionable analysis.' },
            { role: 'user', content: prompt }
          ]
        })
        
        aiAnalysis = completion.choices[0]?.message?.content || null
        
        // Save analysis log
        await db.analysisLog.create({
          data: {
            cryptoId,
            action: analysis.action,
            analysis: aiAnalysis || analysis.recommendation,
            recommendation: `${analysis.action} with ${analysis.confidence}% confidence`,
            confidence: analysis.confidence / 100,
            indicators: JSON.stringify(analysis.indicators)
          }
        })
      } catch (error) {
        console.error('AI analysis error:', error)
      }
    }
    
    const response: AnalysisResult & { symbol: string; aiAnalysis?: string | null } = {
      ...analysis,
      symbol: crypto.symbol,
      aiAnalysis
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in analysis API:', error)
    return NextResponse.json(
      { error: 'Failed to perform analysis' },
      { status: 500 }
    )
  }
}
