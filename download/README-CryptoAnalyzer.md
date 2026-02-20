# CryptoAnalyzer Pro 🚀

Herramienta profesional de análisis de mercado de criptomonedas con alertas automáticas para identificar oportunidades de compra/venta.

## ✨ Características

### Análisis Técnico en Tiempo Real
- **RSI (Relative Strength Index)** - Detección de zonas sobrecompradas/sobrevendidas
- **MACD** - Identificación de momentum y cruces alcistas/bajistas
- **Bandas de Bollinger** - Detección de volatilidad y rupturas
- **Medias Móviles** - SMA y EMA (20, 50, 200 períodos)
- **Soportes y Resistencias** - Niveles clave calculados automáticamente

### Scanner de Oportunidades
- Detección automática de señales de compra
- Scoring de señales (-100 a +100)
- Filtros personalizables por RSI, señal, market cap
- Múltiples triggers por cada oportunidad

### Sistema de Alertas
- Alertas de compra/venta automáticas
- Notificaciones por email y push
- Configuración de umbrales personalizados
- Historial completo de alertas

### Gestión de Portfolio
- Tracking de posiciones en tiempo real
- Cálculo automático de P&L
- Stop-loss y take-profit automáticos
- Historial de transacciones

### Backtesting
- Validación de estrategias con datos históricos
- Métricas: Win rate, Sharpe ratio, Max drawdown
- Equity curve detallada
- Análisis de cada trade

### Integración con IA
- Análisis de mercado con IA
- Recomendaciones personalizadas
- Evaluación de sentimiento

## 🛠️ Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Recharts
- **Estado**: Zustand, React Query
- **Backend**: API Routes, Serverless Functions
- **Base de Datos**: Prisma (SQLite/PostgreSQL)
- **APIs**: CoinGecko, Binance (gratuitas)
- **IA**: z-ai-web-dev-sdk
- **Deployment**: Vercel (con Cron Jobs)

## 📦 Instalación

```bash
# Clonar el repositorio
git clone <repo-url>
cd crypto-analyzer

# Instalar dependencias
bun install

# Configurar base de datos
bun run db:push

# Iniciar desarrollo
bun run dev
```

## 🔧 Configuración

### Variables de Entorno

```env
# Base de datos (SQLite local)
DATABASE_URL="file:./dev.db"

# Para Supabase (producción)
# DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Cron Job Security (opcional)
CRON_SECRET="your-secret-key"

# IA (ya incluida en el proyecto)
# z-ai-web-dev-sdk está preconfigurado
```

### Configuración de Supabase

1. Crear proyecto en [Supabase](https://supabase.com)
2. Ir a SQL Editor
3. Ejecutar el contenido de `download/supabase-schema.sql`
4. Copiar la URL de conexión a `DATABASE_URL`

### Configuración de Vercel

1. Conectar repositorio a Vercel
2. Configurar variable `DATABASE_URL`
3. Configurar variable `CRON_SECRET` (opcional)
4. Los Cron Jobs se configuran automáticamente desde `vercel.json`

## 📡 API Endpoints

### Mercado
```
GET  /api/crypto/market          # Datos de mercado
POST /api/crypto/market          # Análisis de múltiples cryptos
GET  /api/crypto/analysis/[id]   # Análisis detallado de una crypto
POST /api/crypto/scan            # Scanner de oportunidades
```

### Portfolio
```
GET    /api/portfolio            # Ver portfolio
POST   /api/portfolio            # Añadir transacción
DELETE /api/portfolio            # Eliminar posición
```

### Alertas
```
GET    /api/alerts               # Ver alertas
POST   /api/alerts               # Crear alerta
PUT    /api/alerts               # Marcar como leída
DELETE /api/alerts               # Eliminar alertas
```

### Backtesting
```
POST /api/backtest               # Ejecutar backtest
```

### Cron Jobs
```
GET /api/cron/analyze            # Análisis periódico (auto)
```

### IA
```
GET  /api/ai/analyze             # Sentimiento del mercado
POST /api/ai/analyze             # Análisis personalizado
```

## 🚀 Deployment

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Los Cron Jobs se ejecutarán automáticamente cada 15 minutos.

### Netlify (Alternativa)

```bash
# Build
bun run build

# Deploy en Netlify
# Configurar redirects para SPA
```

## 📊 Uso del Dashboard

### Scanner de Oportunidades
1. El scanner se ejecuta automáticamente al cargar
2. Muestra cryptos con señales de compra
3. Click en una crypto para análisis detallado

### Análisis Detallado
- RSI actual y estado
- MACD con histograma
- Bandas de Bollinger
- Niveles de soporte/resistencia
- Alertas activas

### Backtesting
1. Seleccionar crypto (ej: bitcoin)
2. Configurar capital inicial
3. Ejecutar para ver resultados

### Calculadora de Riesgo
1. Ingresar capital total
2. Configurar % de riesgo
3. Precio de entrada y stop-loss
4. Ver tamaño de posición sugerido

## 📈 Indicadores Técnicos

### RSI (Relative Strength Index)
- **< 30**: Zona de sobreventa (potencial compra)
- **30-70**: Zona neutral
- **> 70**: Zona de sobrecompra (potencial venta)

### MACD
- **Histograma > 0**: Momentum alcista
- **Histograma < 0**: Momentum bajista
- **Cruce alcista**: Compra cuando histograma cruza de negativo a positivo

### Bandas de Bollinger
- **Precio < Banda inferior**: Posible rebote
- **Precio > Banda superior**: Posible corrección
- **Bandas estrechas**: Baja volatilidad, posible movimiento fuerte

## ⚠️ Aviso Legal

Esta herramienta es solo con fines educativos e informativos. No constituye asesoramiento financiero. El trading de criptomonedas conlleva riesgos significativos. Siempre realiza tu propia investigación antes de invertir.

## 📝 Licencia

MIT License - Uso personal y educativo

---

Desarrollado con ❤️ para la comunidad cripto
