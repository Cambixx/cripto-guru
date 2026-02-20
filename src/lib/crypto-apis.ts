// Crypto API Services - CoinGecko and Binance integration
// Implements rate limiting and caching for optimal performance

// ==================== Types ====================

export interface CoinGeckoMarketData {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  fully_diluted_valuation: number | null
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_24h: number
  price_change_percentage_24h: number
  price_change_percentage_7d: number | null
  price_change_percentage_30d: number | null
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  circulating_supply: number
  total_supply: number | null
  max_supply: number | null
  ath: number
  ath_change_percentage: number
  ath_date: string
  atl: number
  atl_change_percentage: number
  atl_date: string
  last_updated: string
  sparkline_in_7d?: { price: number[] }
  price_change_percentage_1h_in_currency?: number
  price_change_percentage_24h_in_currency?: number
  price_change_percentage_7d_in_currency?: number
}

export interface CoinGeckoOHLC {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

export interface BinanceKline {
  openTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: number
  quoteVolume: string
  trades: number
  takerBuyBaseVolume: string
  takerBuyQuoteVolume: string
}

export interface CryptoPriceData {
  symbol: string
  name: string
  currentPrice: number
  marketCap: number
  volume24h: number
  priceChange24h: number
  priceChangePercent24h: number
  imageUrl: string
  lastUpdated: Date
}

export interface OHLCVData {
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ==================== Cache Implementation ====================

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class APICache {
  private cache = new Map<string, CacheEntry<unknown>>()
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data as T
  }
  
  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }
  
  clear(): void {
    this.cache.clear()
  }
}

const apiCache = new APICache()

// ==================== Rate Limiter ====================

class RateLimiter {
  private requests: number[] = []
  private maxRequests: number
  private windowMs: number
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }
  
  async waitForSlot(): Promise<void> {
    const now = Date.now()
    this.requests = this.requests.filter(t => t > now - this.windowMs)
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0]
      const waitTime = oldestRequest + this.windowMs - now
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
    
    this.requests.push(now)
  }
}

// CoinGecko: ~10-30 requests per minute for free tier
const coingeckoLimiter = new RateLimiter(10, 60000)
// Binance: 1200 requests per minute
const binanceLimiter = new RateLimiter(100, 60000)

// ==================== CoinGecko API ====================

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3'

export async function getTopCryptos(limit: number = 50): Promise<CoinGeckoMarketData[]> {
  const cacheKey = `coingecko_top_${limit}`
  const cached = apiCache.get<CoinGeckoMarketData[]>(cacheKey)
  if (cached) return cached
  
  await coingeckoLimiter.waitForSlot()
  
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h,7d`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 60 } // Cache for 60 seconds
      }
    )
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }
    
    const data = await response.json()
    apiCache.set(cacheKey, data, 60000) // Cache for 1 minute
    return data
  } catch (error) {
    console.error('Error fetching top cryptos from CoinGecko:', error)
    throw error
  }
}

export async function getCryptoBySymbol(symbol: string): Promise<CoinGeckoMarketData | null> {
  const cacheKey = `coingecko_symbol_${symbol.toLowerCase()}`
  const cached = apiCache.get<CoinGeckoMarketData>(cacheKey)
  if (cached) return cached
  
  await coingeckoLimiter.waitForSlot()
  
  try {
    // First get the coin ID from symbol
    const listResponse = await fetch(
      `${COINGECKO_BASE_URL}/coins/list?include_platform=false`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    )
    
    if (!listResponse.ok) {
      throw new Error(`CoinGecko API error: ${listResponse.status}`)
    }
    
    const list = await listResponse.json()
    const coin = list.find((c: { symbol: string; id: string }) => 
      c.symbol.toLowerCase() === symbol.toLowerCase()
    )
    
    if (!coin) return null
    
    // Then get the market data
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/${coin.id}?localization=false&tickers=false&community_data=false&developer_data=false`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      }
    )
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }
    
    const data = await response.json()
    const marketData: CoinGeckoMarketData = {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      image: data.image?.small || '',
      current_price: data.market_data?.current_price?.usd || 0,
      market_cap: data.market_data?.market_cap?.usd || 0,
      market_cap_rank: data.market_cap_rank || 0,
      fully_diluted_valuation: data.market_data?.fully_diluted_valuation?.usd || null,
      total_volume: data.market_data?.total_volume?.usd || 0,
      high_24h: data.market_data?.high_24h?.usd || 0,
      low_24h: data.market_data?.low_24h?.usd || 0,
      price_change_24h: data.market_data?.price_change_24h || 0,
      price_change_percentage_24h: data.market_data?.price_change_percentage_24h || 0,
      price_change_percentage_7d: data.market_data?.price_change_percentage_7d || null,
      price_change_percentage_30d: data.market_data?.price_change_percentage_30d || null,
      market_cap_change_24h: data.market_data?.market_cap_change_24h || 0,
      market_cap_change_percentage_24h: data.market_data?.market_cap_change_percentage_24h || 0,
      circulating_supply: data.market_data?.circulating_supply || 0,
      total_supply: data.market_data?.total_supply || null,
      max_supply: data.market_data?.max_supply || null,
      ath: data.market_data?.ath?.usd || 0,
      ath_change_percentage: data.market_data?.ath_change_percentage?.usd || 0,
      ath_date: data.market_data?.ath_date?.usd || '',
      atl: data.market_data?.atl?.usd || 0,
      atl_change_percentage: data.market_data?.atl_change_percentage?.usd || 0,
      atl_date: data.market_data?.atl_date?.usd || '',
      last_updated: data.last_updated || new Date().toISOString()
    }
    
    apiCache.set(cacheKey, marketData, 60000)
    return marketData
  } catch (error) {
    console.error('Error fetching crypto by symbol:', error)
    throw error
  }
}

