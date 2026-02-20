// Zustand Store for Crypto Analysis Dashboard
import { create } from 'zustand'

// ==================== Types ====================

export interface Cryptocurrency {
  id: string
  symbol: string
  name: string
  currentPrice: number
  marketCap: number | null
  volume24h: number | null
  priceChange24h: number | null
  priceChangePercent24h: number | null
  lastUpdated: Date | string
  imageUrl: string | null
}

export interface Alert {
  id: string
  cryptoId: string
  crypto?: Cryptocurrency
  type: 'BUY' | 'SELL' | 'PRICE_TARGET' | 'STOP_LOSS' | 'TAKE_PROFIT'
  message: string
  threshold: number | null
  currentPrice: number
  triggered: boolean
  triggeredAt: Date | string | null
  createdAt: Date | string
}

export interface Portfolio {
  id: string
  cryptoId: string
  crypto?: Cryptocurrency
  symbol: string
  quantity: number
  avgBuyPrice: number
  totalInvested: number
  currentValue: number | null
  profitLoss: number | null
  profitLossPercent: number | null
}

export interface AlertConfig {
  id: string
  cryptoId: string
  crypto?: Cryptocurrency
  enabled: boolean
  buyThresholdPercent: number | null
  sellThresholdPercent: number | null
  stopLossPercent: number | null
  takeProfitPercent: number | null
  rsiOversold: number
  rsiOverbought: number
  priceTargetUp: number | null
  priceTargetDown: number | null
}

export interface Opportunity {
  symbol: string
  name: string
  currentPrice: number
  signal: 'BUY' | 'SELL'
  confidence: number
  rsi: number
  reason: string
  support: number
  resistance: number
}

export interface AnalysisData {
  symbol: string
  indicators: {
    rsi: number | null
    macd: number | null
    macdSignal: number | null
    macdHistogram: number | null
    bollingerUpper: number | null
    bollingerMiddle: number | null
    bollingerLower: number | null
    ema20: number | null
    ema50: number | null
    ema200: number | null
    sma20: number | null
    sma50: number | null
    sma200: number | null
    support: number | null
    resistance: number | null
    atr: number | null
    volumeProfile: number | null
    relativeVolume: number | null
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    signal: 'BUY' | 'SELL' | 'HOLD'
    confidence: number
  }
  recommendation: string
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  signals: {
    name: string
    value: number | string
    signal: 'BUY' | 'SELL' | 'NEUTRAL'
    strength: number
  }[]
}

export interface PriceData {
  timestamp: Date | string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ==================== Store State ====================

interface CryptoState {
  // Market Data
  cryptocurrencies: Cryptocurrency[]
  selectedCrypto: Cryptocurrency | null
  priceHistory: PriceData[]
  analysis: AnalysisData | null
  
  // Opportunities
  opportunities: Opportunity[]
  
  // Alerts
  alerts: Alert[]
  alertConfigs: AlertConfig[]
  
  // Portfolio
  portfolio: Portfolio[]
  
  // UI State
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  lastUpdate: Date | null
  
  // Config
  configModalOpen: boolean
  selectedConfigCrypto: string | null
  
  // Actions - Market
  setCryptocurrencies: (cryptos: Cryptocurrency[]) => void
  setSelectedCrypto: (crypto: Cryptocurrency | null) => void
  setPriceHistory: (history: PriceData[]) => void
  setAnalysis: (analysis: AnalysisData | null) => void
  
  // Actions - Opportunities
  setOpportunities: (opportunities: Opportunity[]) => void
  
  // Actions - Alerts
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  setAlertConfigs: (configs: AlertConfig[]) => void
  updateAlertConfig: (config: Partial<AlertConfig> & { id: string }) => void
  
  // Actions - Portfolio
  setPortfolio: (portfolio: Portfolio[]) => void
  addPortfolioItem: (item: Portfolio) => void
  updatePortfolioItem: (item: Partial<Portfolio> & { id: string }) => void
  
  // Actions - UI
  setLoading: (loading: boolean) => void
  setRefreshing: (refreshing: boolean) => void
  setError: (error: string | null) => void
  setLastUpdate: (date: Date) => void
  
  // Actions - Config
  setConfigModalOpen: (open: boolean) => void
  setSelectedConfigCrypto: (cryptoId: string | null) => void
  
  // Actions - Data Fetching
  fetchMarketData: () => Promise<void>
  fetchPriceHistory: (cryptoId: string, days?: number) => Promise<void>
  fetchAnalysis: (cryptoId: string) => Promise<void>
  fetchOpportunities: () => Promise<void>
  fetchAlerts: () => Promise<void>
  fetchPortfolio: () => Promise<void>
  
