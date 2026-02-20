-- =====================================================
-- CryptoAnalyzer Pro - Supabase PostgreSQL Schema
-- =====================================================
-- Ejecutar este SQL en el Editor SQL de Supabase
-- para crear todas las tablas necesarias

-- Habilitar extensión UUID si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== CRYPTOCURRENCY DATA ====================

CREATE TABLE IF NOT EXISTS cryptocurrencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coingecko_id TEXT UNIQUE NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    current_price DOUBLE PRECISION,
    market_cap DOUBLE PRECISION,
    market_cap_rank INTEGER,
    total_volume DOUBLE PRECISION,
    high_24h DOUBLE PRECISION,
    low_24h DOUBLE PRECISION,
    price_change_24h DOUBLE PRECISION,
    price_change_percent_24h DOUBLE PRECISION,
    price_change_7d DOUBLE PRECISION,
    price_change_percent_7d DOUBLE PRECISION,
    ath DOUBLE PRECISION,
    ath_change_percent DOUBLE PRECISION,
    atl DOUBLE PRECISION,
    atl_change_percent DOUBLE PRECISION,
    circulating_supply DOUBLE PRECISION,
    total_supply DOUBLE PRECISION,
    max_supply DOUBLE PRECISION,
    image_url TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cryptocurrencies_symbol ON cryptocurrencies(symbol);
CREATE INDEX IF NOT EXISTS idx_cryptocurrencies_rank ON cryptocurrencies(market_cap_rank);

-- ==================== PRICE HISTORY ====================

CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crypto_id UUID REFERENCES cryptocurrencies(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_crypto_time ON price_history(crypto_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);

-- ==================== TECHNICAL INDICATORS ====================

CREATE TABLE IF NOT EXISTS technical_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crypto_id UUID REFERENCES cryptocurrencies(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- RSI
    rsi14 DOUBLE PRECISION,
    
    -- MACD
    macd DOUBLE PRECISION,
    macd_signal DOUBLE PRECISION,
    macd_histogram DOUBLE PRECISION,
    
    -- Bollinger Bands
    bollinger_upper DOUBLE PRECISION,
    bollinger_middle DOUBLE PRECISION,
    bollinger_lower DOUBLE PRECISION,
    bollinger_width DOUBLE PRECISION,
    
    -- Moving Averages
    sma20 DOUBLE PRECISION,
    sma50 DOUBLE PRECISION,
    sma200 DOUBLE PRECISION,
    ema20 DOUBLE PRECISION,
    ema50 DOUBLE PRECISION,
    ema200 DOUBLE PRECISION,
    
    -- Volume
    volume_sma20 DOUBLE PRECISION,
    volume_ratio DOUBLE PRECISION,
    
    -- Support & Resistance
    support1 DOUBLE PRECISION,
    support2 DOUBLE PRECISION,
    resistance1 DOUBLE PRECISION,
    resistance2 DOUBLE PRECISION,
    pivot_point DOUBLE PRECISION,
    
    -- Trend
    trend TEXT,
    signal TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technical_indicators_crypto_time ON technical_indicators(crypto_id, timestamp);

-- ==================== ALERTS ====================

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crypto_id UUID REFERENCES cryptocurrencies(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT DEFAULT 'INFO',
    message TEXT NOT NULL,
    details JSONB,
    
    trigger_price DOUBLE PRECISION,
    target_price DOUBLE PRECISION,
    
    triggered BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMPTZ,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_crypto_triggered ON alerts(crypto_id, triggered);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

-- ==================== ALERT CONFIG ====================

CREATE TABLE IF NOT EXISTS alert_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crypto_id UUID REFERENCES cryptocurrencies(id) ON DELETE CASCADE,
    
    enabled BOOLEAN DEFAULT TRUE,
    
    buy_threshold_percent DOUBLE PRECISION DEFAULT 10.0,
    rsi_oversold_threshold DOUBLE PRECISION DEFAULT 30.0,
    
    sell_threshold_percent DOUBLE PRECISION DEFAULT 10.0,
    rsi_overbought_threshold DOUBLE PRECISION DEFAULT 70.0,
    
    stop_loss_percent DOUBLE PRECISION DEFAULT 5.0,
    take_profit_percent DOUBLE PRECISION DEFAULT 20.0,
    
    price_target_up DOUBLE PRECISION,
    price_target_down DOUBLE PRECISION,
    
    notify_email BOOLEAN DEFAULT FALSE,
    notify_push BOOLEAN DEFAULT TRUE,
    email TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_configs_crypto ON alert_configs(crypto_id);

-- ==================== PORTFOLIO ====================

CREATE TABLE IF NOT EXISTS portfolio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crypto_id UUID REFERENCES cryptocurrencies(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    
    quantity DOUBLE PRECISION DEFAULT 0,
    avg_buy_price DOUBLE PRECISION DEFAULT 0,
    total_invested DOUBLE PRECISION DEFAULT 0,
    
    current_value DOUBLE PRECISION DEFAULT 0,
    profit_loss DOUBLE PRECISION DEFAULT 0,
    profit_loss_percent DOUBLE PRECISION DEFAULT 0,
    
    stop_loss_price DOUBLE PRECISION,
    take_profit_price DOUBLE PRECISION,
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(crypto_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_symbol ON portfolio(symbol);

-- ==================== PORTFOLIO TRANSACTIONS ====================

CREATE TABLE IF NOT EXISTS portfolio_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolio(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL,
    quantity DOUBLE PRECISION,
    price DOUBLE PRECISION,
    total DOUBLE PRECISION,
    fee DOUBLE PRECISION DEFAULT 0,
    fee_currency TEXT,
    
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_portfolio ON portfolio_transactions(portfolio_id, timestamp);

-- ==================== ANALYSIS LOGS ====================

CREATE TABLE IF NOT EXISTS analysis_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crypto_id UUID REFERENCES cryptocurrencies(id) ON DELETE CASCADE,
    
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action TEXT,
    analysis JSONB,
    recommendation TEXT,
    confidence DOUBLE PRECISION,
    reasoning TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_logs_crypto_time ON analysis_logs(crypto_id, timestamp);

-- ==================== USER SETTINGS ====================

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    default_currency TEXT DEFAULT 'usd',
    refresh_interval INTEGER DEFAULT 60,
    
    scan_interval INTEGER DEFAULT 300,
    max_results INTEGER DEFAULT 20,
    
    max_position_size DOUBLE PRECISION DEFAULT 1000,
    max_portfolio_risk DOUBLE PRECISION DEFAULT 0.02,
    
    email_enabled BOOLEAN DEFAULT FALSE,
    email_address TEXT,
    push_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== SYSTEM LOGS ====================

CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level TEXT,
    category TEXT,
    message TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_category_time ON system_logs(category, timestamp);

-- ==================== API CACHE ====================

CREATE TABLE IF NOT EXISTS api_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint TEXT NOT NULL,
    params JSONB,
    data JSONB NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    UNIQUE(endpoint, params)
);

CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);

-- ==================== ROW LEVEL SECURITY (RLS) ====================
-- Para uso personal, puedes deshabilitar RLS o configurarlo según necesites

ALTER TABLE cryptocurrencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir todo (uso personal)
CREATE POLICY "Allow all for authenticated users" ON cryptocurrencies FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON price_history FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON technical_indicators FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON alerts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON alert_configs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON portfolio FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON portfolio_transactions FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON analysis_logs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON user_settings FOR ALL USING (true);

-- ==================== FUNCTIONS ====================

-- Función para actualizar timestamps automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar timestamps
CREATE TRIGGER update_cryptocurrencies_updated_at BEFORE UPDATE ON cryptocurrencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_configs_updated_at BEFORE UPDATE ON alert_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_updated_at BEFORE UPDATE ON portfolio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== VIEWS ====================

-- Vista de oportunidades actuales
CREATE OR REPLACE VIEW current_opportunities AS
SELECT 
    c.symbol,
    c.name,
    c.current_price,
    ti.rsi14 as rsi,
    ti.signal,
    ti.trend,
    ti.support1,
    ti.resistance1,
    c.price_change_percent_24h
FROM cryptocurrencies c
JOIN technical_indicators ti ON c.id = ti.crypto_id
WHERE ti.signal IN ('STRONG_BUY', 'BUY')
ORDER BY 
    CASE ti.signal 
        WHEN 'STRONG_BUY' THEN 1 
        WHEN 'BUY' THEN 2 
    END,
    ti.rsi14 ASC;

-- Vista de resumen de portfolio
CREATE OR REPLACE VIEW portfolio_summary AS
SELECT 
    p.symbol,
    c.name,
    p.quantity,
    p.avg_buy_price,
    c.current_price,
    p.quantity * c.current_price as current_value,
    p.total_invested,
    (p.quantity * c.current_price - p.total_invested) as profit_loss,
    CASE 
        WHEN p.total_invested > 0 
        THEN ((p.quantity * c.current_price - p.total_invested) / p.total_invested) * 100 
        ELSE 0 
    END as profit_loss_percent
FROM portfolio p
JOIN cryptocurrencies c ON p.crypto_id = c.id
WHERE p.is_active = TRUE;

-- ==================== SAMPLE DATA ====================
-- Insertar configuración inicial de usuario

INSERT INTO user_settings (default_currency, refresh_interval, scan_interval)
VALUES ('usd', 60, 300) ON CONFLICT DO NOTHING;

-- Mensaje de confirmación
SELECT 'CryptoAnalyzer Pro database schema created successfully!' as message;
