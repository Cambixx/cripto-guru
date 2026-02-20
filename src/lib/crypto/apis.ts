/**
 * Cryptocurrency API Services
 * Free APIs: CoinGecko (primary), Binance (secondary)
 */

import type {
  CoinGeckoMarket,
  CoinGeckoOHLC,
  CoinGeckoMarketChart,
  CoinGeckoTrending,
  CandleData,
} from './types';

import { db } from '../db';

// ==================== RATE LIMITING ====================

const rateLimiters = {
  coingecko: {
    lastCall: 0,
    minInterval: 5000, // Aumentado a 5s (12 llamadas/min) para evitar 429 agresivos
    queue: Promise.resolve(),
  },
  binance: {
    lastCall: 0,
    minInterval: 100, // 1200 calls/min
    queue: Promise.resolve(),
  },
};

/**
 * Ensures calls are made sequentially with at least minInterval between them
 */
async function rateLimit(api: 'coingecko' | 'binance'): Promise<void> {
  const limiter = rateLimiters[api];

  // Chain the promises to ensure sequential execution
  limiter.queue = limiter.queue.then(async () => {
    const now = Date.now();
    const timeSinceLastCall = now - limiter.lastCall;

    if (timeSinceLastCall < limiter.minInterval) {
      await new Promise(resolve => setTimeout(resolve, limiter.minInterval - timeSinceLastCall));
    }

    limiter.lastCall = Date.now();
  });

  return limiter.queue;
}

// ==================== PERSISTENT CACHE (DB) ====================

async function getPersistentCache<T>(endpoint: string, params?: any): Promise<T | null> {
  try {
    const paramsString = params ? JSON.stringify(params) : null;
    const cached = await db.apiCache.findUnique({
      where: {
        endpoint_params: {
          endpoint,
          params: paramsString || '',
        }
      }
    });

    if (cached && new Date() < cached.expiresAt) {
      return JSON.parse(cached.data) as T;
    }

    if (cached) {
      // Clean up expired
      await db.apiCache.delete({ where: { id: cached.id } }).catch(() => { });
    }
  } catch (error) {
    console.warn(`Persistent cache read error for ${endpoint}:`, error);
  }
  return null;
}

async function setPersistentCache<T>(endpoint: string, data: T, ttlMs: number, params?: any): Promise<void> {
  try {
    const paramsString = params ? JSON.stringify(params) : '';
    const expiresAt = new Date(Date.now() + ttlMs);

    await db.apiCache.upsert({
      where: {
        endpoint_params: {
          endpoint,
          params: paramsString,
        }
      },
      update: {
        data: JSON.stringify(data),
        expiresAt,
        fetchedAt: new Date(),
      },
      create: {
        endpoint,
        params: paramsString,
        data: JSON.stringify(data),
        expiresAt,
        fetchedAt: new Date(),
      }
    });
  } catch (error) {
    console.warn(`Persistent cache write error for ${endpoint}:`, error);
  }
}

// ==================== IN-MEMORY CACHE ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (entry && Date.now() - entry.timestamp < entry.ttl) {
    return entry.data as T;
  }
  memoryCache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

// ==================== COINGECKO API ====================

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

/**
 * Get market data for top cryptocurrencies
 */
