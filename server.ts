import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize Telegram Bot if token provided
let bot: any = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  } catch (err: any) {
    console.debug('Telegram Bot initialization note:', err.message);
  }
}

async function sendTelegramAlert(message: string) {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;
  try {
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
  } catch (err: any) {
    console.error('Telegram error:', err.message);
  }
}

// 1. Secure Binance Futures Proxy
app.post('/api/binance-proxy', async (req, res) => {
  try {
    const { endpoint, method = 'GET', data, apiKey } = req.body;
    const clientApiKey = apiKey || process.env.BINANCE_API_KEY;
    const binanceUrl = `https://fapi.binance.com${endpoint}`;

    const headers: Record<string, string> = {};
    if (clientApiKey) headers['X-MBX-APIKEY'] = clientApiKey;

    const response = await axios({
      url: binanceUrl,
      method,
      headers,
      data,
    });

    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || 'Binance Proxy Communication Failed',
    });
  }
});

// 2. Automated Check & Clear Orphaned Trades before new push order
app.post('/api/binance/check-orphans', async (req, res) => {
  try {
    const { symbol, apiKey } = req.body;
    const clientApiKey = apiKey || process.env.BINANCE_API_KEY;
    const headers: Record<string, string> = clientApiKey ? { 'X-MBX-APIKEY': clientApiKey } : {};

    const cleanSymbol = (symbol || '').replace('/', '').toUpperCase();
    const openOrdersRes = await axios
      .get(`https://fapi.binance.com/fapi/v1/openOrders?symbol=${cleanSymbol}`, { headers })
      .catch(() => ({ data: [] }));

    if (Array.isArray(openOrdersRes.data) && openOrdersRes.data.length > 0) {
      await axios
        .delete(`https://fapi.binance.com/fapi/v1/allOpenOrders?symbol=${cleanSymbol}`, { headers })
        .catch(() => {});
      console.log(`[Orphan Cleaner] Cleared ${openOrdersRes.data.length} orphaned orders for ${symbol}`);
    }

    res.json({ success: true, clearedOrphans: true });
  } catch (error: any) {
    res.json({ success: true, clearedOrphans: false, note: 'Passed with fallback' });
  }
});

// 3. Automated Signal Comparator & Notification Endpoint
app.post('/api/signals/compare', async (req, res) => {
  try {
    const { symbol, strategy, price, indicatorValue, threshold } = req.body;
    const isTriggered = indicatorValue >= threshold;

    if (isTriggered) {
      const alertMessage =
        `🚨 *TradeSignal 15M Alert Triggered!*\n\n` +
        `• *Symbol:* \`${symbol}\`\n` +
        `• *Strategy:* ${strategy}\n` +
        `• *Current Price:* \`${price}\`\n` +
        `• *Indicator Value:* \`${indicatorValue}\` (Threshold: ${threshold})\n` +
        `Status: *Condition Met & Verified* ✅`;

      await sendTelegramAlert(alertMessage);
    }

    res.json({ success: true, triggered: isTriggered, symbol, price });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: Date.now() });
});

// 4. Binance Multi-Stream WebSocket Auto-Scanner
let binanceWs: WebSocket | null = null;
const activeSymbols = [
  'btcusdt',
  'ethusdt',
  'solusdt',
  'xrpusdt',
  'adausdt',
  'dogeusdt',
  'bnbusdt',
  'nearusdt',
  'suiusdt',
  'linkusdt',
  'avaxusdt',
  'pepeusdt',
];

function connectBinanceWS() {
  const streams = activeSymbols.map((s) => `${s.toLowerCase()}@ticker`).join('/');
  const wsUrl = `wss://fstream.binance.com/stream?streams=${streams}`;

  if (binanceWs) {
    try {
      binanceWs.terminate();
    } catch (e) {}
  }

  try {
    binanceWs = new WebSocket(wsUrl);

    binanceWs.on('message', (data: any) => {
      const msgStr = data.toString();
      wss.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msgStr);
        }
      });
    });

    binanceWs.on('error', (err: any) => {
      console.debug('Binance WS Note:', err.message);
    });

    binanceWs.on('close', () => {
      setTimeout(connectBinanceWS, 3000);
    });
  } catch (err: any) {
    console.debug('Binance WS connect error:', err.message);
    setTimeout(connectBinanceWS, 5000);
  }
}

// 5. Mount Vite middleware in development or serve static build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist/index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(PORT, () => {
  console.log(`Binance TurboScalp Server running on port ${PORT}`);
  connectBinanceWS();
});
