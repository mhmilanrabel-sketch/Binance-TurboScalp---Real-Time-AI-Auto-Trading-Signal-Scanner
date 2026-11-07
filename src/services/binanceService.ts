import { MarketAsset, BinanceApiSettings, CandleData, Timeframe } from '../types';

export const INITIAL_BINANCE_ASSETS: MarketAsset[] = [
  {
    symbol: 'BTC/USDT',
    name: 'Bitcoin',
    price: 91450.00,
    change24h: 2.14,
    high24h: 92800.00,
    low24h: 89600.00,
    volume24h: '$2.84B',
    rawVolume: 2840000000,
    rsi: 54.2,
    emaTrend: 'BULLISH',
    macdCross: 'BULLISH',
    confluenceScore: 92,
  },
  {
    symbol: 'ETH/USDT',
    name: 'Ethereum',
    price: 3380.20,
    change24h: 3.42,
    high24h: 3450.00,
    low24h: 3260.00,
    volume24h: '$1.45B',
    rawVolume: 1450000000,
    rsi: 61.8,
    emaTrend: 'BULLISH',
    macdCross: 'BULLISH',
    confluenceScore: 94,
  },
  {
    symbol: 'SOL/USDT',
    name: 'Solana',
    price: 194.50,
    change24h: 4.85,
    high24h: 198.80,
    low24h: 184.20,
    volume24h: '$890M',
    rawVolume: 890000000,
    rsi: 68.5,
    emaTrend: 'BULLISH',
    macdCross: 'BULLISH',
    confluenceScore: 96,
  },
  {
    symbol: 'BNB/USDT',
    name: 'Binance Coin',
    price: 652.80,
    change24h: 1.15,
    high24h: 660.00,
    low24h: 642.00,
    volume24h: '$320M',
    rawVolume: 320000000,
    rsi: 52.0,
    emaTrend: 'BULLISH',
    macdCross: 'NONE',
    confluenceScore: 84,
  },
  {
    symbol: 'XRP/USDT',
    name: 'Ripple',
    price: 1.24,
    change24h: 5.60,
    high24h: 1.32,
    low24h: 1.15,
    volume24h: '$640M',
    rawVolume: 640000000,
    rsi: 72.1,
    emaTrend: 'BULLISH',
    macdCross: 'BULLISH',
    confluenceScore: 91,
  },
  {
    symbol: 'DOGE/USDT',
    name: 'Dogecoin',
    price: 0.392,
    change24h: -1.25,
    high24h: 0.420,
    low24h: 0.380,
    volume24h: '$410M',
    rawVolume: 410000000,
    rsi: 44.3,
    emaTrend: 'BEARISH',
    macdCross: 'BEARISH',
    confluenceScore: 88,
  },
  {
    symbol: 'ADA/USDT',
    name: 'Cardano',
    price: 0.748,
    change24h: 2.30,
    high24h: 0.780,
    low24h: 0.710,
    volume24h: '$210M',
    rawVolume: 210000000,
    rsi: 58.6,
    emaTrend: 'BULLISH',
    macdCross: 'BULLISH',
    confluenceScore: 86,
  },
  {
    symbol: 'AVAX/USDT',
    name: 'Avalanche',
    price: 36.20,
    change24h: 1.75,
    high24h: 37.80,
    low24h: 35.10,
    volume24h: '$180M',
    rawVolume: 180000000,
    rsi: 51.4,
    emaTrend: 'BULLISH',
    macdCross: 'NONE',
    confluenceScore: 82,
  },
  {
    symbol: 'SUI/USDT',
    name: 'Sui Network',
    price: 3.42,
    change24h: 7.15,
    high24h: 3.60,
    low24h: 3.12,
    volume24h: '$520M',
    rawVolume: 520000000,
    rsi: 74.2,
    emaTrend: 'BULLISH',
    macdCross: 'BULLISH',
    confluenceScore: 95,
  },
  {
    symbol: 'NEAR/USDT',
    name: 'NEAR Protocol',
    price: 6.85,
    change24h: 3.10,
    high24h: 7.10,
    low24h: 6.50,
    volume24h: '$165M',
    rawVolume: 1650000000,
    rsi: 59.2,
    emaTrend: 'BULLISH',
    macdCross: 'BULLISH',
    confluenceScore: 89,
  },
  {
    symbol: 'LINK/USDT',
    name: 'Chainlink',
    price: 18.90,
    change24h: 2.85,
    high24h: 19.50,
    low24h: 18.10,
    volume24h: '$140M',
    rawVolume: 140000000,
    rsi: 56.4,
    emaTrend: 'BULLISH',
    macdCross: 'BULLISH',
    confluenceScore: 87,
  },
  {
    symbol: 'PEPE/USDT',
    name: 'Pepe',
    price: 0.0000214,
    change24h: -3.40,
    high24h: 0.0000230,
    low24h: 0.0000205,
    volume24h: '$390M',
    rawVolume: 390000000,
    rsi: 38.5,
    emaTrend: 'BEARISH',
    macdCross: 'BEARISH',
    confluenceScore: 86,
  },
];

/**
 * Generate HMAC-SHA256 signature using browser native Web Crypto API
 */
export async function generateBinanceHmacSha256(queryString: string, secretKey: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(queryString));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fetch real Binance Klines via proxy or fallback to synthetic
 */