export async function getMarketData(
  vsCurrency: string = 'usd',
  perPage: number = 50,
  page: number = 1,
  sparkline: boolean = false
): Promise<CoinGeckoMarket[]> {
  const cacheKey = `markets_${vsCurrency}_${perPage}_${page}_${sparkline}`;

  // 1. Try memory cache
  const memoria = getCached<CoinGeckoMarket[]>(cacheKey);
  if (memoria) return memoria;

  // 2. Try persistent cache
  const persistido = await getPersistentCache<CoinGeckoMarket[]>('market_data', { vsCurrency, perPage, page, sparkline });
  if (persistido) {
    setCache(cacheKey, persistido, 120000); // 2 min en memoria
    return persistido;
  }

  await rateLimit('coingecko');

  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=${vsCurrency}&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=${sparkline}&price_change_percentage=1h,24h,7d`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('CoinGecko rate limit exceeded. Please try again later.');
    }
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = await response.json();

  // 3. Save to both caches
  setCache(cacheKey, data, 120000); // 2 min en memoria
  await setPersistentCache('market_data', data, 600000, { vsCurrency, perPage, page, sparkline }); // 10 min en DB

  return data;
}

/**
 * Get OHLC data for a specific coin
 */
export async function getOHLCData(
  coinId: string,
  vsCurrency: string = 'usd',
  days: number = 30
): Promise<CoinGeckoOHLC[]> {
  const cacheKey = `ohlc_${coinId}_${vsCurrency}_${days}`;

  // 1. Try memory cache
  const memoria = getCached<CoinGeckoOHLC[]>(cacheKey);
  if (memoria) return memoria;

  // 2. Try persistent cache
  const persistido = await getPersistentCache<CoinGeckoOHLC[]>('ohlc_data', { coinId, vsCurrency, days });
  if (persistido) {
    setCache(cacheKey, persistido, 300000);
    return persistido;
  }

  await rateLimit('coingecko');

  const url = `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=${vsCurrency}&days=${days}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CoinGecko OHLC API error: ${response.status}`);
  }

  const data = await response.json();

  // Transform to typed array
  const ohlc: CoinGeckoOHLC[] = data.map((item: number[]) => ({
    timestamp: item[0],
    open: item[1],
    high: item[2],
    low: item[3],
    close: item[4],
  }));

  // 3. Save to both caches
  const ttl = days <= 1 ? 60000 : days <= 7 ? 300000 : 900000;
  setCache(cacheKey, ohlc, ttl);
  await setPersistentCache('ohlc_data', ohlc, ttl * 2, { coinId, vsCurrency, days });

  return ohlc;
}

/**
 * Get OHLC data prioritizing Binance (much faster and no 429 errors)
 * Fallback to CoinGecko if symbol not on Binance
 */
export async function getBestOHLCData(
  coinId: string,
  symbol: string,
  days: number = 30
): Promise<CoinGeckoOHLC[]> {
  try {
    // Determine Binance interval based on days
    let interval = '4h';
    let limit = 200;

    if (days <= 1) { interval = '15m'; limit = 96; }
    else if (days <= 3) { interval = '1h'; limit = 72; }
    else if (days <= 7) { interval = '2h'; limit = 84; }

    const klines = await getBinanceKlines(symbol.toUpperCase(), interval, limit);

    if (klines && klines.length > 0) {
      return klines.map(k => ({
        timestamp: k.timestamp,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close
      }));
    }

    // If no klines, return empty or throw to be caught
    return [];
  } catch (error: any) {
    // ONLY fallback to CoinGecko if it's NOT a Binance symbol error (400)
    // and ONLY if we really need to. During mass scans, we prefer to skip to avoided 429s.
    if (error.message?.includes('400')) {
      return []; // Just return empty, coin not on Binance
    }

    console.warn(`[API] Binance failure for ${symbol}, falling back to CoinGecko:`, error.message);
    return getOHLCData(coinId, 'usd', days);
  }
}

/**
 * Get market chart data (prices, volumes, market caps)
 */
export async function getMarketChart(
  coinId: string,
  vsCurrency: string = 'usd',
  days: number = 30
): Promise<CoinGeckoMarketChart> {
  const cacheKey = `chart_${coinId}_${vsCurrency}_${days}`;

  const memoria = getCached<CoinGeckoMarketChart>(cacheKey);
  if (memoria) return memoria;

  const persistido = await getPersistentCache<CoinGeckoMarketChart>('chart_data', { coinId, vsCurrency, days });
  if (persistido) {
    setCache(cacheKey, persistido, 600000); // 10 min
    return persistido;
  }

  await rateLimit('coingecko');

  const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CoinGecko Market Chart API error: ${response.status}`);
  }

  const data = await response.json();

  setCache(cacheKey, data, 60000);
  await setPersistentCache('chart_data', data, 600000, { coinId, vsCurrency, days });

  return data;
}

/**
 * Get trending coins
 */
