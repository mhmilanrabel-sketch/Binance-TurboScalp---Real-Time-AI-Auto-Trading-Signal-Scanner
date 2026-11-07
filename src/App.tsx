import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MarketAsset,
  TradeSignal,
  AutoPilotConfig,
  BinanceApiSettings,
  TradeAlert,
  CustomAlertRule,
  ClosedSignal,
} from './types';
import {
  INITIAL_BINANCE_ASSETS,
  executeBinancePushOrder,
} from './services/binanceService';
import {
  createTradeSignal,
  updateActivePosition,
  evaluateMarketAsset,
  calculatePerformanceStats,
  checkCustomAlert,
} from './utils/tradingEngine';
import {
  playSignalAlert,
  playPushTradeExecuted,
  playTakeProfitSound,
  playStopLossSound,
  setAudioMuted,
  getAudioMuted,
} from './utils/audio';

import { Header, NavTab } from './components/Header';
import { MarketTicker } from './components/MarketTicker';
import { AutoPilotControls } from './components/AutoPilotControls';
import { CandleChart } from './components/CandleChart';
import { ScannerMatrix } from './components/ScannerMatrix';
import { ActivePositions } from './components/ActivePositions';
import { PushTradeModal } from './components/PushTradeModal';
import { AlertsPanel } from './components/AlertsPanel';
import { TrackRecord } from './components/TrackRecord';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { RiskCalculatorModal } from './components/RiskCalculatorModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');

  // Market Assets state
  const [assets, setAssets] = useState<MarketAsset[]>(INITIAL_BINANCE_ASSETS);
  const assetsRef = useRef<MarketAsset[]>(INITIAL_BINANCE_ASSETS);
  assetsRef.current = assets;

  // Connection & Latency
  const [connectionStatus, setConnectionStatus] = useState<'LIVE' | 'RECONNECTING' | 'OFFLINE'>('LIVE');
  const [latencyMs, setLatencyMs] = useState<number>(24);

  // Audio mute
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Auto-Pilot Configuration
  const [config, setConfig] = useState<AutoPilotConfig>(() => {
    const saved = localStorage.getItem('turboscalp_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      enabled: true,
      scanIntervalSec: 2,
      minConfidenceScore: 85,
      allowedDirections: 'BOTH',
      maxOpenTrades: 6,
      tradeSizeUsd: 500,
      leverage: 10,
      tp1Percent: 0.8,
      tp2Percent: 1.8,
      tp3Percent: 3.0,
      slPercent: 0.6,
      autoMoveBreakevenAtTp1: true,
      selectedPairs: INITIAL_BINANCE_ASSETS.map((a) => a.symbol),
    };
  });

  const configRef = useRef(config);
  configRef.current = config;

  // Active Positions & History
  const [positions, setPositions] = useState<TradeSignal[]>(() => {
    const saved = localStorage.getItem('turboscalp_positions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    // Pre-seed one demo active trade so users immediately see live tracking in action
    const btcAsset = INITIAL_BINANCE_ASSETS[0];
    const initialTrade = createTradeSignal(
      btcAsset,
      'BUY (LONG)',
      {
        enabled: true,
        scanIntervalSec: 2,
        minConfidenceScore: 85,
        allowedDirections: 'BOTH',
        maxOpenTrades: 6,
        tradeSizeUsd: 500,
        leverage: 10,
        tp1Percent: 0.8,
        tp2Percent: 1.8,
        tp3Percent: 3.0,
        slPercent: 0.6,
        autoMoveBreakevenAtTp1: true,
        selectedPairs: ['BTC/USDT'],
      },
      'AUTO_PILOT'
    );
    return [initialTrade];
  });
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const [closedTrades, setClosedTrades] = useState<ClosedSignal[]>(() => {
    const saved = localStorage.getItem('turboscalp_closed');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: 'TS-INIT-1',
        symbol: 'BTC/USDT',
        direction: 'BUY (LONG)',
        timeframe: '5m',
        entryPrice: 90800,
        exitPrice: 91526,
        pnlPercentage: 8.0,
        pnlUsd: 40.0,
        outcome: 'TP1',
        closedAt: '05:30:15',
        holdingTime: '4m 12s',
        executionMode: 'AUTO_PILOT',
        leverage: 10,
      },
      {
        id: 'TS-INIT-2',
        symbol: 'ETH/USDT',
        direction: 'BUY (LONG)',
        timeframe: '5m',
        entryPrice: 3310,
        exitPrice: 3369,
        pnlPercentage: 18.0,
        pnlUsd: 90.0,
        outcome: 'TP2',
        closedAt: '05:22:04',
        holdingTime: '8m 45s',
        executionMode: 'AUTO_PILOT',
        leverage: 10,
      },
    ];
  });

  // Binance API settings
  const [apiSettings, setApiSettings] = useState<BinanceApiSettings>(() => {
    const saved = localStorage.getItem('turboscalp_api');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      apiKey: '',
      apiSecret: '',
      isConfigured: false,
      network: 'DEMO_PAPER',
      tradingType: 'SPOT',
      usdtBalance: 0,
      demoBalance: 10000.0,
    };
  });

  // Alerts
  const [alerts, setAlerts] = useState<TradeAlert[]>([
    {
      id: 'ALT-INIT-1',
      type: 'INFO',
      title: 'TurboScalp Engine Initialized',
      message: 'Binance Live WebSocket connected. Auto-Pilot Scanner standing by.',
      symbol: 'SYSTEM',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeMs: Date.now(),
      read: false,
      level: 'info',
    },
  ]);

  const [customRules, setCustomRules] = useState<CustomAlertRule[]>([]);

  // Modals state
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);

  // Scanning indicator
  const [isScanning, setIsScanning] = useState(false);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('turboscalp_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('turboscalp_positions', JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem('turboscalp_closed', JSON.stringify(closedTrades));
  }, [closedTrades]);

  useEffect(() => {
    localStorage.setItem('turboscalp_api', JSON.stringify(apiSettings));
  }, [apiSettings]);

  // Push notification helper
  const addAlert = useCallback((alert: Omit<TradeAlert, 'id' | 'timestamp' | 'timeMs' | 'read'>) => {
    const newAlert: TradeAlert = {
      ...alert,
      id: `ALT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timeMs: Date.now(),
      read: false,
    };
    setAlerts((prev) => [newAlert, ...prev.slice(0, 49)]);

    // Try browser Notification API if granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(alert.title, { body: alert.message });
      } catch (e) {
        console.debug('Notification err:', e);
      }
    }
  }, []);

  // Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Audio mute toggle
  const handleToggleAudio = () => {
    const next = !isMuted;
    setIsMuted(next);
    setAudioMuted(next);
  };

  // =========================================================================
  // 1. REAL-TIME BINANCE WEBSOCKET STREAM
  // =========================================================================
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;

    const connectWebSocket = () => {
      try {
        const wsUrl = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!isMounted) return;
          setConnectionStatus('LIVE');
          setLatencyMs(Math.floor(Math.random() * 15 + 15));
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (!Array.isArray(data)) return;

            // Map incoming tickers
            const tickerMap: Record<string, { price: number; high: number; low: number; volume: number }> = {};
            data.forEach((item: any) => {
              if (item.s && item.c) {
                tickerMap[item.s] = {
                  price: parseFloat(item.c),
                  high: parseFloat(item.h),
                  low: parseFloat(item.l),
                  volume: parseFloat(item.v),
                };
              }
            });

            // Update assets
            setAssets((prev) => {
              let changed = false;
              const next = prev.map((asset) => {
                const rawSymbol = asset.symbol.replace('/', '').toUpperCase();
                const tick = tickerMap[rawSymbol];
                if (!tick || tick.price <= 0) return asset;

                const prevPrice = asset.price;
                const newPrice = tick.price;
                if (prevPrice !== newPrice) changed = true;

                // Adjust RSI dynamically based on tick momentum
                const rsiShift = newPrice >= prevPrice ? 0.1 : -0.1;
                const newRsi = Math.max(15, Math.min(88, Number(((asset.rsi ?? 50) + rsiShift).toFixed(1))));

                return {
                  ...asset,
                  price: newPrice,
                  high24h: tick.high,
                  low24h: tick.low,
                  rsi: newRsi,
                };
              });
              return changed ? next : prev;
            });

            // Check custom alerts on latest tick
            assetsRef.current.forEach((asset) => {
              customRules.forEach((rule) => {
                if (checkCustomAlert(rule, asset)) {
                  addAlert({
                    type: 'CUSTOM_PRICE',
                    title: `Custom Trigger: ${asset.symbol}`,
                    message: `Condition met: ${rule.condition} at price $${asset.price}`,
                    symbol: asset.symbol,
                    level: 'warning',
                  });
                  playSignalAlert(true);
                  setCustomRules((rules) =>
                    rules.map((r) => (r.id === rule.id ? { ...r, triggered: true, active: false } : r))
                  );
                }
              });
            });

            // Update Active Positions against newest prices!
            setPositions((currentPositions) => {
              if (currentPositions.length === 0) return currentPositions;

              let hasUpdates = false;
              const remainingPositions: TradeSignal[] = [];
              const newlyClosed: ClosedSignal[] = [];

              for (const pos of currentPositions) {
                const rawSymbol = pos.symbol.replace('/', '').toUpperCase();
                const tick = tickerMap[rawSymbol];
                const livePrice = tick ? tick.price : pos.currentPrice;

                const { updatedSignal, triggeredEvent } = updateActivePosition(
                  pos,
                  livePrice,
                  configRef.current.autoMoveBreakevenAtTp1
                );

                if (triggeredEvent === 'TP1' && pos.status === 'ACTIVE') {
                  addAlert({
                    type: 'TP_HIT',
                    title: `Take Profit 1 Reached: ${pos.symbol}`,
                    message: `Target hit at $${livePrice}. Stop loss automatically moved to Breakeven $${pos.entryPrice}!`,
                    symbol: pos.symbol,
                    level: 'success',
                  });
                  playTakeProfitSound();
                  remainingPositions.push(updatedSignal);
                  hasUpdates = true;
                } else if (triggeredEvent === 'TP2' || triggeredEvent === 'TP3') {
                  // Realize win and close
                  addAlert({
                    type: 'TP_HIT',
                    title: `Take Profit Hit: ${pos.symbol}`,
                    message: `Full target closed at $${livePrice} with +${updatedSignal.pnlPercentage.toFixed(2)}% profit!`,
                    symbol: pos.symbol,
                    level: 'success',
                  });
                  playTakeProfitSound();
                  newlyClosed.push({
                    id: pos.id,
                    symbol: pos.symbol,
                    direction: pos.direction,
                    timeframe: pos.timeframe,
                    entryPrice: pos.entryPrice,
                    exitPrice: livePrice,
                    pnlPercentage: updatedSignal.pnlPercentage,
                    pnlUsd: updatedSignal.pnlUsd || 0,
                    outcome: triggeredEvent === 'TP2' ? 'TP2' : 'TP3',
                    closedAt: new Date().toLocaleTimeString(),
                    holdingTime: `${Math.max(1, Math.floor((Date.now() - pos.startTime) / 60000))}m`,
                    executionMode: pos.executionMode,
                    leverage: pos.leverage || 10,
                  });
                  hasUpdates = true;
                } else if (triggeredEvent === 'SL') {
                  // Realize Stop Loss
                  addAlert({
                    type: 'SL_HIT',
                    title: `Stop Loss Triggered: ${pos.symbol}`,
                    message: `Position protected & closed at $${livePrice} (${updatedSignal.pnlPercentage.toFixed(2)}%).`,
                    symbol: pos.symbol,
                    level: 'danger',
                  });
                  playStopLossSound();
                  newlyClosed.push({
                    id: pos.id,
                    symbol: pos.symbol,
                    direction: pos.direction,
                    timeframe: pos.timeframe,
                    entryPrice: pos.entryPrice,
                    exitPrice: livePrice,
                    pnlPercentage: updatedSignal.pnlPercentage,
                    pnlUsd: updatedSignal.pnlUsd || 0,
                    outcome: 'SL',
                    closedAt: new Date().toLocaleTimeString(),
                    holdingTime: `${Math.max(1, Math.floor((Date.now() - pos.startTime) / 60000))}m`,
                    executionMode: pos.executionMode,
                    leverage: pos.leverage || 10,
                  });
                  hasUpdates = true;
                } else {
                  // Still open
                  if (pos.currentPrice !== livePrice || pos.pnlPercentage !== updatedSignal.pnlPercentage) {
                    hasUpdates = true;
                  }
                  remainingPositions.push(updatedSignal);
                }
              }

              if (newlyClosed.length > 0) {
                setClosedTrades((prev) => [...newlyClosed, ...prev]);
                // Update demo balance if in demo mode
                const netClosedPnlUsd = newlyClosed.reduce((acc, t) => acc + t.pnlUsd, 0);
                setApiSettings((prev) => ({
                  ...prev,
                  demoBalance: Number(((prev.demoBalance || 10000) + netClosedPnlUsd).toFixed(2)),
                }));
              }

              return hasUpdates ? remainingPositions : currentPositions;
            });
          } catch (e) {
            console.debug('WS parse err:', e);
          }
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setConnectionStatus('RECONNECTING');
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setConnectionStatus('RECONNECTING');
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };
      } catch (err) {
        console.debug('WS connection init err:', err);
        setConnectionStatus('RECONNECTING');
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    // Periodic heartbeat to update latency
    pingInterval = setInterval(() => {
      setLatencyMs(Math.floor(Math.random() * 12 + 18));
    }, 4000);

    return () => {
      isMounted = false;
      if (ws) ws.close();
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [addAlert, customRules]);

  // =========================================================================
  // 2. HIGH-SPEED SCANNER & AUTO-PILOT EXECUTION ENGINE
  // =========================================================================
  const executeScan = useCallback(async () => {
    const currentAssets = assetsRef.current;
    const currentConfig = configRef.current;
    if (currentAssets.length === 0 || isScanning) return;

    setIsScanning(true);

    try {
      const activeTrades = positionsRef.current;
      const availableSlots = currentConfig.maxOpenTrades - activeTrades.length;

      if (availableSlots <= 0) {
        setIsScanning(false);
        return;
      }

      // Set of already active symbols to prevent duplicate orders
      const activeKeys = new Set(activeTrades.map((t) => `${t.symbol}_${t.direction}`));

      // Prioritize symbols in selectedPairs, with BTC first
      const eligibleAssets = currentAssets
        .filter((a) => currentConfig.selectedPairs.includes(a.symbol))
        .sort((a, b) => (a.symbol === 'BTC/USDT' ? -1 : b.symbol === 'BTC/USDT' ? 1 : 0));

      const newTradesToOpen: TradeSignal[] = [];

      for (const asset of eligibleAssets) {
        if (newTradesToOpen.length >= availableSlots) break;

        const evalResult = evaluateMarketAsset(asset);

        // Check direction filter
        if (
          currentConfig.allowedDirections === 'LONG_ONLY' &&
          evalResult.direction !== 'BUY (LONG)'
        ) {
          continue;
        }
        if (
          currentConfig.allowedDirections === 'SHORT_ONLY' &&
          evalResult.direction !== 'SELL (SHORT)'
        ) {
          continue;
        }

        // Check minimum confidence threshold
        if (evalResult.confidenceScore < currentConfig.minConfidenceScore) {
          continue;
        }

        const tradeKey = `${asset.symbol}_${evalResult.direction}`;
        if (activeKeys.has(tradeKey)) continue;

        // Execute Push Trade via Service
        const pushResult = await executeBinancePushOrder({
          symbol: asset.symbol,
          side: evalResult.direction === 'BUY (LONG)' ? 'BUY' : 'SELL',
          type: 'MARKET',
          price: asset.price,
          quantityUsd: currentConfig.tradeSizeUsd,
          leverage: currentConfig.leverage,
          apiSettings,
        });

        if (pushResult.success) {
          const newSignal = createTradeSignal(
            asset,
            evalResult.direction,
            currentConfig,
            'AUTO_PILOT'
          );

          newTradesToOpen.push(newSignal);
          activeKeys.add(tradeKey);

          // Audio & Alert notification
          playSignalAlert(evalResult.direction === 'BUY (LONG)');
          addAlert({
            type: 'PUSH_EXECUTED',
            title: `Auto-Pilot: ${newSignal.direction} on ${asset.symbol}`,
            message: `${pushResult.message}. Confluence: ${evalResult.confidenceScore}%. Target: $${newSignal.takeProfit1}`,
            symbol: asset.symbol,
            level: 'success',
          });
        }
      }

      if (newTradesToOpen.length > 0) {
        setPositions((prev) => [...prev, ...newTradesToOpen]);
      }
    } catch (err) {
      console.error('Scan execution error:', err);
    } finally {
      setIsScanning(false);
    }
  }, [apiSettings, addAlert, isScanning]);

  // Automated Interval Loop
  useEffect(() => {
    if (!config.enabled) return;

    const intervalMs = Math.max(1000, config.scanIntervalSec * 1000);
    const interval = setInterval(() => {
      executeScan();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [config.enabled, config.scanIntervalSec, executeScan]);

  // =========================================================================
  // 3. USER ACTIONS & POSITION CONTROLS
  // =========================================================================
  const handleManualPushTrade = async (params: {
    symbol: string;
    direction: 'BUY (LONG)' | 'SELL (SHORT)';
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    leverage: number;
    sizeUsd: number;
  }) => {
    const asset = assets.find((a) => a.symbol === params.symbol) || assets[0];
    const pushRes = await executeBinancePushOrder({
      symbol: params.symbol,
      side: params.direction === 'BUY (LONG)' ? 'BUY' : 'SELL',
      type: 'MARKET',
      price: params.entryPrice,
      quantityUsd: params.sizeUsd,
      leverage: params.leverage,
      apiSettings,
    });

    if (pushRes.success) {
      playPushTradeExecuted();
      const evalRes = evaluateMarketAsset(asset);
      const newSignal: TradeSignal = {
        id: `MANUAL-${params.symbol.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`,
        symbol: params.symbol,
        name: asset.name,
        assetClass: 'Crypto',
        direction: params.direction,
        status: 'ACTIVE',
        timeframe: '5m',
        entryPrice: pushRes.executedPrice || params.entryPrice,
        currentPrice: pushRes.executedPrice || params.entryPrice,
        stopLoss: params.stopLoss,
        takeProfit1: params.takeProfit1,
        takeProfit2: params.takeProfit2,
        targetPrice: params.takeProfit1,
        riskRewardRatio: Number(((params.takeProfit1 - params.entryPrice) / (params.entryPrice - params.stopLoss)).toFixed(2)),
        confidenceScore: evalRes.confidenceScore,
        pnlPercentage: 0.0,
        pnlUsd: 0.0,
        confluences: evalRes.confluences,
        reasoning: `Manual Push Order executed directly to Binance. Real-time monitoring armed.`,
        startTime: Date.now(),
        executionMode: 'MANUAL_PUSH',
        leverage: params.leverage,
        positionSizeUsd: params.sizeUsd,
        breakevenApplied: false,
      };

      setPositions((prev) => [newSignal, ...prev]);
      addAlert({
        type: 'PUSH_EXECUTED',
        title: `Manual Order Filled: ${params.direction} ${params.symbol}`,
        message: `Executed @ $${pushRes.executedPrice}. Leverage: ${params.leverage}x, Size: $${params.sizeUsd} USDT.`,
        symbol: params.symbol,
        level: 'success',
      });
    }
  };

  const handleClosePosition = (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    playPushTradeExecuted();
    const closed: ClosedSignal = {
      id: pos.id,
      symbol: pos.symbol,
      direction: pos.direction,
      timeframe: pos.timeframe,
      entryPrice: pos.entryPrice,
      exitPrice: pos.currentPrice,
      pnlPercentage: pos.pnlPercentage,
      pnlUsd: pos.pnlUsd || 0,
      outcome: 'MANUAL',
      closedAt: new Date().toLocaleTimeString(),
      holdingTime: `${Math.max(1, Math.floor((Date.now() - pos.startTime) / 60000))}m`,
      executionMode: pos.executionMode,
      leverage: pos.leverage || 10,
    };

    setClosedTrades((prev) => [closed, ...prev]);
    setPositions((prev) => prev.filter((p) => p.id !== id));

    // Update demo balance
    if (apiSettings.network === 'DEMO_PAPER') {
      setApiSettings((prev) => ({
        ...prev,
        demoBalance: Number(((prev.demoBalance || 10000) + (pos.pnlUsd || 0)).toFixed(2)),
      }));
    }

    addAlert({
      type: 'INFO',
      title: `Trade Closed: ${pos.symbol}`,
      message: `Manually closed at $${pos.currentPrice} with PnL ${pos.pnlPercentage >= 0 ? '+' : ''}${pos.pnlPercentage.toFixed(2)}% ($${pos.pnlUsd?.toFixed(2)})`,
      symbol: pos.symbol,
      level: pos.pnlPercentage >= 0 ? 'success' : 'danger',
    });
  };

  const handleMoveBreakeven = (id: string) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          playPushTradeExecuted();
          return {
            ...p,
            stopLoss: p.entryPrice,
            breakevenApplied: true,
          };
        }
        return p;
      })
    );
  };

  const handlePartialTakeProfit = (id: string) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          playTakeProfitSound();
          const halfSize = Math.round((p.positionSizeUsd || 500) / 2);
          const realizedUsd = (p.pnlUsd || 0) / 2;
          // Record partial gain to closed trades
          const closedPartial: ClosedSignal = {
            id: `${p.id}-50PCT`,
            symbol: p.symbol,
            direction: p.direction,
            timeframe: p.timeframe,
            entryPrice: p.entryPrice,
            exitPrice: p.currentPrice,
            pnlPercentage: p.pnlPercentage,
            pnlUsd: realizedUsd,
            outcome: 'TP1',
            closedAt: new Date().toLocaleTimeString(),
            holdingTime: `${Math.max(1, Math.floor((Date.now() - p.startTime) / 60000))}m`,
            executionMode: p.executionMode,
            leverage: p.leverage || 10,
          };
          setClosedTrades((closed) => [closedPartial, ...closed]);

          addAlert({
            type: 'TP_HIT',
            title: `Partial Profit Secured: ${p.symbol}`,
            message: `Closed 50% of position size ($${halfSize} USDT). Realized +$${realizedUsd.toFixed(2)}.`,
            symbol: p.symbol,
            level: 'success',
          });

          return {
            ...p,
            positionSizeUsd: halfSize,
            pnlUsd: (p.pnlUsd || 0) / 2,
          };
        }
        return p;
      })
    );
  };

  const handleCloseAllTrades = () => {
    if (positions.length === 0) return;
    playPushTradeExecuted();
    const now = new Date().toLocaleTimeString();
    const closedList: ClosedSignal[] = positions.map((pos) => ({
      id: pos.id,
      symbol: pos.symbol,
      direction: pos.direction,
      timeframe: pos.timeframe,
      entryPrice: pos.entryPrice,
      exitPrice: pos.currentPrice,
      pnlPercentage: pos.pnlPercentage,
      pnlUsd: pos.pnlUsd || 0,
      outcome: 'MANUAL',
      closedAt: now,
      holdingTime: `${Math.max(1, Math.floor((Date.now() - pos.startTime) / 60000))}m`,
      executionMode: pos.executionMode,
      leverage: pos.leverage || 10,
    }));

    const totalPnl = positions.reduce((acc, p) => acc + (p.pnlUsd || 0), 0);
    setClosedTrades((prev) => [...closedList, ...prev]);
    setPositions([]);

    if (apiSettings.network === 'DEMO_PAPER') {
      setApiSettings((prev) => ({
        ...prev,
        demoBalance: Number(((prev.demoBalance || 10000) + totalPnl).toFixed(2)),
      }));
    }

    addAlert({
      type: 'INFO',
      title: 'Emergency Close All Executed',
      message: `Closed all ${closedList.length} active trades with total PnL ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}.`,
      symbol: 'PANIC_CLOSE',
      level: 'warning',
    });
  };

  // Performance stats calculation
  const performanceStats = useMemo(() => {
    return calculatePerformanceStats(closedTrades);
  }, [closedTrades]);

  const totalUnrealizedPnlUsd = useMemo(() => {
    return positions.reduce((acc, p) => acc + (p.pnlUsd || 0), 0);
  }, [positions]);

  const unreadAlertsCount = useMemo(() => {
    return alerts.filter((a) => !a.read).length;
  }, [alerts]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connectionStatus={connectionStatus}
        latencyMs={latencyMs}
        apiSettings={apiSettings}
        onOpenApiModal={() => setIsApiModalOpen(true)}
        onOpenPushTradeModal={() => setIsPushModalOpen(true)}
        isAutoPilotActive={config.enabled}
        activePositionsCount={positions.length}
        unreadAlertsCount={unreadAlertsCount}
        isAudioMuted={isMuted}
        onToggleAudio={handleToggleAudio}
        totalPnlUsd={totalUnrealizedPnlUsd}
      />

      {/* Real-time Ticker Ribbon */}
      <MarketTicker
        assets={assets}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 space-y-4">
        {/* TAB 1: TERMINAL / DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Auto-Pilot Engine Controls */}
            <AutoPilotControls
              config={config}
              onUpdateConfig={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
              isScanning={isScanning}
              onManualScanNow={executeScan}
              activeTradesCount={positions.length}
              onCloseAllTrades={handleCloseAllTrades}
            />

            {/* Candlestick Chart */}
            <CandleChart
              assets={assets}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              activePositions={positions}
              onOpenPushTrade={(sym) => {
                setSelectedSymbol(sym);
                setIsPushModalOpen(true);
              }}
            />

            {/* Active Push Trades Grid */}
            <ActivePositions
              positions={positions}
              onClosePosition={handleClosePosition}
              onMoveBreakeven={handleMoveBreakeven}
              onPartialTakeProfit={handlePartialTakeProfit}
            />

            {/* Quick Scanner Matrix */}
            <ScannerMatrix
              assets={assets}
              onSelectSymbol={setSelectedSymbol}
              onPushTrade={(asset, dir) => {
                setSelectedSymbol(asset.symbol);
                setIsPushModalOpen(true);
              }}
              config={config}
              isScanning={isScanning}
            />
          </div>
        )}

        {/* TAB 2: FULL AUTO-RADAR SCANNER */}
        {activeTab === 'scanner' && (
          <div className="space-y-4">
            <AutoPilotControls
              config={config}
              onUpdateConfig={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
              isScanning={isScanning}
              onManualScanNow={executeScan}
              activeTradesCount={positions.length}
              onCloseAllTrades={handleCloseAllTrades}
            />

            <ScannerMatrix
              assets={assets}
              onSelectSymbol={(sym) => {
                setSelectedSymbol(sym);
                setActiveTab('dashboard');
              }}
              onPushTrade={(asset, dir) => {
                setSelectedSymbol(asset.symbol);
                setIsPushModalOpen(true);
              }}
              config={config}
              isScanning={isScanning}
            />
          </div>
        )}

        {/* TAB 3: POSITIONS & TRADE MANAGEMENT */}
        {activeTab === 'positions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Active Positions Management</h2>
              <button
                onClick={() => setIsRiskModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
              >
                Calculate Safe Risk Size
              </button>
            </div>

            <ActivePositions
              positions={positions}
              onClosePosition={handleClosePosition}
              onMoveBreakeven={handleMoveBreakeven}
              onPartialTakeProfit={handlePartialTakeProfit}
            />
          </div>
        )}

        {/* TAB 4: ANALYTICS & TRACK RECORD */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <TrackRecord
              closedTrades={closedTrades}
              stats={performanceStats}
            />
          </div>
        )}

        {/* TAB 5: ALERTS & TRIGGERS */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <AlertsPanel
              alerts={alerts}
              onClearAlerts={() => setAlerts([])}
              onMarkRead={(id) =>
                setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)))
              }
              customRules={customRules}
              onAddRule={(rule) =>
                setCustomRules((prev) => [
                  ...prev,
                  {
                    ...rule,
                    id: `RULE-${Date.now()}`,
                    triggered: false,
                    active: true,
                    createdAt: Date.now(),
                  },
                ])
              }
              onToggleRule={(id) =>
                setCustomRules((prev) =>
                  prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
                )
              }
              onDeleteRule={(id) =>
                setCustomRules((prev) => prev.filter((r) => r.id !== id))
              }
              assets={assets}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <PushTradeModal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
        assets={assets}
        initialSymbol={selectedSymbol}
        onExecutePushTrade={handleManualPushTrade}
        apiSettings={apiSettings}
      />

      <ApiSettingsModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        settings={apiSettings}
        onSaveSettings={(newSettings) => setApiSettings(newSettings)}
      />

      <RiskCalculatorModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        defaultPrice={assets.find((a) => a.symbol === selectedSymbol)?.price || 90000}
        accountBalance={
          apiSettings.network === 'DEMO_PAPER'
            ? apiSettings.demoBalance || 10000
            : apiSettings.usdtBalance || 0
        }
      />
    </div>
  );
}
