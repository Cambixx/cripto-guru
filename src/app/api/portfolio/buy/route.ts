// Portfolio Buy Route
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Record a buy transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbol, quantity, price, notes } = body
    
    if (!symbol || !quantity || !price) {
      return NextResponse.json(
        { error: 'Symbol, quantity, and price are required' },
        { status: 400 }
      )
    }
    
    const total = quantity * price
    
    // Find or create cryptocurrency
    let crypto = await db.cryptocurrency.findFirst({
      where: { symbol: symbol.toUpperCase() }
    })
    
    if (!crypto) {
      // Create a basic crypto entry if it doesn't exist
      crypto = await db.cryptocurrency.create({
        data: {
          symbol: symbol.toUpperCase(),
          name: symbol.toUpperCase(),
          currentPrice: price,
          lastUpdated: new Date()
        }
      })
    }
    
    // Check if portfolio entry exists
    const existingPortfolio = await db.portfolio.findFirst({
      where: { cryptoId: crypto.id }
    })
    
    let portfolio
    
    if (existingPortfolio) {
      // Update existing position (average cost)
      const newQuantity = existingPortfolio.quantity + quantity
      const newTotalInvested = existingPortfolio.totalInvested + total
      const newAvgPrice = newTotalInvested / newQuantity
      
      portfolio = await db.portfolio.update({
        where: { id: existingPortfolio.id },
        data: {
          quantity: newQuantity,
          avgBuyPrice: newAvgPrice,
          totalInvested: newTotalInvested,
          updatedAt: new Date()
        }
      })
      
      // Record transaction
      await db.portfolioTransaction.create({
        data: {
          portfolioId: existingPortfolio.id,
          type: 'BUY',
          quantity,
          price,
          total,
          notes
        }
      })
    } else {
      // Create new portfolio entry
      portfolio = await db.portfolio.create({
        data: {
          cryptoId: crypto.id,
          symbol: symbol.toUpperCase(),
          quantity,
          avgBuyPrice: price,
          totalInvested: total
        }
      })
      
      // Record transaction
      await db.portfolioTransaction.create({
        data: {
          portfolioId: portfolio.id,
          type: 'BUY',
          quantity,
          price,
          total,
          notes
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      portfolio,
      transaction: {
        type: 'BUY',
        symbol: symbol.toUpperCase(),
        quantity,
        price,
        total
      }
    })
  } catch (error) {
    console.error('Error recording buy:', error)
    return NextResponse.json(
      { error: 'Failed to record buy transaction' },
      { status: 500 }
    )
  }
}
