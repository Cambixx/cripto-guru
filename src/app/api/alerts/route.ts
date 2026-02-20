import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory alert store (replace with database in production)
let alertStore: Array<{
  id: string;
  cryptoId: string;
  symbol: string;
  type: string;
  severity: string;
  message: string;
  triggerPrice?: number;
  targetPrice?: number;
  triggered: boolean;
  triggeredAt?: Date;
  acknowledged: boolean;
  createdAt: Date;
}> = [];

let alertConfigStore: Array<{
  id: string;
  cryptoId: string;
  enabled: boolean;
  buyThresholdPercent: number;
  sellThresholdPercent: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  rsiOversold: number;
  rsiOverbought: number;
}> = [];

/**
 * GET /api/alerts
 * Get all alerts
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const onlyUnread = searchParams.get('unread') === 'true';
  const cryptoId = searchParams.get('cryptoId');
  
  let alerts = [...alertStore];
  
  if (onlyUnread) {
    alerts = alerts.filter(a => !a.acknowledged);
  }
  
  if (cryptoId) {
    alerts = alerts.filter(a => a.cryptoId === cryptoId);
  }
  
  // Sort by date, newest first
  alerts.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return NextResponse.json({
    success: true,
    data: {
      alerts,
      unreadCount: alertStore.filter(a => !a.acknowledged).length,
      configs: alertConfigStore,
    },
  });
}

/**
 * POST /api/alerts
 * Create a new alert or config
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if it's a config update
    if (body.type === 'config') {
      const configIndex = alertConfigStore.findIndex(c => c.cryptoId === body.cryptoId);
      
      const config = {
        id: configIndex >= 0 ? alertConfigStore[configIndex].id : `cfg_${Date.now()}`,
        cryptoId: body.cryptoId,
        enabled: body.enabled ?? true,
        buyThresholdPercent: body.buyThresholdPercent ?? 10,
        sellThresholdPercent: body.sellThresholdPercent ?? 10,
        stopLossPercent: body.stopLossPercent ?? 5,
        takeProfitPercent: body.takeProfitPercent ?? 20,
        rsiOversold: body.rsiOversold ?? 30,
        rsiOverbought: body.rsiOverbought ?? 70,
      };
      
      if (configIndex >= 0) {
        alertConfigStore[configIndex] = config;
      } else {
        alertConfigStore.push(config);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Alert configuration saved',
        data: config,
      });
    }
    
    // Regular alert creation
    const alert = {
      id: `alert_${Date.now()}`,
      cryptoId: body.cryptoId,
      symbol: body.symbol,
      type: body.type,
      severity: body.severity || 'INFO',
      message: body.message,
      triggerPrice: body.triggerPrice,
      targetPrice: body.targetPrice,
      triggered: false,
      acknowledged: false,
      createdAt: new Date(),
    };
    
    alertStore.push(alert);
    
    return NextResponse.json({
      success: true,
      message: 'Alert created',
      data: alert,
    });
    
  } catch (error) {
    console.error('Alert POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/alerts
 * Update alert status (acknowledge)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, acknowledged } = body;
    
    const alertIndex = alertStore.findIndex(a => a.id === id);
    
    if (alertIndex < 0) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }
    
    alertStore[alertIndex] = {
      ...alertStore[alertIndex],
      acknowledged: acknowledged ?? true,
    };
    
    return NextResponse.json({
      success: true,
      message: 'Alert updated',
      data: alertStore[alertIndex],
    });
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alerts
 * Clear all alerts or specific alert
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const clearAll = searchParams.get('all') === 'true';
  
  if (clearAll) {
    alertStore = [];
    return NextResponse.json({
      success: true,
      message: 'All alerts cleared',
    });
  }
  
  if (id) {
    alertStore = alertStore.filter(a => a.id !== id);
    return NextResponse.json({
      success: true,
      message: 'Alert deleted',
    });
  }
  
  return NextResponse.json(
    { success: false, error: 'Specify id or all=true' },
    { status: 400 }
  );
}
