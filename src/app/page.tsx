'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, RefreshCw, Search, Settings,
  Bell, Wallet, BarChart3, AlertTriangle, ChevronUp, ChevronDown,
  Activity, Target, Shield, Zap, Clock, Eye, EyeOff
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { useCryptoStore, useUIStore } from '@/store/crypto-store';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

// ==================== TYPES ====================

interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  ath: number;
  ath_change_percentage: number;
  atl: number;
  atl_change_percentage: number;
}

interface ScanResult {
  cryptoId: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  rsi: number | null;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  signalScore: number;
  trend: string;
  distanceFromSupport: number;
  triggers: string[];
  confidence: number;
  recommendation: string;
}

interface AnalysisData {
  cryptoId: string;
  currentPrice: number;
  indicators: {
    rsi: number | null;
    macd: { macd: number | null; signal: number | null; histogram: number | null };
    bollingerBands: { upper: number | null; middle: number | null; lower: number | null; width: number | null };
    signal: string;
    signalScore: number;
    trend: string;
  };
  alerts: Array<{ type: string; severity: string; message: string }>;
}

// ==================== MAIN COMPONENT ====================

export default function CryptoAnalyzerDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(60000);
  const [showBacktest, setShowBacktest] = useState(false);

  // Fetch market data
  const {
    data: marketData,
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey: ['crypto-market'],
    queryFn: async () => {
      const response = await fetch('/api/crypto/market');
      if (!response.ok) throw new Error('Failed to fetch market data');
      return response.json();
    },
    refetchInterval: refreshInterval,
    staleTime: 30000,
  });

  // Fetch scan results
  const {
    data: scanData,
    isPending: scanning,
    mutate: runScan,
  } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/crypto/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 15,
          signalFilter: ['STRONG_BUY', 'BUY'],
        }),
      });
      if (!response.ok) throw new Error('Scan failed');
      return response.json();
    },
  });

  // Fetch detailed analysis for selected crypto
  const { data: analysisData, isLoading: analysisLoading } = useQuery({
    queryKey: ['crypto-analysis', selectedCrypto],
    queryFn: async () => {
      if (!selectedCrypto) return null;
      const response = await fetch(`/api/crypto/analysis/${selectedCrypto}`);
      if (!response.ok) throw new Error('Analysis failed');
      return response.json();
    },
    enabled: !!selectedCrypto,
    refetchInterval: 30000,
  });

  // Filter cryptocurrencies
  const filteredCryptos = marketData?.data?.cryptocurrencies?.filter(
    (crypto: CryptoData) =>
      crypto.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Auto-run scan on mount and every 10 minutes
  useEffect(() => {
    // Initial scan
    runScan();

    // Setup interval for 10 minutes (600,000 ms)
    const scanInterval = setInterval(() => {
      runScan(undefined, {
        onSuccess: (data) => {
          // Check for Strong Buy signals to notify
          const strongBuys = data?.data?.opportunities?.filter(
            (o: ScanResult) => o.signal === 'STRONG_BUY' || o.signal === 'BUY'
          );

          if (strongBuys && strongBuys.length > 0) {
            // Play sound
            playMoneySound();

            // Browser Notification
            if (Notification.permission === 'granted') {
              const count = strongBuys.length;
              const topCoin = strongBuys[0].symbol;
              new Notification('🚀 Nueva Señal Detectada', {
                body: `Se han encontrado ${count} oportunidades. ${topCoin} es una señal FUERTE.`,
                icon: strongBuys[0].imageUrl
              });
            }
            // Toast notification
            toast.success(`¡Nuevas señales detectadas! (${strongBuys.length})`, {
              description: `Oportunidad destacada en ${strongBuys[0].symbol}`,
              duration: 10000,
            });
          }
        }
      });
    }, 600000);

    // Request notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }

    return () => clearInterval(scanInterval);
  }, [runScan]);

  // Handle crypto selection
  const handleSelectCrypto = (cryptoId: string) => {
    setSelectedCrypto(cryptoId === selectedCrypto ? null : cryptoId);
  };

  // Format helpers
  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${price.toFixed(6)}`;
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'STRONG_BUY': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'BUY': return 'text-green-300 bg-green-300/10 border-green-300/30';
      case 'SELL': return 'text-red-300 bg-red-300/10 border-red-300/30';
      case 'STRONG_SELL': return 'text-red-400 bg-red-400/10 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  // Function to play "cha-ching" sound
  const playMoneySound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play blocked by browser', e));
    } catch (e) {
      console.error('Error playing sound', e);
    }
  };

  const getRSIColor = (rsi: number | null) => {
    if (rsi === null) return 'text-gray-400';
    if (rsi < 30) return 'text-green-400';
    if (rsi > 70) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  CryptoAnalyzer Pro
                </h1>
                <p className="text-xs text-slate-400">
                  Análisis técnico en tiempo real
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar cripto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64 bg-slate-800/50 border-slate-700 focus:border-blue-500"
                />
              </div>

              {/* Refresh interval selector */}
              <Select
                value={refreshInterval.toString()}
                onValueChange={(v) => setRefreshInterval(parseInt(v))}
              >
                <SelectTrigger className="w-32 bg-slate-800/50 border-slate-700">
                  <Clock className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30000">30s</SelectItem>
                  <SelectItem value="60000">1 min</SelectItem>
                  <SelectItem value="120000">2 min</SelectItem>
                  <SelectItem value="300000">5 min</SelectItem>
                </SelectContent>
              </Select>

              {/* Manual refresh */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                className="bg-slate-800/50 border-slate-700 hover:bg-slate-700"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Last update */}
              {dataUpdatedAt && (
                <span className="text-xs text-slate-500">
                  Actualizado: {formatDistanceToNow(dataUpdatedAt, { locale: es, addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Criptos</p>
                  <p className="text-2xl font-bold">{filteredCryptos.length}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Oportunidades</p>
                  <p className="text-2xl font-bold text-green-400">
                    {scanData?.data?.opportunities?.length || 0}
                  </p>
                </div>
                <Target className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Market Cap Total</p>
                  <p className="text-2xl font-bold">
                    {formatLargeNumber(
                      filteredCryptos.reduce((sum: number, c: CryptoData) => sum + (c.market_cap || 0), 0)
                    )}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Señales Fuertes</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {scanData?.data?.opportunities?.filter(
                      (o: ScanResult) => o.signal === 'STRONG_BUY'
                    )?.length || 0}
                  </p>
                </div>
                <Zap className="w-8 h-8 text-yellow-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Market Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Opportunities Scanner */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-green-400" />
                      Scanner de Oportunidades
                    </CardTitle>
                    <CardDescription>
                      Criptos con señales de compra detectadas
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => runScan()}
                    disabled={scanning}
                    variant="outline"
                    size="sm"
                    className="bg-slate-800/50 border-slate-700"
                  >
                    {scanning ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="ml-2">Escanear</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {scanning ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 bg-slate-800" />
                    ))}
                  </div>
                ) : scanData?.data?.opportunities?.length > 0 ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {scanData.data.opportunities.map((opportunity: ScanResult) => (
                        <div
                          key={opportunity.cryptoId}
                          className={`p-4 rounded-lg border transition-all cursor-pointer ${selectedCrypto === opportunity.cryptoId
                            ? 'bg-blue-500/10 border-blue-500/50'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                            }`}
                          onClick={() => handleSelectCrypto(opportunity.cryptoId)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {opportunity.imageUrl && (
                                <img
                                  src={opportunity.imageUrl}
                                  alt={opportunity.symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                              )}
                              <div>
                                <span className="font-bold">{opportunity.symbol}</span>
                                <span className="text-slate-400 text-sm ml-2">
                                  {opportunity.name}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getSignalColor(opportunity.signal)}>
                                {opportunity.signal.replace('_', ' ')}
                              </Badge>
                              <span className="text-lg font-bold">
                                {formatPrice(opportunity.currentPrice)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">RSI:</span>
                              <span className={getRSIColor(opportunity.rsi)}>
                                {opportunity.rsi?.toFixed(1) || 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">24h:</span>
                              <span className={
                                opportunity.priceChangePercent24h >= 0
                                  ? 'text-green-400'
                                  : 'text-red-400'
                              }>
                                {formatPercent(opportunity.priceChangePercent24h)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">Soporte:</span>
                              <span className="text-blue-400">
                                {opportunity.distanceFromSupport.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">Confianza:</span>
                              <span className="text-purple-400">
                                {(opportunity.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>

                          {opportunity.triggers.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {opportunity.triggers.map((trigger, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs bg-slate-700/50 border-slate-600"
                                >
                                  {trigger}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No se encontraron oportunidades en este momento</p>
                    <Button
                      onClick={() => runScan()}
                      variant="outline"
                      className="mt-4"
                    >
                      Escanear de nuevo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Crypto Analysis */}
            {selectedCrypto && analysisData?.data && (
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Análisis Detallado</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCrypto(null)}
                    >
                      Cerrar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <AnalysisPanel
                    data={analysisData.data}
                    cryptoId={selectedCrypto}
                  />
                </CardContent>
              </Card>
            )}

            {/* Market Table */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  Mercado Cripto
                </CardTitle>
                <CardDescription>
                  Top criptomonedas por capitalización de mercado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400">#</TableHead>
                      <TableHead className="text-slate-400">Nombre</TableHead>
                      <TableHead className="text-slate-400 text-right">Precio</TableHead>
                      <TableHead className="text-slate-400 text-right">24h %</TableHead>
                      <TableHead className="text-slate-400 text-right">Market Cap</TableHead>
                      <TableHead className="text-slate-400 text-right">ATH %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i} className="border-slate-800">
                          <TableCell colSpan={6}>
                            <Skeleton className="h-10 bg-slate-800" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      filteredCryptos.slice(0, 15).map((crypto: CryptoData) => (
                        <TableRow
                          key={crypto.id}
                          className="border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                          onClick={() => handleSelectCrypto(crypto.id)}
                        >
                          <TableCell className="text-slate-400">
                            {crypto.market_cap_rank}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <img
                                src={crypto.image}
                                alt={crypto.name}
                                className="w-6 h-6 rounded-full"
                              />
                              <div>
                                <span className="font-medium">{crypto.name}</span>
                                <span className="text-slate-400 text-sm ml-2 uppercase">
                                  {crypto.symbol}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatPrice(crypto.current_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={
                              crypto.price_change_percentage_24h >= 0
                                ? 'text-green-400'
                                : 'text-red-400'
                            }>
                              {formatPercent(crypto.price_change_percentage_24h)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-slate-300">
                            {formatLargeNumber(crypto.market_cap)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={
                              crypto.ath_change_percentage >= 0
                                ? 'text-green-400'
                                : 'text-red-400'
                            }>
                              {formatPercent(crypto.ath_change_percentage)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Indicadores Rápidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-slate-400">Fear & Greed</span>
                  <span className="text-xl font-bold text-yellow-400">45</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-slate-400">BTC Dominance</span>
                  <span className="text-xl font-bold">52.3%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-slate-400">Altcoin Season</span>
                  <span className="text-xl font-bold text-green-400">38</span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bell className="w-4 h-4 text-yellow-400" />
                    Alertas Recientes
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {scanData?.data?.opportunities?.length || 0} nuevas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {scanData?.data?.opportunities?.slice(0, 10).map((opp: ScanResult, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-800/50 rounded-lg border-l-2 border-green-500"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{opp.symbol}</span>
                          <Badge
                            variant="outline"
                            className={
                              opp.signal === 'STRONG_BUY'
                                ? 'text-green-400 border-green-400'
                                : 'text-yellow-400 border-yellow-400'
                            }
                          >
                            {opp.signal}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400">
                          {opp.recommendation.slice(0, 50)}...
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(new Date(), 'HH:mm', { locale: es })}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Backtest */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  Backtesting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400 mb-4">
                  Prueba tu estrategia con datos históricos
                </p>
                <BacktestPanel />
              </CardContent>
            </Card>

            {/* Risk Calculator */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  Gestión de Riesgo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RiskCalculator />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

// ==================== ANALYSIS PANEL ====================

function AnalysisPanel({ data, cryptoId }: { data: AnalysisData; cryptoId: string }) {
  const indicators = data.indicators;

  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${price.toFixed(6)}`;
  };

  return (
    <div className="space-y-6">
      {/* Indicators Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800/50 rounded-lg text-center">
          <p className="text-sm text-slate-400 mb-1">RSI (14)</p>
          <p className={`text-2xl font-bold ${indicators.rsi !== null && indicators.rsi < 30 ? 'text-green-400' :
            indicators.rsi !== null && indicators.rsi > 70 ? 'text-red-400' :
              'text-yellow-400'
            }`}>
            {indicators.rsi?.toFixed(1) || 'N/A'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {indicators.rsi !== null && indicators.rsi < 30 ? 'Sobrevendido' :
              indicators.rsi !== null && indicators.rsi > 70 ? 'Sobrecomprado' : 'Neutral'}
          </p>
        </div>

        <div className="p-4 bg-slate-800/50 rounded-lg text-center">
          <p className="text-sm text-slate-400 mb-1">MACD</p>
          <p className={`text-2xl font-bold ${(indicators.macd.histogram || 0) > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
            {indicators.macd.histogram?.toFixed(4) || 'N/A'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {(indicators.macd.histogram || 0) > 0 ? 'Alcista' : 'Bajista'}
          </p>
        </div>

        <div className="p-4 bg-slate-800/50 rounded-lg text-center">
          <p className="text-sm text-slate-400 mb-1">Señal</p>
          <Badge className={`text-lg ${indicators.signal === 'STRONG_BUY' ? 'bg-green-500/20 text-green-400' :
            indicators.signal === 'BUY' ? 'bg-green-500/10 text-green-300' :
              indicators.signal === 'SELL' ? 'bg-red-500/10 text-red-300' :
                indicators.signal === 'STRONG_SELL' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/10 text-gray-400'
            }`}>
            {indicators.signal.replace('_', ' ')}
          </Badge>
          <p className="text-xs text-slate-500 mt-1">
            Score: {indicators.signalScore}
          </p>
        </div>

        <div className="p-4 bg-slate-800/50 rounded-lg text-center">
          <p className="text-sm text-slate-400 mb-1">Tendencia</p>
          <p className={`text-2xl font-bold ${indicators.trend === 'BULLISH' ? 'text-green-400' :
            indicators.trend === 'BEARISH' ? 'text-red-400' :
              'text-yellow-400'
            }`}>
            {indicators.trend === 'BULLISH' ? '↑' : indicators.trend === 'BEARISH' ? '↓' : '→'}
          </p>
          <p className="text-xs text-slate-500 mt-1">{indicators.trend}</p>
        </div>
      </div>

      {/* Bollinger Bands */}
      <div className="p-4 bg-slate-800/30 rounded-lg">
        <h4 className="text-sm font-medium mb-3">Bandas de Bollinger</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-400">Superior</p>
            <p className="font-mono">{formatPrice(indicators.bollingerBands.upper || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Media</p>
            <p className="font-mono">{formatPrice(indicators.bollingerBands.middle || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Inferior</p>
            <p className="font-mono">{formatPrice(indicators.bollingerBands.lower || 0)}</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Alertas Activas</h4>
          {data.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border-l-2 ${alert.severity === 'CRITICAL' ? 'bg-red-500/10 border-red-500' :
                alert.severity === 'WARNING' ? 'bg-yellow-500/10 border-yellow-500' :
                  'bg-blue-500/10 border-blue-500'
                }`}
            >
              <p className="text-sm">{alert.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== BACKTEST PANEL ====================

function BacktestPanel() {
  const [cryptoId, setCryptoId] = useState('bitcoin');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runBacktest = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cryptoId,
          initialCapital,
          days: 180,
          rsiOversold: 30,
          rsiOverbought: 70,
          stopLossPercent: 5,
          takeProfitPercent: 20,
        }),
      });
      const data = await response.json();
      setResult(data.data);
      toast.success('Backtest completado');
    } catch (error) {
      toast.error('Error en el backtest');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          placeholder="ID de cripto (ej: bitcoin)"
          value={cryptoId}
          onChange={(e) => setCryptoId(e.target.value)}
          className="bg-slate-800/50 border-slate-700"
        />
        <Input
          type="number"
          placeholder="Capital inicial ($)"
          value={initialCapital}
          onChange={(e) => setInitialCapital(Number(e.target.value))}
          className="bg-slate-800/50 border-slate-700"
        />
      </div>

      <Button
        onClick={runBacktest}
        disabled={isRunning}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        {isRunning ? (
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <BarChart3 className="w-4 h-4 mr-2" />
        )}
        Ejecutar Backtest
      </Button>

      {result && (
        <div className="p-4 bg-slate-800/50 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Retorno Total:</span>
            <span className={result.totalReturnPercent >= 0 ? 'text-green-400' : 'text-red-400'}>
              {result.totalReturnPercent.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Win Rate:</span>
            <span>{result.winRate.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Max Drawdown:</span>
            <span className="text-red-400">{result.maxDrawdown.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Trades:</span>
            <span>{result.totalTrades}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== RISK CALCULATOR ====================

function RiskCalculator() {
  const [capital, setCapital] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(2);
  const [entryPrice, setEntryPrice] = useState(50000);
  const [stopLoss, setStopLoss] = useState(48000);

  const riskAmount = capital * (riskPercent / 100);
  const stopLossPercent = ((entryPrice - stopLoss) / entryPrice) * 100;
  const positionSize = riskAmount / (stopLossPercent / 100);
  const units = positionSize / entryPrice;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-400">Capital ($)</label>
          <Input
            type="number"
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            className="bg-slate-800/50 border-slate-700 h-8"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Riesgo (%)</label>
          <Input
            type="number"
            value={riskPercent}
            onChange={(e) => setRiskPercent(Number(e.target.value))}
            className="bg-slate-800/50 border-slate-700 h-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-400">Entrada ($)</label>
          <Input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value))}
            className="bg-slate-800/50 border-slate-700 h-8"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Stop Loss ($)</label>
          <Input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
            className="bg-slate-800/50 border-slate-700 h-8"
          />
        </div>
      </div>

      <Separator className="bg-slate-700" />

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Riesgo:</span>
          <span className="text-red-400">${riskAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Posición:</span>
          <span>${positionSize.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Unidades:</span>
          <span>{units.toFixed(6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Stop Loss:</span>
          <span className="text-red-400">{stopLossPercent.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}