export async function getTrending(): Promise<CoinGeckoTrending> {
  const cacheKey = 'trending';

  const memoria = getCached<CoinGeckoTrending>(cacheKey);
  if (memoria) return memoria;

  const persistido = await getPersistentCache<CoinGeckoTrending>('trending_data');
  if (persistido) {
    setCache(cacheKey, persistido, 300000);
    return persistido;
  }

  await rateLimit('coingecko');

  const url = `${COINGECKO_BASE}/search/trending`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CoinGecko Trending API error: ${response.status}`);
  }

  const data = await response.json();

  setCache(cacheKey, data, 300000);
  await setPersistentCache('trending_data', data, 600000);

  return data;
}

function getCCached<T>(key: string): T | null {
  return getCached<T>(key);
}

/**
 * Get price for specific coins
 */
export async function getPrices(
  coinIds: string[],
  vsCurrencies: string[] = ['usd']
): Promise<Record<string, Record<string, number>>> {
  const cacheKey = `prices_${coinIds.join(',')}_${vsCurrencies.join(',')}`;

  const memoria = getCached<Record<string, Record<string, number>>>(cacheKey);
  if (memoria) return memoria;

  const persistido = await getPersistentCache<Record<string, Record<string, number>>>('prices_data', { coinIds, vsCurrencies });
  if (persistido) {
    setCache(cacheKey, persistido, 30000);
    return persistido;
  }

  await rateLimit('coingecko');

  const url = `${COINGECKO_BASE}/simple/price?ids=${coinIds.join(',')}&vs_currencies=${vsCurrencies.join(',')}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CoinGecko Price API error: ${response.status}`);
  }

  const data = await response.json();

  setCache(cacheKey, data, 30000);
  await setPersistentCache('prices_data', data, 60000, { coinIds, vsCurrencies });

  return data;
}

/**
 * Get coin details
 */
export async function getCoinDetails(coinId: string): Promise<Record<string, unknown>> {
  const cacheKey = `coin_${coinId}`;

  const memoria = getCached<Record<string, unknown>>(cacheKey);
  if (memoria) return memoria;

  const persistido = await getPersistentCache<Record<string, unknown>>('coin_details', { coinId });
  if (persistido) {
    setCache(cacheKey, persistido, 300000);
    return persistido;
  }

  await rateLimit('coingecko');

  const url = `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CoinGecko Coin Details API error: ${response.status}`);
  }

  const data = await response.json();

  setCache(cacheKey, data, 300000);
  await setPersistentCache('coin_details', data, 600000, { coinId });

  return data;
}

// ==================== BINANCE API (PUBLIC) ====================

const BINANCE_BASE = 'https://api.binance.com/api/v3';

/**
 * Convert symbol to Binance format (e.g., 'BTC' -> 'BTCUSDT')
 */
function toBinanceSymbol(symbol: string, quote: string = 'USDT'): string {
  return `${symbol.toUpperCase()}${quote}`;
}

/**
 * Get 24h ticker for all symbols or specific symbol
 */
export async function getBinanceTicker24h(symbol?: string): Promise<unknown[]> {
  const cacheKey = `binance_ticker_${symbol || 'all'}`;
  const cached = getCached<unknown[]>(cacheKey);
  if (cached) return cached;

  await rateLimit('binance');

  const url = symbol
    ? `${BINANCE_BASE}/ticker/24hr?symbol=${toBinanceSymbol(symbol)}`
    : `${BINANCE_BASE}/ticker/24hr`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance Ticker API error: ${response.status}`);
  }

  const data = await response.json();
  setCache(cacheKey, Array.isArray(data) ? data : [data], 30000);

  return Array.isArray(data) ? data : [data];
}

/**
 * Get klines/candlestick data
 */
export async function getBinanceKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 500
): Promise<CandleData[]> {
  const cacheKey = `binance_klines_${symbol}_${interval}_${limit}`;
  const cached = getCached<CandleData[]>(cacheKey);
  if (cached) return cached;

  await rateLimit('binance');

  const url = `${BINANCE_BASE}/klines?symbol=${toBinanceSymbol(symbol)}&interval=${interval}&limit=${limit}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance Klines API error: ${response.status}`);
  }

  const data = await response.json();

  // Transform to CandleData format
  const klines: CandleData[] = data.map((k: (string | number)[]) => ({
    timestamp: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));

  setCache(cacheKey, klines, 60000);

  return klines;
}

/**
 * Get exchange info
 */
