import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  CoinGeckoMarket, 
  ScanResult, 
  PortfolioPosition, 
  AlertData,
  TechnicalIndicators,
  CandleData
} from '@/lib/crypto/types';

// ==================== CRYPTO STORE ====================

interface CryptoStore {
  // Market data
  cryptocurrencies: CoinGeckoMarket[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Selected crypto for detailed view
  selectedCrypto: CoinGeckoMarket | null;
  selectedCryptoHistory: CandleData[];
  selectedCryptoIndicators: TechnicalIndicators | null;
  
  // Scanner
  scanResults: ScanResult[];
  isScanning: boolean;
  
  // Portfolio
  portfolio: PortfolioPosition[];
  
  // Alerts
  alerts: AlertData[];
  unreadCount: number;
  
  // Settings
  settings: {
    refreshInterval: number;
    currency: string;
    theme: 'light' | 'dark';
    alertConfig: {
      rsiOversold: number;
      rsiOverbought: number;
      buyThreshold: number;
      sellThreshold: number;
    };
  };
  
  // Actions
  setCryptocurrencies: (cryptos: CoinGeckoMarket[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedCrypto: (crypto: CoinGeckoMarket | null) => void;
  setSelectedCryptoHistory: (history: CandleData[]) => void;
  setSelectedCryptoIndicators: (indicators: TechnicalIndicators | null) => void;
  setScanResults: (results: ScanResult[]) => void;
  setScanning: (scanning: boolean) => void;
  setPortfolio: (portfolio: PortfolioPosition[]) => void;
  addAlert: (alert: AlertData) => void;
  markAlertRead: (id: string) => void;
  clearAlerts: () => void;
  updateSettings: (settings: Partial<CryptoStore['settings']>) => void;
}

export const useCryptoStore = create<CryptoStore>()(
  persist(
    (set) => ({
      // Initial state
      cryptocurrencies: [],
      isLoading: false,
      error: null,
      lastUpdated: null,
      
      selectedCrypto: null,
      selectedCryptoHistory: [],
      selectedCryptoIndicators: null,
      
      scanResults: [],
      isScanning: false,
      
      portfolio: [],
      
      alerts: [],
      unreadCount: 0,
      
      settings: {
        refreshInterval: 60000,
        currency: 'usd',
        theme: 'dark',
        alertConfig: {
          rsiOversold: 30,
          rsiOverbought: 70,
          buyThreshold: 10,
          sellThreshold: 10,
        },
      },
      
      // Actions
      setCryptocurrencies: (cryptos) => set({ 
        cryptocurrencies: cryptos, 
        lastUpdated: new Date() 
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      setSelectedCrypto: (crypto) => set({ selectedCrypto: crypto }),
      
      setSelectedCryptoHistory: (history) => set({ selectedCryptoHistory: history }),
      
      setSelectedCryptoIndicators: (indicators) => set({ selectedCryptoIndicators: indicators }),
      
      setScanResults: (results) => set({ scanResults: results }),
      
      setScanning: (scanning) => set({ isScanning: scanning }),
      
      setPortfolio: (portfolio) => set({ portfolio }),
      
      addAlert: (alert) => set((state) => ({ 
        alerts: [alert, ...state.alerts].slice(0, 100),
        unreadCount: state.unreadCount + 1,
      })),
      
      markAlertRead: (id) => set((state) => ({
        alerts: state.alerts.map(a => 
          a.id === id ? { ...a, acknowledged: true } : a
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      })),
      
      clearAlerts: () => set({ alerts: [], unreadCount: 0 }),
      
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),
    }),
    {
      name: 'crypto-analyzer-storage',
      partialize: (state) => ({ 
        settings: state.settings,
        portfolio: state.portfolio,
        alerts: state.alerts.slice(0, 20),
      }),
    }
  )
);

// ==================== UI STORE ====================

interface UIStore {
  // Active tab
  activeTab: 'market' | 'scanner' | 'portfolio' | 'alerts' | 'settings';
  
  // Modals
  configModalOpen: boolean;
  detailModalOpen: boolean;
  backtestModalOpen: boolean;
  
  // Filters
  searchQuery: string;
  sortBy: 'market_cap' | 'price_change' | 'volume' | 'signal';
  sortOrder: 'asc' | 'desc';
  
  // Actions
  setActiveTab: (tab: UIStore['activeTab']) => void;
  setConfigModalOpen: (open: boolean) => void;
  setDetailModalOpen: (open: boolean) => void;
  setBacktestModalOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: UIStore['sortBy']) => void;
  toggleSortOrder: () => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  activeTab: 'market',
  
  configModalOpen: false,
  detailModalOpen: false,
  backtestModalOpen: false,
  
  searchQuery: '',
  sortBy: 'market_cap',
  sortOrder: 'desc',
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  setConfigModalOpen: (open) => set({ configModalOpen: open }),
  setDetailModalOpen: (open) => set({ detailModalOpen: open }),
  setBacktestModalOpen: (open) => set({ backtestModalOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortBy: (sortBy) => set({ sortBy }),
  toggleSortOrder: () => set((state) => ({ 
    sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' 
  })),
}));