  // Actions - CRUD
  buyCrypto: (symbol: string, quantity: number, price: number) => Promise<void>
  sellCrypto: (symbol: string, quantity: number, price: number) => Promise<void>
  configureAlert: (config: Partial<AlertConfig> & { cryptoId: string }) => Promise<void>
}

// ==================== Store Implementation ====================

export const useCryptoStore = create<CryptoState>((set, get) => ({
  // Initial State
  cryptocurrencies: [],
  selectedCrypto: null,
  priceHistory: [],
  analysis: null,
  opportunities: [],
  alerts: [],
  alertConfigs: [],
  portfolio: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastUpdate: null,
  configModalOpen: false,
  selectedConfigCrypto: null,
  
  // Setters
  setCryptocurrencies: (cryptos) => set({ cryptocurrencies: cryptos }),
  setSelectedCrypto: (crypto) => set({ selectedCrypto: crypto }),
  setPriceHistory: (history) => set({ priceHistory: history }),
  setAnalysis: (analysis) => set({ analysis }),
  setOpportunities: (opportunities) => set({ opportunities }),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
  setAlertConfigs: (configs) => set({ alertConfigs: configs }),
  updateAlertConfig: (config) => set((state) => ({
    alertConfigs: state.alertConfigs.map((c) => 
      c.id === config.id ? { ...c, ...config } : c
    )
  })),
  setPortfolio: (portfolio) => set({ portfolio }),
  addPortfolioItem: (item) => set((state) => ({ 
    portfolio: [...state.portfolio, item] 
  })),
  updatePortfolioItem: (item) => set((state) => ({
    portfolio: state.portfolio.map((p) => 
      p.id === item.id ? { ...p, ...item } : p
    )
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
  setError: (error) => set({ error }),
  setLastUpdate: (date) => set({ lastUpdate: date }),
  setConfigModalOpen: (open) => set({ configModalOpen: open }),
  setSelectedConfigCrypto: (cryptoId) => set({ selectedConfigCrypto: cryptoId }),
  
  // Data Fetching Actions
  fetchMarketData: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/crypto/market')
      if (!response.ok) throw new Error('Failed to fetch market data')
      const data = await response.json()
      set({ 
        cryptocurrencies: data.cryptocurrencies,
        lastUpdate: new Date()
      })
    } catch (error) {
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },
  
  fetchPriceHistory: async (cryptoId: string, days: number = 30) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/crypto/${cryptoId}/history?days=${days}`)
      if (!response.ok) throw new Error('Failed to fetch price history')
      const data = await response.json()
      set({ priceHistory: data.history })
    } catch (error) {
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },
  
  fetchAnalysis: async (cryptoId: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/crypto/${cryptoId}/analysis`)
      if (!response.ok) throw new Error('Failed to fetch analysis')
      const data = await response.json()
      set({ analysis: data })
    } catch (error) {
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },
  
  fetchOpportunities: async () => {
    try {
      const response = await fetch('/api/crypto/scan')
      if (!response.ok) throw new Error('Failed to scan opportunities')
      const data = await response.json()
      set({ opportunities: data.opportunities })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
  
  fetchAlerts: async () => {
    try {
      const response = await fetch('/api/alerts')
      if (!response.ok) throw new Error('Failed to fetch alerts')
      const data = await response.json()
      set({ alerts: data.alerts, alertConfigs: data.configs })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
  
  fetchPortfolio: async () => {
    try {
      const response = await fetch('/api/portfolio')
      if (!response.ok) throw new Error('Failed to fetch portfolio')
      const data = await response.json()
      set({ portfolio: data.portfolio })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
  
  // CRUD Actions
  buyCrypto: async (symbol: string, quantity: number, price: number) => {
    try {
      const response = await fetch('/api/portfolio/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, quantity, price })
      })
      if (!response.ok) throw new Error('Failed to record purchase')
      const data = await response.json()
      await get().fetchPortfolio()
      return data
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },
  
  sellCrypto: async (symbol: string, quantity: number, price: number) => {
    try {
      const response = await fetch('/api/portfolio/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, quantity, price })
      })
      if (!response.ok) throw new Error('Failed to record sale')
      const data = await response.json()
      await get().fetchPortfolio()
      return data
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },
  
  configureAlert: async (config) => {
    try {
      const response = await fetch('/api/alerts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!response.ok) throw new Error('Failed to configure alert')
      await get().fetchAlerts()
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  }
}))

// ==================== Selectors ====================

export const selectTopCryptos = (state: CryptoState) => 
  state.cryptocurrencies.slice(0, 10)

export const selectBuyOpportunities = (state: CryptoState) => 
  state.opportunities.filter(o => o.signal === 'BUY')

export const selectSellOpportunities = (state: CryptoState) => 
  state.opportunities.filter(o => o.signal === 'SELL')

export const selectUntriggeredAlerts = (state: CryptoState) => 
  state.alerts.filter(a => !a.triggered)

export const selectTriggeredAlerts = (state: CryptoState) => 
  state.alerts.filter(a => a.triggered)

export const selectPortfolioProfitLoss = (state: CryptoState) => {
  const portfolio = state.portfolio
  const totalInvested = portfolio.reduce((sum, p) => sum + p.totalInvested, 0)
  const totalValue = portfolio.reduce((sum, p) => sum + (p.currentValue || 0), 0)
  return {
    totalInvested,
    totalValue,
    profitLoss: totalValue - totalInvested,
    profitLossPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0
  }
}
