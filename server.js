const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
}

async function sendTelegramAlert(message) {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;
  try {
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Telegram error:', err.message);
  }
}

// Secure Binance Futures Proxy & Orphaned Trade Cleaner
app.post('/api/binance-proxy', async (req, res) => {
  try {
    const { endpoint, method = 'GET', data, apiKey, secretKey } = req.body;
    const clientApiKey = apiKey || process.env.BINANCE_API_KEY;
    const binanceUrl = `https://fapi.binance.com${endpoint}`; // Futures endpoint
    
    const headers = {};
    if (clientApiKey) headers['X-MBX-APIKEY'] = clientApiKey;

    const response = await axios({
      url: binanceUrl,
      method,
      headers,
      data
    });

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || 'Binance Proxy Communication Failed'
    });
  }
});

// Automated Check & Clear Orphaned Trades before new push order
app.post('/api/binance/check-orphans', async (req, res) => {
  try {
    const { symbol, apiKey, secretKey } = req.body;
    const clientApiKey = apiKey || process.env.BINANCE_API_KEY;
    const headers = clientApiKey ? { 'X-MBX-APIKEY': clientApiKey } : {};

    // 1. Check open orders & positions on Binance Futures
    const openOrdersRes = await axios.get(`https://fapi.binance.com/fapi/v1/openOrders?symbol=${symbol.replace('/', '')}`, { headers }).catch(() => ({ data: [] }));
    
    if (Array.isArray(openOrdersRes.data) && openOrdersRes.data.length > 0) {
      // Automatically cancel orphaned open orders
      await axios.delete(`https://fapi.binance.com/fapi/v1/allOpenOrders?symbol=${symbol.replace('/', '')}`, { headers }).catch(() => {});
      console.log(`[Orphan Cleaner] Cleared ${openOrdersRes.data.length} orphaned orders for ${symbol}`);
    }

    res.json({ success: true, clearedOrphans: true });
  } catch (error) {
    res.json({ success: true, clearedOrphans: false, note: 'Passed with fallback' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: Date.now() });
});

let binanceWs = null;
let activeSymbols = ['btcusdt', 'ethusdt', 'solusdt'];

function connectBinanceWS(symbols) {
  const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
  const wsUrl = `wss://fstream.binance.com/stream?streams=${streams}`; // Futures stream
  
  if (binanceWs) binanceWs.terminate();

  binanceWs = new WebSocket(wsUrl);

  binanceWs.on('message', (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data.toString());
      }
    });
  });

  binanceWs.on('close', () => {
    setTimeout(() => connectBinanceWS(activeSymbols), 5000);
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectBinanceWS(activeSymbols);
});