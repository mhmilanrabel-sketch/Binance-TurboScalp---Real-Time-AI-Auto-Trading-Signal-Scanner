import React, { useRef, useEffect, useState } from 'react';
import { MarketAsset } from '../types';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MarketTickerProps {
  assets: MarketAsset[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const MarketTicker: React.FC<MarketTickerProps> = ({
  assets,
  selectedSymbol,
  onSelectSymbol,
}) => {
  const prevPrices = useRef<Record<string, number>>({});
  const [flashStatus, setFlashStatus] = useState<Record<string, 'up' | 'down'>>({});

  useEffect(() => {
    const newFlashes: Record<string, 'up' | 'down'> = {};
    let hasChanges = false;

    assets.forEach((asset) => {
      const prev = prevPrices.current[asset.symbol];
      if (prev !== undefined && prev !== asset.price) {
        newFlashes[asset.symbol] = asset.price > prev ? 'up' : 'down';
        hasChanges = true;
      }
      prevPrices.current[asset.symbol] = asset.price;
    });

    if (hasChanges) {
      setFlashStatus(newFlashes);
      const timer = setTimeout(() => {
        setFlashStatus({});
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [assets]);

  return (
    <div className="bg-slate-950/80 border-b border-slate-800/80 overflow-x-auto no-scrollbar py-2 px-3 flex items-center gap-2 select-none">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 shrink-0 pr-2 border-r border-slate-800">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span>BINANCE LIVE</span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {assets.map((asset) => {
          const isSelected = asset.symbol === selectedSymbol;
          const flash = flashStatus[asset.symbol];
          const isPos = asset.change24h >= 0;

          return (
            <button
              key={asset.symbol}
              onClick={() => onSelectSymbol(asset.symbol)}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition-all border shrink-0 ${
                isSelected
                  ? 'bg-slate-800 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
              } ${
                flash === 'up'
                  ? 'bg-emerald-950/50 border-emerald-500/60'
                  : flash === 'down'
                  ? 'bg-rose-950/50 border-rose-500/60'
                  : ''
              }`}
            >
              <span className="font-bold text-slate-200">{asset.symbol.replace('/USDT', '')}</span>

              <span
                className={`font-mono font-medium transition-colors ${
                  flash === 'up'
                    ? 'text-emerald-400 font-bold'
                    : flash === 'down'
                    ? 'text-rose-400 font-bold'
                    : 'text-slate-100'
                }`}
              >
                ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>

              <span
                className={`flex items-center text-[10px] font-semibold px-1 py-0.2 rounded ${
                  isPos
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-rose-400 bg-rose-500/10'
                }`}
              >
                {isPos ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />}
                {isPos ? '+' : ''}{asset.change24h.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
