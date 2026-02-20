// ==================== COINGECKO API TYPES ====================

export interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d: number | null;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  sparkline_in_7d?: { price: number[] };
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
}

export interface CoinGeckoOHLC {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CoinGeckoPrice {
  [coinId: string]: {
    [currency: string]: number;
  };
}

export interface CoinGeckoMarketChart {
  prices: [number, number][];  // [timestamp, price]
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface CoinGeckoTrending {
  coins: Array<{
    item: {
      id: string;
      coin_id: number;
      name: string;
      symbol: string;
      market_cap_rank: number;
      thumb: string;
      small: string;
      large: string;
      slug: string;
      price_btc: number;
      score: number;
      data: {
        price: number;
        price_btc: string;
        price_change_percentage_24h: {
          [currency: string]: number;
        };
        market_cap: string;
        market_cap_btc: string;
        total_volume: string;
        total_volume_btc: string;
        sparkline: string;
      };
    };
  }>;
}

// ==================== BINANCE API TYPES ====================

export interface BinanceTicker24h {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  ignored: string;
}

export interface BinanceExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: Array<{
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
  }>;
  symbols: Array<{
    symbol: string;
    status: string;
    baseAsset: string;
    baseAssetPrecision: number;
    quoteAsset: string;
    quotePrecision: number;
    quoteAssetPrecision: number;
  }>;
}

// ==================== TECHNICAL ANALYSIS TYPES ====================

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number | null;
  macd: {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
  };
  bollingerBands: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
    width: number | null;
  };
  movingAverages: {
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
  };
  volume: {
    sma20: number | null;
    ratio: number | null;
  };
  supportResistance: {
    support1: number | null;
    support2: number | null;
    resistance1: number | null;
    resistance2: number | null;
    pivot: number | null;
  };
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  signalScore: number; // -100 to 100
}

export interface PriceLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number; // 1-5
  touches: number;
  lastTouch: number;
}

export interface SupportResistanceLevels {
  supports: PriceLevel[];
  resistances: PriceLevel[];
  pivotPoint: number;
}

// ==================== ALERT TYPES ====================

export type AlertType = 
  | 'BUY_SIGNAL' 
  | 'SELL_SIGNAL' 
  | 'PRICE_TARGET' 
  | 'STOP_LOSS' 
  | 'TAKE_PROFIT'
  | 'RSI_OVERSOLD'
  | 'RSI_OVERBOUGHT'
  | 'MACD_CROSSOVER'
  | 'BOLLINGER_BREAKOUT'
  | 'VOLUME_SPIKE';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AlertData {
  id: string;
  cryptoId: string;
  symbol: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details?: Record<string, unknown>;
  triggerPrice?: number;
  targetPrice?: number;
  triggered: boolean;
  triggeredAt?: Date;
  createdAt: Date;
}

export interface AlertConfigData {
  cryptoId: string;
  enabled: boolean;
  buyThresholdPercent: number;
  sellThresholdPercent: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  rsiOversoldThreshold: number;
  rsiOverboughtThreshold: number;
  priceTargetUp?: number;
  priceTargetDown?: number;
  notifyEmail: boolean;
  notifyPush: boolean;
  email?: string;
}

// ==================== PORTFOLIO TYPES ====================

export interface PortfolioPosition {
  id: string;
  cryptoId: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  avgBuyPrice: number;
  totalInvested: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  isActive: boolean;
  lastUpdated: Date;
}

export interface PortfolioTransaction {
  id: string;
  portfolioId: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  fee: number;
  feeCurrency?: string;
  notes?: string;
  timestamp: Date;
}

// ==================== SCANNER TYPES ====================

export interface ScanResult {
  cryptoId: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  
  // Technical signals
  rsi: number | null;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  signalScore: number;
  
  // Opportunity metrics
  distanceFromLow: number;  // % from 24h low
  distanceFromSupport: number;  // % from nearest support
  volumeRatio: number;  // Current vs avg volume
  
  // Recommendations
  recommendation: string;
  confidence: number;  // 0-1
  
  // Alert triggers
  triggers: string[];  // Reasons for the signal
}

export interface ScannerConfig {
  minMarketCap?: number;
  maxMarketCap?: number;
  minVolume?: number;
  rsiRange?: [number, number];
  signalFilter?: ('STRONG_BUY' | 'BUY')[];
  limit?: number;
}

// ==================== BACKTEST TYPES ====================

export interface BacktestConfig {
  cryptoId: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  
  // Strategy parameters
  rsiOversold: number;
  rsiOverbought: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  
  // Position sizing
  positionSizePercent: number;
  maxPositions: number;
}

export interface BacktestTrade {
  type: 'BUY' | 'SELL';
  timestamp: Date;
  price: number;
  quantity: number;
  total: number;
  reason: string;
  pnl?: number;
  pnlPercent?: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  
  // Performance metrics
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  
  // Trade history
  trades: BacktestTrade[];
  
  // Equity curve
  equityCurve: Array<{ timestamp: number; value: number }>;
  
  // Analysis
  analysis: string;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface MarketDataResponse {
  cryptocurrencies: CoinGeckoMarket[];
  lastUpdated: Date;
  nextUpdate: Date;
}

export interface AnalysisResponse {
  cryptoId: string;
  symbol: string;
  currentPrice: number;
  indicators: TechnicalIndicators;
  supportResistance: SupportResistanceLevels;
  recommendation: {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reasoning: string;
  };
  alerts: AlertData[];
  timestamp: Date;
}

// ==================== STORE TYPES ====================

export interface CryptoStore {
  // Market data
  cryptocurrencies: CoinGeckoMarket[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Selected crypto
  selectedCryptoId: string | null;
  
  // Scanner
  scanResults: ScanResult[];
  isScanning: boolean;
  
  // Portfolio
  portfolio: PortfolioPosition[];
  
  // Alerts
  alerts: AlertData[];
  unreadAlerts: number;
  
  // Settings
  settings: {
    refreshInterval: number;
    currency: string;
    theme: 'light' | 'dark';
  };
  
  // Actions
  setCryptocurrencies: (cryptos: CoinGeckoMarket[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedCrypto: (id: string | null) => void;
  setScanResults: (results: ScanResult[]) => void;
  setPortfolio: (portfolio: PortfolioPosition[]) => void;
  addAlert: (alert: AlertData) => void;
  markAlertRead: (id: string) => void;
  clearAlerts: () => void;
}