export async function fetchBinanceKlines(
  symbol: string,
  timeframe: Timeframe = '15m',
  limit = 60
): Promise<CandleData[] | null> {
  try {
    const rawSymbol = symbol.replace('/', '').toUpperCase();
    const intervalMap: Record<Timeframe, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
    };
    const interval = intervalMap[timeframe] || '15m';
    const url = `/api/binance-spot/api/v3/klines?symbol=${rawSymbol}&interval=${interval}&limit=${limit}`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!Array.isArray(data)) return null;

    return data.map((item: any) => ({
      time: item[0],
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));
  } catch (err) {
    console.debug('Direct Binance kline fetch fallback:', err);
    return null;
  }
}

/**
 * Verifies Binance API Key and Secret, returning balance
 */
export async function verifyBinanceApiConnection(settings: BinanceApiSettings): Promise<{
  success: boolean;
  message: string;
  balanceUsdt: number;
}> {
  if (settings.network === 'DEMO_PAPER') {
    return {
      success: true,
      message: 'Demo Paper Trading Mode Active. Virtual $10,000 USDT balance initialized.',
      balanceUsdt: settings.demoBalance || 10000.0,
    };
  }

  if (!settings.apiKey || !settings.apiSecret) {
    return {
      success: false,
      message: 'Please provide both Binance API Key and Secret Key.',
      balanceUsdt: settings.demoBalance || 10000.0,
    };
  }

  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}&recvWindow=10000`;
    const signature = await generateBinanceHmacSha256(queryString, settings.apiSecret);
    
    const basePath = settings.network === 'BINANCE_TESTNET'
      ? (settings.tradingType === 'FUTURES_USDM' ? '/api/binance-testnet-fapi' : '/api/binance-testnet')
      : (settings.tradingType === 'FUTURES_USDM' ? '/api/binance-fapi' : '/api/binance-spot');

    const endpoint = settings.tradingType === 'FUTURES_USDM' ? '/fapi/v2/account' : '/api/v3/account';
    const targetUrl = `${basePath}${endpoint}?${queryString}&signature=${signature}`;

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': settings.apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (res.ok && data) {
      let usdtBal = 0;
      if (data.balances) {
        const usdt = data.balances.find((b: any) => b.asset === 'USDT');
        if (usdt) usdtBal = parseFloat(usdt.free);
      } else if (data.assets) {
        const usdt = data.assets.find((a: any) => a.asset === 'USDT');
        if (usdt) usdtBal = parseFloat(usdt.availableBalance || usdt.walletBalance);
      }
      return {
        success: true,
        message: `Connected successfully to Binance ${settings.tradingType} (${settings.network})! Available USDT: $${usdtBal.toFixed(2)}`,
        balanceUsdt: usdtBal,
      };
    } else {
      return {
        success: false,
        message: data.msg || `Binance Error [Code ${data.code}]`,
        balanceUsdt: 0,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err.message || 'Network error'}. You can continue trading in Demo Paper Mode.`,
      balanceUsdt: settings.demoBalance || 10000.0,
    };
  }
}

/**
 * Execute Push Trade (Direct REST Order or Paper Simulated Order)
 */
export async function executeBinancePushOrder(params: {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  price: number;
  quantityUsd: number;
  leverage: number;
  apiSettings: BinanceApiSettings;
}): Promise<{ success: boolean; orderId: string; executedPrice: number; message: string }> {
  const { symbol, side, price, quantityUsd, leverage, apiSettings } = params;
  const isDemo = apiSettings.network === 'DEMO_PAPER' || !apiSettings.isConfigured;

  if (isDemo) {
    // Instant virtual simulation with realistic 0.02% slippage
    const slippage = side === 'BUY' ? 1.0002 : 0.9998;
    const executedPrice = Number((price * slippage).toFixed(price > 500 ? 2 : 4));
    const orderId = `DEMO-ORD-${Date.now().toString(36).toUpperCase()}`;

    return {
      success: true,
      orderId,
      executedPrice,
      message: `Paper Order Executed: ${side} ${symbol} @ $${executedPrice} (${leverage}x, $${quantityUsd} USDT)`,
    };
  }

  // Live / Testnet execution via authenticated Binance REST API
  try {
    const rawSymbol = symbol.replace('/', '').toUpperCase();
    const timestamp = Date.now();
    const basePath = apiSettings.network === 'BINANCE_TESTNET'
      ? (apiSettings.tradingType === 'FUTURES_USDM' ? '/api/binance-testnet-fapi' : '/api/binance-testnet')
      : (apiSettings.tradingType === 'FUTURES_USDM' ? '/api/binance-fapi' : '/api/binance-spot');

    const endpoint = apiSettings.tradingType === 'FUTURES_USDM' ? '/fapi/v1/order' : '/api/v3/order';
    const quantityTokens = Number((quantityUsd / price).toFixed(4));
    
    const query = `symbol=${rawSymbol}&side=${side}&type=MARKET&quantity=${quantityTokens}&timestamp=${timestamp}&recvWindow=10000`;
    const signature = await generateBinanceHmacSha256(query, apiSettings.apiSecret);
    const url = `${basePath}${endpoint}?${query}&signature=${signature}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiSettings.apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (res.ok && data) {
      return {
        success: true,
        orderId: String(data.orderId || data.clientOrderId || Date.now()),
        executedPrice: parseFloat(data.avgPrice || data.price || price),
        message: `Live Order Executed: ${side} ${symbol} on Binance! Order ID: ${data.orderId}`,
      };
    } else {
      throw new Error(data.msg || 'Binance order rejected');
    }
  } catch (err: any) {
    // If real API call fails, provide graceful fallback report
    console.error('Binance push order error:', err);
    return {
      success: false,
      orderId: '',
      executedPrice: price,
      message: `Live Binance Order Failed: ${err.message}. Please check API Key permissions.`,
    };
  }
}
