import React from 'react';
import { MarketAsset, AutoPilotConfig } from '../types';
import { evaluateMarketAsset } from '../utils/tradingEngine';
import {
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  LineChart,
  Shield,
  Activity,
  Flame,
  CheckCircle,
} from 'lucide-react';

interface ScannerMatrixProps {
  assets: MarketAsset[];
  onSelectSymbol: (symbol: string) => void;
  onPushTrade: (asset: MarketAsset, direction: 'BUY (LONG)' | 'SELL (SHORT)') => void;
  config: AutoPilotConfig;
  isScanning: boolean;
}

export const ScannerMatrix: React.FC<ScannerMatrixProps> = ({
  assets,
  onSelectSymbol,
  onPushTrade,
  config,
  isScanning,
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header bar */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/90">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>Binance Real-Time Scalp Radar</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {assets.length} Active Feeds
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multi-indicator confluence scanner (RSI + EMA Golden/Death Cross + MACD + Volume)
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700">
            <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
            <span>{isScanning ? 'Multi-Scanner Running' : 'Live WebSocket Sync'}</span>
          </span>
        </div>
      </div>

      {/* Table view */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Asset Pair</th>
              <th className="py-3 px-3">Live Price</th>
              <th className="py-3 px-3">24h Change</th>
              <th className="py-3 px-3">RSI (14)</th>
              <th className="py-3 px-3">EMA Trend</th>
              <th className="py-3 px-3">Confluence</th>
              <th className="py-3 px-3">Signal Setup</th>
              <th className="py-3 px-4 text-right">Instant Push</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {assets.map((asset) => {
              const evalRes = evaluateMarketAsset(asset);
              const isLong = evalRes.direction === 'BUY (LONG)';
              const isEligible = evalRes.confidenceScore >= config.minConfidenceScore;
              const rsi = asset.rsi ?? 50;

              return (
                <tr
                  key={asset.symbol}
                  className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  onClick={() => onSelectSymbol(asset.symbol)}
                >
                  {/* Pair Name */}
                  <td className="py-3 px-4 font-bold text-slate-100 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSymbol(asset.symbol);
                      }}
                      className="p-1 rounded bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                      title="View chart"
                    >
                      <LineChart className="w-3.5 h-3.5" />
                    </button>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm">{asset.symbol}</span>
                        {isEligible && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            PRIME
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">{asset.name}</span>
                    </div>
                  </td>

                  {/* Live Price */}
                  <td className="py-3 px-3 font-mono font-bold text-slate-100">
                    ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* 24h Change */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-0.5 font-bold ${
                        asset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {asset.change24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                    </span>
                  </td>

                  {/* RSI */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                          rsi <= 35
                            ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                            : rsi >= 65
                            ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {rsi.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-500 hidden xl:inline">
                        {rsi <= 35 ? 'Oversold' : rsi >= 65 ? 'Overbought' : 'Neutral'}
                      </span>
                    </div>
                  </td>

                  {/* EMA Trend */}
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        asset.emaTrend === 'BULLISH'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          asset.emaTrend === 'BULLISH' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      {asset.emaTrend || (asset.change24h >= 0 ? 'BULLISH' : 'BEARISH')}
                    </span>
                  </td>

                  {/* Confluence Score */}
                  <td className="py-3 px-3">
                    <div className="w-24">
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                        <span className={evalRes.confidenceScore >= 90 ? 'text-amber-400' : 'text-slate-300'}>
                          {evalRes.confidenceScore}%
                        </span>
                        <span className="text-[9px] text-slate-500">R:R {evalRes.riskRewardRatio}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            evalRes.confidenceScore >= 90
                              ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                              : evalRes.confidenceScore >= 80
                              ? 'bg-emerald-400'
                              : 'bg-slate-500'
                          }`}
                          style={{ width: `${evalRes.confidenceScore}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Signal Setup */}
                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-sm ${
                        isLong
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      <Zap className="w-3 h-3 fill-current" />
                      <span>{isLong ? 'LONG BUY' : 'SHORT SELL'}</span>
                    </span>
                  </td>

                  {/* Instant Push Buttons */}
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onPushTrade(asset, 'BUY (LONG)')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 font-bold text-xs transition-all shadow-sm"
                        title={`Push LONG ${asset.symbol} to Binance`}
                      >
                        Long
                      </button>
                      <button
                        onClick={() => onPushTrade(asset, 'SELL (SHORT)')}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs transition-all shadow-sm"
                        title={`Push SHORT ${asset.symbol} to Binance`}
                      >
                        Short
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
