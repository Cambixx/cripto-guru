import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/ai/analyze
 * Use AI to analyze market conditions and generate insights
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, priceData, indicators, context } = body;
    
    // Initialize ZAI
    const zai = await ZAI.create();
    
    // Build analysis prompt
    const prompt = `Eres un analista experto en mercados de criptomonedas. Analiza la siguiente información y proporciona una recomendación de inversión profesional.

**Datos del Activo:**
- Símbolo: ${symbol || 'N/A'}
- Precio Actual: $${priceData?.currentPrice || 'N/A'}
- Cambio 24h: ${priceData?.change24h || 'N/A'}%
- Máximo 24h: $${priceData?.high24h || 'N/A'}
- Mínimo 24h: $${priceData?.low24h || 'N/A'}
- Volumen 24h: $${priceData?.volume24h || 'N/A'}

**Indicadores Técnicos:**
- RSI (14): ${indicators?.rsi || 'N/A'} ${indicators?.rsi < 30 ? '(SOBREVENDIDO)' : indicators?.rsi > 70 ? '(SOBRECOMPRADO)' : ''}
- MACD: ${indicators?.macd?.histogram || 'N/A'} ${indicators?.macd?.histogram > 0 ? '(ALCISTA)' : '(BAJISTA)'}
- Señal: ${indicators?.signal || 'N/A'}
- Tendencia: ${indicators?.trend || 'N/A'}
- Bollinger Superior: $${indicators?.bollinger?.upper || 'N/A'}
- Bollinger Inferior: $${indicators?.bollinger?.lower || 'N/A'}

**Contexto Adicional:**
${context || 'Sin contexto adicional disponible.'}

**Instrucciones:**
1. Proporciona un análisis conciso de la situación actual
2. Identifica los niveles clave de soporte y resistencia
3. Evalúa el riesgo/beneficio de una posible entrada
4. Sugiere puntos de entrada, stop-loss y take-profit si aplica
5. Indica tu nivel de confianza (0-100%)

Responde en español, de forma profesional pero accesible. Limita tu respuesta a 300 palabras.`;

    // Get AI analysis
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Eres un analista profesional de mercados cripto con experiencia en trading técnico y gestión de riesgos. Proporcionas análisis objetivos basados en indicadores técnicos. Siempre incluyes advertencias sobre el riesgo del trading.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const analysis = completion.choices[0]?.message?.content || 'No se pudo generar análisis';
    
    return NextResponse.json({
      success: true,
      data: {
        symbol,
        analysis,
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('AI Analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI analysis failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/analyze
 * Get general market sentiment analysis
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic') || 'mercado cripto general';
    
    const zai = await ZAI.create();
    
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Eres un analista de mercados cripto. Proporcionas resúmenes concisos del sentimiento del mercado en español.'
        },
        {
          role: 'user',
          content: `Proporciona un breve resumen del sentimiento actual del ${topic} en 2-3 frases. Incluye factores clave a considerar.`
        }
      ],
      temperature: 0.5,
      max_tokens: 200,
    });
    
    const sentiment = completion.choices[0]?.message?.content || 'No disponible';
    
    return NextResponse.json({
      success: true,
      data: {
        topic,
        sentiment,
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('AI Sentiment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sentiment analysis failed',
      },
      { status: 500 }
    );
  }
}
