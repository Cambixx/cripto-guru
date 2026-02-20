// Portfolio Sell Route
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Record a sell transaction
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
    
    // Find cryptocurrency
    const crypto = await db.cryptocurrency.findFirst({
      where: { symbol: symbol.toUpperCase() }
    })
    
    if (!crypto) {
      return NextResponse.json(
        { error: 'Cryptocurrency not found in portfolio' },
        { status: 404 }
      )
    }
    
    // Find portfolio entry
    const portfolio = await db.portfolio.findFirst({
      where: { cryptoId: crypto.id }
    })
    
    if (!portfolio) {
      return NextResponse.json(
        { error: 'No position found for this cryptocurrency' },
        { status: 404 }
      )
    }
    
    if (portfolio.quantity < quantity) {
      return NextResponse.json(
        { error: `Insufficient quantity. Available: ${portfolio.quantity}` },
        { status: 400 }
      )
    }
    
    const newQuantity = portfolio.quantity - quantity
    const avgPrice = portfolio.avgBuyPrice
    const realizedPL = (price - avgPrice) * quantity
    
    let updatedPortfolio
    
    if (newQuantity <= 0) {
      // Close position completely
      await db.portfolioTransaction.create({
        data: {
          portfolioId: portfolio.id,
          type: 'SELL',
          quantity,
          price,
          total,
          notes: `${notes || ''} | Realized P/L: $${realizedPL.toFixed(2)}`
        }
      })
      
      await db.portfolio.delete({
        where: { id: portfolio.id }
      })
      
      updatedPortfolio = null
    } else {
      // Partial sell - reduce position
      const soldValue = quantity * avgPrice
      const newTotalInvested = portfolio.totalInvested - soldValue
      
      updatedPortfolio = await db.portfolio.update({
        where: { id: portfolio.id },
        data: {
          quantity: newQuantity,
          totalInvested: newTotalInvested,
          updatedAt: new Date()
        }
      })
      
      // Record transaction
      await db.portfolioTransaction.create({
        data: {
          portfolioId: portfolio.id,
          type: 'SELL',
          quantity,
          price,
          total,
          notes: `${notes || ''} | Realized P/L: $${realizedPL.toFixed(2)}`
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      portfolio: updatedPortfolio,
      transaction: {
        type: 'SELL',
        symbol: symbol.toUpperCase(),
        quantity,
        price,
        total,
        realizedPL
      }
    })
  } catch (error) {
    console.error('Error recording sell:', error)
    return NextResponse.json(
      { error: 'Failed to record sell transaction' },
      { status: 500 }
    )
  }
}
