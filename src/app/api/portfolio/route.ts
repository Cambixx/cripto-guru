import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory store for demo (replace with database in production)
let portfolioStore: Array<{
  id: string;
  cryptoId: string;
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  totalInvested: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: Date;
}> = [];

let transactionStore: Array<{
  id: string;
  portfolioId: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  price: number;
  total: number;
  timestamp: Date;
}> = [];

/**
 * GET /api/portfolio
 * Get current portfolio
 */
export async function GET() {
  try {
    // Fetch current prices for portfolio items
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?' + 
      `ids=${portfolioStore.map(p => p.cryptoId).join(',')}&vs_currencies=usd`
    );
    
    const prices = await response.json();
    
    // Calculate current values
    const portfolio = portfolioStore.map(position => {
      const currentPrice = prices[position.cryptoId]?.usd || position.avgBuyPrice;
      const currentValue = position.quantity * currentPrice;
      const profitLoss = currentValue - position.totalInvested;
      const profitLossPercent = (profitLoss / position.totalInvested) * 100;
      
      return {
        ...position,
        currentPrice,
        currentValue,
        profitLoss,
        profitLossPercent,
      };
    });
    
    const totalInvested = portfolio.reduce((sum, p) => sum + p.totalInvested, 0);
    const totalValue = portfolio.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnL = totalValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    return NextResponse.json({
      success: true,
      data: {
        positions: portfolio,
        transactions: transactionStore.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
        summary: {
          totalPositions: portfolio.length,
          totalInvested,
          totalValue,
          totalPnL,
          totalPnLPercent,
        },
      },
    });
  } catch (error) {
    console.error('Portfolio GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio
 * Add or update portfolio position
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cryptoId, symbol, quantity, price, type = 'BUY', stopLoss, takeProfit } = body;
    
    if (!cryptoId || !symbol || !quantity || !price) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const total = quantity * price;
    const existingIndex = portfolioStore.findIndex(p => p.cryptoId === cryptoId);
    
    if (type === 'BUY') {
      if (existingIndex >= 0) {
        // Update existing position
        const existing = portfolioStore[existingIndex];
        const newQuantity = existing.quantity + quantity;
        const newTotalInvested = existing.totalInvested + total;
        const newAvgPrice = newTotalInvested / newQuantity;
        
        portfolioStore[existingIndex] = {
          ...existing,
          quantity: newQuantity,
          avgBuyPrice: newAvgPrice,
          totalInvested: newTotalInvested,
          stopLoss: stopLoss || existing.stopLoss,
          takeProfit: takeProfit || existing.takeProfit,
        };
      } else {
        // Create new position
        portfolioStore.push({
          id: `pos_${Date.now()}`,
          cryptoId,
          symbol: symbol.toUpperCase(),
          quantity,
          avgBuyPrice: price,
          totalInvested: total,
          stopLoss,
          takeProfit,
          createdAt: new Date(),
        });
      }
      
      // Record transaction
      transactionStore.push({
        id: `tx_${Date.now()}`,
        portfolioId: existingIndex >= 0 ? portfolioStore[existingIndex].id : portfolioStore[portfolioStore.length - 1].id,
        type: 'BUY',
        symbol: symbol.toUpperCase(),
        quantity,
        price,
        total,
        timestamp: new Date(),
      });
      
    } else if (type === 'SELL') {
      if (existingIndex < 0) {
        return NextResponse.json(
          { success: false, error: 'Position not found' },
          { status: 404 }
        );
      }
      
      const existing = portfolioStore[existingIndex];
      
      if (existing.quantity < quantity) {
        return NextResponse.json(
          { success: false, error: 'Insufficient quantity' },
          { status: 400 }
        );
      }
      
      // Record transaction
      transactionStore.push({
        id: `tx_${Date.now()}`,
        portfolioId: existing.id,
        type: 'SELL',
        symbol: symbol.toUpperCase(),
        quantity,
        price,
        total,
        timestamp: new Date(),
      });
      
      // Update or remove position
      const newQuantity = existing.quantity - quantity;
      if (newQuantity <= 0) {
        portfolioStore.splice(existingIndex, 1);
      } else {
        const sellRatio = quantity / existing.quantity;
        portfolioStore[existingIndex] = {
          ...existing,
          quantity: newQuantity,
          totalInvested: existing.totalInvested * (1 - sellRatio),
        };
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Posición ${type === 'BUY' ? 'añadida' : 'vendida'} correctamente`,
      data: {
        type,
        symbol: symbol.toUpperCase(),
        quantity,
        price,
        total,
      },
    });
    
  } catch (error) {
    console.error('Portfolio POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update portfolio' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portfolio
 * Remove a position
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cryptoId = searchParams.get('cryptoId');
    
    if (!cryptoId) {
      return NextResponse.json(
        { success: false, error: 'cryptoId is required' },
        { status: 400 }
      );
    }
    
    const index = portfolioStore.findIndex(p => p.cryptoId === cryptoId);
    if (index >= 0) {
      portfolioStore.splice(index, 1);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Position removed',
    });
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to remove position' },
      { status: 500 }
    );
  }
}
