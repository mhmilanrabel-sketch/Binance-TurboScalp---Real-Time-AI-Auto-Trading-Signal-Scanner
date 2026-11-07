import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MarketAsset, TradeSignal, CandleData, Timeframe } from '../types';
import { generateCandleHistory } from '../utils/indicators';
import { fetchBinanceKlines } from '../services/binanceService';
import {
  TrendingUp,
  Layers,
  Activity,
  Eye,
  EyeOff,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

interface CandleChartProps {
  assets: MarketAsset[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  activePositions: TradeSignal[];
  onOpenPushTrade: (symbol: string) => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  assets,
  selectedSymbol,
  onSelectSymbol,
  activePositions,
  onOpenPushTrade,
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [subIndicator, setSubIndicator] = useState<'rsi' | 'macd' | 'none'>('rsi');
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  const [crosshairX, setCrosshairX] = useState<number | null>(null);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);

  const chartHeight = 320;
  const subChartHeight = subIndicator !== 'none' ? 90 : 0;

  const currentAsset = useMemo(() => {
    return (
      assets.find((a) => a.symbol === selectedSymbol) ||
      assets[0] || {
        symbol: 'BTC/USDT',
        name: 'Bitcoin',
        price: 91450.00,
        change24h: 2.14,
        high24h: 92800.00,
        low24h: 89600.00,
        volume24h: '$2.84B',
        assetClass: 'Crypto' as const,
      }
    );
  }, [assets, selectedSymbol]);

  // Find active position for the current symbol
  const activeTrade = useMemo(() => {
    return activePositions.find((p) => p.symbol === currentAsset.symbol);
  }, [activePositions, currentAsset.symbol]);

  // Load candle data from Binance REST or synthetic initial feed
  useEffect(() => {
    let isCancelled = false;
    const loadCandles = async () => {
      // 1. Generate immediate synthetic candles so UI never flickers
      const minutes = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '1h' ? 60 : timeframe === '4h' ? 240 : 1440;
      const initial = generateCandleHistory(currentAsset.price, 60, minutes);
      if (!isCancelled) setCandles(initial);

      // 2. Try fetching true Binance klines
      try {
        const liveKlines = await fetchBinanceKlines(currentAsset.symbol, timeframe, 60);
        if (!isCancelled && liveKlines && liveKlines.length > 10) {
          // Re-generate indicators over true klines
          const closes = liveKlines.map((c) => c.close);
          const enriched = generateCandleHistory(currentAsset.price, 60, minutes);
          // blend the true prices
          liveKlines.forEach((k, idx) => {
            if (enriched[idx]) {
              enriched[idx].open = k.open;
              enriched[idx].high = k.high;
              enriched[idx].low = k.low;
              enriched[idx].close = k.close;
              enriched[idx].volume = k.volume;
            }
          });
          if (!isCancelled) setCandles(enriched);
        }
      } catch (err) {
        console.debug('Klines fetch fallback:', err);
      }
    };

    loadCandles();
    return () => {
      isCancelled = true;
    };
  }, [currentAsset.symbol, timeframe]);

  // Update the latest candle in real time from WebSocket price
  useEffect(() => {
    setCandles((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const last = { ...copy[copy.length - 1] };
      last.close = currentAsset.price;
      if (currentAsset.price > last.high) last.high = currentAsset.price;
      if (currentAsset.price < last.low) last.low = currentAsset.price;
      copy[copy.length - 1] = last;
      return copy;
    });
  }, [currentAsset.price]);

  // Observe width changes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setChartWidth(Math.max(380, Math.floor(entries[0].contentRect.width)));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute SVG Scaling
  const { minPrice, maxPrice, priceRange, paddingY } = useMemo(() => {
    if (candles.length === 0) {
      return { minPrice: 100, maxPrice: 105, priceRange: 5, paddingY: 20 };
    }
    let min = Infinity;
    let max = -Infinity;

    candles.forEach((c) => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (showBollinger && c.bbUpper && c.bbLower) {
        if (c.bbUpper > max) max = c.bbUpper;
        if (c.bbLower < min) min = c.bbLower;
      }
    });

    // Expand bounds if active trade has TP/SL outside current range
    if (activeTrade) {
      if (activeTrade.stopLoss < min) min = activeTrade.stopLoss;
      if (activeTrade.takeProfit1 > max) max = activeTrade.takeProfit1;
      if (activeTrade.takeProfit2 > max) max = activeTrade.takeProfit2;
    }

    const range = (max - min) || 1;
    const pad = range * 0.08;
    return {
      minPrice: min - pad,
      maxPrice: max + pad,
      priceRange: range + pad * 2,
      paddingY: 20,
    };
  }, [candles, showBollinger, activeTrade]);

  const getY = (price: number): number => {
    return paddingY + ((maxPrice - price) / priceRange) * (chartHeight - paddingY * 2);
  };

  const candleWidth = Math.max(3, (chartWidth - 80) / Math.max(1, candles.length));

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col gap-3">
      {/* Chart Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-800">
        {/* Asset Title & Live Price */}
        <div className="flex items-center gap-3">
          <select
            value={currentAsset.symbol}
            onChange={(e) => onSelectSymbol(e.target.value)}
            className="bg-slate-950 text-white font-extrabold text-sm sm:text-base px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {assets.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol}
              </option>
            ))}
          </select>

          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg sm:text-xl font-black text-white">
              ${currentAsset.price < 1 ? currentAsset.price.toFixed(4) : currentAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`text-xs font-bold ${
                currentAsset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {currentAsset.change24h >= 0 ? '+' : ''}{currentAsset.change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Timeframe Selectors & Toggles */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Timeframe Buttons */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                  timeframe === tf
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Indicator toggles */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setShowEma20(!showEma20)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                showEma20 ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500'
              }`}
            >
              EMA 20
            </button>
            <button
              onClick={() => setShowEma50(!showEma50)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                showEma50 ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500'
              }`}
            >
              EMA 50
            </button>
            <button
              onClick={() => setShowBollinger(!showBollinger)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                showBollinger ? 'bg-purple-500/20 text-purple-300' : 'text-slate-500'
              }`}
            >
              BBands
            </button>
            <button
              onClick={() => setSubIndicator(subIndicator === 'rsi' ? 'none' : 'rsi')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                subIndicator === 'rsi' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500'
              }`}
            >
              RSI
            </button>
          </div>

          {/* Quick Trade Push */}
          <button
            onClick={() => onOpenPushTrade(currentAsset.symbol)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-md active:scale-95 flex items-center gap-1"
          >
            <span>Trade {currentAsset.symbol.replace('/USDT', '')}</span>
          </button>
        </div>
      </div>

      {/* Hover Information Readout */}
      <div className="h-5 flex items-center gap-3 text-[11px] font-mono text-slate-400">
        {hoveredCandle ? (
          <>
            <span>O: <span className="text-slate-200">${hoveredCandle.open.toFixed(2)}</span></span>
            <span>H: <span className="text-emerald-400">${hoveredCandle.high.toFixed(2)}</span></span>
            <span>L: <span className="text-rose-400">${hoveredCandle.low.toFixed(2)}</span></span>
            <span>C: <span className="text-slate-200">${hoveredCandle.close.toFixed(2)}</span></span>
            <span>RSI: <span className="text-amber-400">{hoveredCandle.rsi?.toFixed(1) || '50'}</span></span>
          </>
        ) : (
          <span className="text-slate-500">Hover over any candle to inspect multi-indicator values</span>
        )}
      </div>

      {/* Main SVG Candlestick Chart Area */}
      <div
        ref={containerRef}
        className="w-full relative select-none cursor-crosshair overflow-hidden rounded-xl bg-slate-950 border border-slate-800/80"
        style={{ height: chartHeight + subChartHeight }}
        onMouseLeave={() => {
          setHoveredCandle(null);
          setCrosshairX(null);
        }}
      >
        <svg
          width={chartWidth}
          height={chartHeight + subChartHeight}
          className="w-full h-full block"
        >
          {/* Horizontal Grid Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const y = paddingY + ratio * (chartHeight - paddingY * 2);
            const priceLevel = maxPrice - ratio * priceRange;
            return (
              <g key={ratio}>
                <line
                  x1={0}
                  y1={y}
                  x2={chartWidth - 65}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                <text
                  x={chartWidth - 60}
                  y={y + 3}
                  fill="#64748b"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  ${priceLevel < 1 ? priceLevel.toFixed(4) : priceLevel.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Bollinger Bands Fill & Lines */}
          {showBollinger && (
            <>
              {/* Upper Line */}
              <polyline
                fill="none"
                stroke="#a855f7"
                strokeWidth={1}
                strokeDasharray="2 2"
                points={candles
                  .map((c, i) => `${i * candleWidth + candleWidth / 2},${getY(c.bbUpper || c.close)}`)
                  .join(' ')}
              />
              {/* Lower Line */}
              <polyline
                fill="none"
                stroke="#a855f7"
                strokeWidth={1}
                strokeDasharray="2 2"
                points={candles
                  .map((c, i) => `${i * candleWidth + candleWidth / 2},${getY(c.bbLower || c.close)}`)
                  .join(' ')}
              />
            </>
          )}

          {/* EMA 20 line */}
          {showEma20 && (
            <polyline
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1.5}
              points={candles
                .filter((c) => c.ema20 !== undefined)
                .map((c, i) => `${i * candleWidth + candleWidth / 2},${getY(c.ema20!)}`)
                .join(' ')}
            />
          )}

          {/* EMA 50 line */}
          {showEma50 && (
            <polyline
              fill="none"
              stroke="#06b6d4"
              strokeWidth={1.5}
              points={candles
                .filter((c) => c.ema50 !== undefined)
                .map((c, i) => `${i * candleWidth + candleWidth / 2},${getY(c.ema50!)}`)
                .join(' ')}
            />
          )}

          {/* Candlesticks & Volume Bars */}
          {candles.map((candle, idx) => {
            const x = idx * candleWidth;
            const cx = x + candleWidth / 2;
            const isGreen = candle.close >= candle.open;
            const color = isGreen ? '#10b981' : '#f43f5e';

            const openY = getY(candle.open);
            const closeY = getY(candle.close);
            const highY = getY(candle.high);
            const lowY = getY(candle.low);

            const bodyY = Math.min(openY, closeY);
            const bodyH = Math.max(2, Math.abs(closeY - openY));

            // Volume bar at chart bottom
            const volH = showVolume ? Math.min(45, (candle.volume / 10000) * 35) : 0;
            const volY = chartHeight - volH;

            return (
              <g
                key={candle.time || idx}
                onMouseEnter={() => {
                  setHoveredCandle(candle);
                  setCrosshairX(cx);
                }}
              >
                {/* Volume Bar */}
                {showVolume && (
                  <rect
                    x={x + 1}
                    y={volY}
                    width={Math.max(1, candleWidth - 2)}
                    height={volH}
                    fill={color}
                    opacity={0.25}
                  />
                )}

                {/* Wick */}
                <line
                  x1={cx}
                  y1={highY}
                  x2={cx}
                  y2={lowY}
                  stroke={color}
                  strokeWidth={1.2}
                />

                {/* Body */}
                <rect
                  x={x + 1}
                  y={bodyY}
                  width={Math.max(2, candleWidth - 2)}
                  height={bodyH}
                  fill={color}
                  rx={1}
                />
              </g>
            );
          })}

          {/* Active Trade Overlays: Entry, TP1, Stop Loss lines */}
          {activeTrade && (
            <>
              {/* Entry line */}
              <line
                x1={0}
                y1={getY(activeTrade.entryPrice)}
                x2={chartWidth - 65}
                y2={getY(activeTrade.entryPrice)}
                stroke="#e2e8f0"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <rect
                x={chartWidth - 65}
                y={getY(activeTrade.entryPrice) - 8}
                width={60}
                height={16}
                fill="#334155"
                rx={3}
              />
              <text
                x={chartWidth - 60}
                y={getY(activeTrade.entryPrice) + 4}
                fill="#ffffff"
                fontSize={9}
                fontFamily="monospace"
                fontWeight="bold"
              >
                ENTRY
              </text>

              {/* Take Profit 1 Line */}
              <line
                x1={0}
                y1={getY(activeTrade.takeProfit1)}
                x2={chartWidth - 65}
                y2={getY(activeTrade.takeProfit1)}
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <rect
                x={chartWidth - 65}
                y={getY(activeTrade.takeProfit1) - 8}
                width={60}
                height={16}
                fill="#065f46"
                rx={3}
              />
              <text
                x={chartWidth - 60}
                y={getY(activeTrade.takeProfit1) + 4}
                fill="#34d399"
                fontSize={9}
                fontFamily="monospace"
                fontWeight="bold"
              >
                TP 1
              </text>

              {/* Stop Loss Line */}
              <line
                x1={0}
                y1={getY(activeTrade.stopLoss)}
                x2={chartWidth - 65}
                y2={getY(activeTrade.stopLoss)}
                stroke="#f43f5e"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <rect
                x={chartWidth - 65}
                y={getY(activeTrade.stopLoss) - 8}
                width={60}
                height={16}
                fill="#881337"
                rx={3}
              />
              <text
                x={chartWidth - 60}
                y={getY(activeTrade.stopLoss) + 4}
                fill="#fb7185"
                fontSize={9}
                fontFamily="monospace"
                fontWeight="bold"
              >
                SL
              </text>
            </>
          )}

          {/* Current Live Price Pulsing Line */}
          <line
            x1={0}
            y1={getY(currentAsset.price)}
            x2={chartWidth - 65}
            y2={getY(currentAsset.price)}
            stroke="#f59e0b"
            strokeWidth={1.5}
          />
          <circle
            cx={chartWidth - 68}
            cy={getY(currentAsset.price)}
            r={3}
            fill="#f59e0b"
            className="animate-ping"
          />
          <rect
            x={chartWidth - 65}
            y={getY(currentAsset.price) - 9}
            width={62}
            height={18}
            fill="#f59e0b"
            rx={3}
          />
          <text
            x={chartWidth - 60}
            y={getY(currentAsset.price) + 4}
            fill="#020617"
            fontSize={9}
            fontFamily="monospace"
            fontWeight="black"
          >
            ${currentAsset.price < 1 ? currentAsset.price.toFixed(4) : currentAsset.price.toFixed(1)}
          </text>

          {/* Subchart: RSI (14) */}
          {subIndicator === 'rsi' && (
            <g transform={`translate(0, ${chartHeight})`}>
              <line x1={0} y1={0} x2={chartWidth} y2={0} stroke="#334155" strokeWidth={1} />
              {/* RSI 70 Line */}
              <line x1={0} y1={subChartHeight * 0.3} x2={chartWidth - 65} y2={subChartHeight * 0.3} stroke="#f43f5e" strokeDasharray="2 2" opacity={0.5} />
              {/* RSI 30 Line */}
              <line x1={0} y1={subChartHeight * 0.7} x2={chartWidth - 65} y2={subChartHeight * 0.7} stroke="#10b981" strokeDasharray="2 2" opacity={0.5} />
              
              <text x={chartWidth - 60} y={subChartHeight * 0.3 + 3} fill="#f43f5e" fontSize={9} fontFamily="monospace">70 OB</text>
              <text x={chartWidth - 60} y={subChartHeight * 0.7 + 3} fill="#10b981" fontSize={9} fontFamily="monospace">30 OS</text>
              <text x={10} y={15} fill="#94a3b8" fontSize={10} fontWeight="bold">RSI (14)</text>

              {/* RSI Plot */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.5}
                points={candles
                  .map((c, i) => {
                    const r = c.rsi ?? 50;
                    const ry = subChartHeight - (r / 100) * subChartHeight;
                    return `${i * candleWidth + candleWidth / 2},${ry}`;
                  })
                  .join(' ')}
              />
            </g>
          )}

          {/* Crosshair cursor */}
          {crosshairX !== null && (
            <line
              x1={crosshairX}
              y1={0}
              x2={crosshairX}
              y2={chartHeight + subChartHeight}
              stroke="#64748b"
              strokeDasharray="2 2"
              strokeWidth={1}
            />
          )}
        </svg>
      </div>
    </div>
  );
};