export async function getCryptoOHLC(coinId: string, days: number = 30): Promise<CoinGeckoOHLC[]> {
  const cacheKey = `coingecko_ohlc_${coinId}_${days}`
  const cached = apiCache.get<CoinGeckoOHLC[]>(cacheKey)
  if (cached) return cached
  
  await coingeckoLimiter.waitForSlot()
  
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 } // Cache for 5 minutes
      }
    )
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }
    
    const data = await response.json()
    const ohlcData: CoinGeckoOHLC[] = data.map((item: number[]) => ({
      timestamp: item[0],
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4]
    }))
    
    apiCache.set(cacheKey, ohlcData, 300000) // Cache for 5 minutes
    return ohlcData
  } catch (error) {
    console.error('Error fetching OHLC data:', error)
    throw error
  }
}

export async function getCoinGeckoMarketChart(coinId: string, days: number = 30): Promise<{
  prices: [number, number][]
  market_caps: [number, number][]
  total_volumes: [number, number][]
}> {
  const cacheKey = `coingecko_chart_${coinId}_${days}`
  const cached = apiCache.get<{
    prices: [number, number][]
    market_caps: [number, number][]
    total_volumes: [number, number][]
  }>(cacheKey)
  if (cached) return cached
  
  await coingeckoLimiter.waitForSlot()
  
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 }
      }
    )
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }
    
    const data = await response.json()
    apiCache.set(cacheKey, data, 300000)
    return data
  } catch (error) {
    console.error('Error fetching market chart data:', error)
    throw error
  }
}

// ==================== Binance API ====================

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3'