export async function getBinanceExchangeInfo(): Promise<unknown> {
  const cacheKey = 'binance_exchange_info';
  const cached = getCached<unknown>(cacheKey);
  if (cached) return cached;

  await rateLimit('binance');

  const url = `${BINANCE_BASE}/exchangeInfo`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance Exchange Info API error: ${response.status}`);
  }

  const data = await response.json();
  setCache(cacheKey, data, 3600000); // Cache for 1 hour

  return data;
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Map common symbol to CoinGecko ID
 */
export const SYMBOL_TO_COINGECKO: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'SOL': 'solana',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'SHIB': 'shiba-inu',
  'LTC': 'litecoin',
  'AVAX': 'avalanche-2',
  'LINK': 'chainlink',
  'ATOM': 'cosmos',
  'UNI': 'uniswap',
  'ETC': 'ethereum-classic',
  'XLM': 'stellar',
  'BCH': 'bitcoin-cash',
  'FIL': 'filecoin',
  'NEAR': 'near',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'INJ': 'injective-protocol',
  'FET': 'fetch-ai',
  'RUNE': 'thorchain',
  'AAVE': 'aave',
  'MKR': 'maker',
  'VET': 'vechain',
  'ALGO': 'algorand',
  'GRT': 'the-graph',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  'AXS': 'axie-infinity',
  'THETA': 'theta-network',
  'FTM': 'fantom',
  'EGLD': 'elrond-erd-2',
  'FLOW': 'flow',
  'HBAR': 'hedera-hashgraph',
  'IMX': 'immutable-x',
  'SEI': 'sei-network',
  'SUI': 'sui',
  'PEPE': 'pepe',
  'WIF': 'dogwifcoin',
  'BONK': 'bonk',
  'ORDI': 'ordinals',
  'TIA': 'celestia',
  'KAS': 'kaspa',
  'SATS': '1000sats',
  'JUP': 'jupiter-exchange-solana',
  'PYTH': 'pyth-network',
  'STX': 'blockstack',
  'LDO': 'lido-dao',
  'TAO': 'bittensor',
  'RNDR': 'render-token',
  'XMR': 'monero',
  'WLD': 'worldcoin-wld',
  'ARKM': 'arkham',
  'STRK': 'starknet',
  'JTO': 'jito-governance-token',
  'PENDLE': 'pendle',
  'ENS': 'ethereum-name-service',
  'DYM': 'dymension',
  'PIXEL': 'pixels',
  'ALT': 'altlayer',
  'MANTA': 'manta-network',
  'RON': 'ronin',
};

/**
 * Get CoinGecko ID from symbol
 */
export function getCoinGeckoId(symbol: string): string | undefined {
  return SYMBOL_TO_COINGECKO[symbol.toUpperCase()];
}

/**
 * Get symbol from CoinGecko ID
 */
export function getSymbolFromId(coinId: string): string | undefined {
  return Object.keys(SYMBOL_TO_COINGECKO).find(key => SYMBOL_TO_COINGECKO[key] === coinId);
}

/**
 * Fetch comprehensive market data with fallback
 */
export async function fetchMarketDataWithFallback(): Promise<CoinGeckoMarket[]> {
  try {
    return await getMarketData('usd', 100, 1, false);
  } catch (error) {
    console.error('CoinGecko API failed, trying Binance:', error);

    try {
      const binanceData = await getBinanceTicker24h();

      // Transform Binance data to CoinGecko format
      return (binanceData as Array<Record<string, unknown>>)
        .filter((t: Record<string, unknown>) => (t.symbol as string)?.endsWith('USDT'))
        .slice(0, 100)
        .map((t: Record<string, unknown>) => ({
          id: ((t.symbol as string) || '').replace('USDT', '').toLowerCase(),
          symbol: ((t.symbol as string) || '').replace('USDT', '').toLowerCase(),
          name: ((t.symbol as string) || '').replace('USDT', ''),
          image: '',
          current_price: parseFloat((t.lastPrice as string) || '0'),
          market_cap: parseFloat((t.quoteVolume as string) || '0') * 24, // Approximate
          market_cap_rank: 0,
          fully_diluted_valuation: null,
          total_volume: parseFloat((t.quoteVolume as string) || '0'),
          high_24h: parseFloat((t.highPrice as string) || '0'),
          low_24h: parseFloat((t.lowPrice as string) || '0'),
          price_change_24h: parseFloat((t.priceChange as string) || '0'),
          price_change_percentage_24h: parseFloat((t.priceChangePercent as string) || '0'),
          price_change_percentage_7d: null,
          market_cap_change_24h: 0,
          market_cap_change_percentage_24h: 0,
          circulating_supply: 0,
          total_supply: null,
          max_supply: null,
          ath: 0,
          ath_change_percentage: 0,
          ath_date: '',
          atl: 0,
          atl_change_percentage: 0,
          atl_date: '',
          last_updated: new Date().toISOString(),
        }));
    } catch (binanceError) {
      console.error('Both APIs failed:', binanceError);
      throw new Error('Unable to fetch market data from any source');
    }
  }
}

// Export cache utilities for testing/debugging
export const cacheUtils = {
  get: <T>(key: string): T | null => getCached<T>(key),
  set: <T>(key: string, data: T, ttl: number): void => setCache(key, data, ttl),
  clear: (key?: string): void => {
    if (key) {
      memoryCache.delete(key);
    } else {
      memoryCache.clear();
    }
  },
  size: (): number => memoryCache.size,
};
