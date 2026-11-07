export interface MarketAsset {
  symbol: string;
  name: string;
  price: number;
  high24h: number;
  low24h: number;
  rsi?: number;
}

export const INITIAL_BINANCE_ASSETS: MarketAsset[] = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', price: 91400.0, high24h: 92500, low24h: 89800, rsi: 58.4 },
  { symbol: 'ETH/USDT', name: 'Ethereum', price: 3350.0, high24h: 3420, low24h: 3280, rsi: 52.1 },
  { symbol: 'SOL/USDT', name: 'Solana', price: 194.5, high24h: 198.2, low24h: 188.0, rsi: 61.2 },
  { symbol: 'XRP/USDT', name: 'Ripple', price: 2.35, high24h: 2.45, low24h: 2.22, rsi: 55.0 },
  { symbol: 'ADA/USDT', name: 'Cardano', price: 0.85, high24h: 0.89, low24h: 0.82, rsi: 48.6 },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', price: 0.28, high24h: 0.30, low24h: 0.26, rsi: 64.2 },
];

export async function fetchBinanceKlines(symbol: string, interval: string = '15m', limit: number = 50): Promise<Array<any>> {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`);
    const text = await res.text();
    const data = text ? JSON.parse(text) : [];
    if (Array.isArray(data)) {
      return data.map((k: any[]) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    }
    return [];
  } catch (err) {
    console.debug('Failed to fetch binance klines, returning mock fallback:', err);
    return [];
  }
}

export async function executeBinancePushOrder(params: {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: number;
  quantityUsd: number;
  leverage: number;
  apiSettings: any;
}) {
  const { symbol, side, quantityUsd, leverage, apiSettings } = params;

  if (apiSettings.network === 'DEMO_PAPER') {
    return {
      success: true,
      executedPrice: params.price,
      message: `Demo Paper Mode: ${side} order executed successfully for ${symbol} with ${leverage}x leverage.`
    };
  }

  try {
    await fetch('/api/binance/check-orphans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        apiKey: apiSettings.apiKey,
        secretKey: apiSettings.apiSecret
      })
    }).catch(() => {});

    const quantity = Number((quantityUsd / params.price).toFixed(3));
    const response = await fetch('/api/binance-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/fapi/v1/order',
        method: 'POST',
        data: {
          symbol: symbol.replace('/', ''),
          side,
          type: 'MARKET',
          quantity: Math.max(0.001, quantity),
          leverage
        },
        apiKey: apiSettings.apiKey,
        secretKey: apiSettings.apiSecret
      })
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (response.ok) {
      return {
        success: true,
        executedPrice: data.avgPrice ? parseFloat(data.avgPrice) : params.price,
        message: `Binance Futures Order Filled Successfully.`
      };
    } else {
      return {
        success: false,
        message: data.details?.msg || data.error || 'Binance order rejected.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error pushing trade to Binance.'
    };
  }
}