export async function getBinanceKlines(
  symbol: string, 
  interval: string = '1d', 
  limit: number = 100
): Promise<OHLCVData[]> {
  const cacheKey = `binance_klines_${symbol}_${interval}_${limit}`
  const cached = apiCache.get<OHLCVData[]>(cacheKey)
  if (cached) return cached
  
  await binanceLimiter.waitForSlot()
  
  try {
    const response = await fetch(
      `${BINANCE_BASE_URL}/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      }
    )
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }
    
    const data: BinanceKline[] = await response.json()
    
    const klines: OHLCVData[] = data.map((k) => ({
      timestamp: new Date(k.openTime),
      open: parseFloat(k.open),
      high: parseFloat(k.high),
      low: parseFloat(k.low),
      close: parseFloat(k.close),
      volume: parseFloat(k.volume)
    }))
    
    apiCache.set(cacheKey, klines, 60000)
    return klines
  } catch (error) {
    console.error('Error fetching Binance klines:', error)
    throw error
  }
}

export async function getBinanceTicker24h(symbol: string): Promise<{
  symbol: string
  priceChange: string
  priceChangePercent: string
  lastPrice: string
  highPrice: string
  lowPrice: string
  volume: string
  quoteVolume: string
}> {
  const cacheKey = `binance_ticker_${symbol}`
  const cached = apiCache.get<{
    symbol: string
    priceChange: string
    priceChangePercent: string
    lastPrice: string
    highPrice: string
    lowPrice: string
    volume: string
    quoteVolume: string
  }>(cacheKey)
  if (cached) return cached
  
  await binanceLimiter.waitForSlot()
  
  try {
    const response = await fetch(
      `${BINANCE_BASE_URL}/ticker/24hr?symbol=${symbol}USDT`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      }
    )
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }
    
    const data = await response.json()
    apiCache.set(cacheKey, data, 60000)
    return data
  } catch (error) {
    console.error('Error fetching Binance ticker:', error)
    throw error
  }
}

export async function getBinanceExchangeInfo(): Promise<{
  symbols: Array<{
    symbol: string
    baseAsset: string
    quoteAsset: string
    status: string
  }>
}> {
  const cacheKey = 'binance_exchange_info'
  const cached = apiCache.get<{
    symbols: Array<{
      symbol: string
      baseAsset: string
      quoteAsset: string
      status: string
    }>
  }>(cacheKey)
  if (cached) return cached
  
  await binanceLimiter.waitForSlot()
  
  try {
    const response = await fetch(`${BINANCE_BASE_URL}/exchangeInfo`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 } // Cache for 1 hour
    })
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }
    
    const data = await response.json()
    apiCache.set(cacheKey, { symbols: data.symbols }, 3600000)
    return { symbols: data.symbols }
  } catch (error) {
    console.error('Error fetching Binance exchange info:', error)
    throw error
  }
}

// ==================== Combined Data Fetchers ====================

export async function getMarketDataForCryptos(symbols: string[]): Promise<CryptoPriceData[]> {
  try {
    // First, get top cryptos from CoinGecko
    const topCryptos = await getTopCryptos(100)
    
    // Filter by requested symbols
    const filtered = topCryptos.filter(c => 
      symbols.some(s => s.toLowerCase() === c.symbol.toLowerCase())
    )
    
    return filtered.map(c => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      currentPrice: c.current_price,
      marketCap: c.market_cap,
      volume24h: c.total_volume,
      priceChange24h: c.price_change_24h,
      priceChangePercent24h: c.price_change_percentage_24h,
      imageUrl: c.image,
      lastUpdated: new Date(c.last_updated)
    }))
  } catch (error) {
    console.error('Error getting market data:', error)
    throw error
  }
}

export async function getOHLCVData(symbol: string, days: number = 30): Promise<OHLCVData[]> {
  try {
    // Try Binance first (more reliable for OHLCV)
    const binanceSymbol = symbol.toUpperCase()
    const klines = await getBinanceKlines(binanceSymbol, '1d', days)
    return klines
  } catch {
    // Fallback to CoinGecko
    try {
      const coinId = symbol.toLowerCase()
      const ohlc = await getCryptoOHLC(coinId, days)
      return ohlc.map(o => ({
        timestamp: new Date(o.timestamp),
        open: o.open,
        high: o.high,
        low: o.low,
        close: o.close,
        volume: 0 // CoinGecko OHLC doesn't include volume
      }))
    } catch (error) {
      console.error('Error getting OHLCV data:', error)
      throw error
    }
  }
}

// ==================== Helper Functions ====================

export function formatPrice(price: number): string {
  if (price >= 1) {
    return price.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })
  } else if (price >= 0.01) {
    return price.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4 
    })
  } else {
    return price.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 6,
      maximumFractionDigits: 8 
    })
  }
}

export function formatMarketCap(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`
  } else {
    return `$${value.toLocaleString()}`
  }
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

// Clear cache function for manual cache invalidation
export function clearAPICache(): void {
  apiCache.clear()
}
