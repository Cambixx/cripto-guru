// Price History API Route
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBinanceKlines, getCryptoOHLC } from '@/lib/crypto-apis'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Fetch price history for a cryptocurrency
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: cryptoId } = await params
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    
    // Get crypto info
    const crypto = await db.cryptocurrency.findUnique({
      where: { id: cryptoId }
    })
    
    if (!crypto) {
      return NextResponse.json({ error: 'Cryptocurrency not found' }, { status: 404 })
    }
    
    // Check database for existing history
    const existingHistory = await db.priceHistory.findMany({
      where: { cryptoId },
      orderBy: { timestamp: 'desc' },
      take: days
    })
    
    // If we have enough recent data, return it
    if (existingHistory.length >= days) {
      return NextResponse.json({
        history: existingHistory.reverse().map(h => ({
          timestamp: h.timestamp,
          open: h.open,
          high: h.high,
          low: h.low,
          close: h.close,
          volume: h.volume
        })),
        symbol: crypto.symbol,
        cached: true
      })
    }
    
    // Fetch fresh data from APIs
    let ohlcvData: Array<{
      timestamp: Date
      open: number
      high: number
      low: number
      close: number
      volume: number
    }> = []
    
    // Try Binance first
    try {
      const klines = await getBinanceKlines(crypto.symbol, '1d', days)
      ohlcvData = klines
    } catch {
      // Fallback to CoinGecko
      try {
        const ohlc = await getCryptoOHLC(crypto.symbol.toLowerCase(), days)
        ohlcvData = ohlc.map(o => ({
          timestamp: new Date(o.timestamp),
          open: o.open,
          high: o.high,
          low: o.low,
          close: o.close,
          volume: 0
        }))
      } catch (error) {
        console.error('Failed to fetch OHLCV data:', error)
      }
    }
    
    // Save to database
    if (ohlcvData.length > 0) {
      // Clear old data first
      await db.priceHistory.deleteMany({
        where: { cryptoId }
      })
      
      // Insert new data
      await db.priceHistory.createMany({
        data: ohlcvData.map(d => ({
          cryptoId,
          timestamp: d.timestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume
        }))
      })
    }
    
    return NextResponse.json({
      history: ohlcvData,
      symbol: crypto.symbol,
      cached: false
    })
  } catch (error) {
    console.error('Error in history API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price history', history: [] },
      { status: 500 }
    )
  }
}
