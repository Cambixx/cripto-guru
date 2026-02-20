// Alert Configuration API Route
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Configure alert settings for a cryptocurrency
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      cryptoId,
      enabled = true,
      buyThresholdPercent,
      sellThresholdPercent,
      stopLossPercent,
      takeProfitPercent,
      rsiOversold = 30,
      rsiOverbought = 70,
      priceTargetUp,
      priceTargetDown
    } = body
    
    if (!cryptoId) {
      return NextResponse.json({ error: 'cryptoId is required' }, { status: 400 })
    }
    
    // Verify crypto exists
    const crypto = await db.cryptocurrency.findUnique({
      where: { id: cryptoId }
    })
    
    if (!crypto) {
      return NextResponse.json({ error: 'Cryptocurrency not found' }, { status: 404 })
    }
    
    // Upsert alert config
    const config = await db.alertConfig.upsert({
      where: { cryptoId },
      create: {
        cryptoId,
        enabled,
        buyThresholdPercent,
        sellThresholdPercent,
        stopLossPercent,
        takeProfitPercent,
        rsiOversold,
        rsiOverbought,
        priceTargetUp,
        priceTargetDown
      },
      update: {
        enabled,
        buyThresholdPercent,
        sellThresholdPercent,
        stopLossPercent,
        takeProfitPercent,
        rsiOversold,
        rsiOverbought,
        priceTargetUp,
        priceTargetDown
      }
    })
    
    return NextResponse.json({
      success: true,
      config
    })
  } catch (error) {
    console.error('Error configuring alert:', error)
    return NextResponse.json(
      { error: 'Failed to configure alert' },
      { status: 500 }
    )
  }
}

// GET - Get alert configurations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cryptoId = searchParams.get('cryptoId')
    
    const whereClause: Record<string, unknown> = {}
    if (cryptoId) {
      whereClause.cryptoId = cryptoId
    }
    
    const configs = await db.alertConfig.findMany({
      where: whereClause,
      include: {
        crypto: {
          select: {
            symbol: true,
            name: true,
            currentPrice: true,
            imageUrl: true
          }
        }
      }
    })
    
    return NextResponse.json({ configs })
  } catch (error) {
    console.error('Error fetching alert configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alert configurations', configs: [] },
      { status: 500 }
    )
  }
}

// DELETE - Delete an alert configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const cryptoId = searchParams.get('cryptoId')
    
    if (id) {
      await db.alertConfig.delete({ where: { id } })
    } else if (cryptoId) {
      await db.alertConfig.delete({ where: { cryptoId } })
    } else {
      return NextResponse.json({ error: 'ID or cryptoId required' }, { status: 400 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting alert config:', error)
    return NextResponse.json(
      { error: 'Failed to delete alert configuration' },
      { status: 500 }
    )
  }
}
