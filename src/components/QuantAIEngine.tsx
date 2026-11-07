
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type S = {
  symbol: string;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  score: number;
  confidence: number;
  price: number;
  change24h: number;
  quoteVolume: number;
  rsi: number;
  volumeRatio: number;
  volatilityPct: number;
  stopLoss: number | null;
  takeProfit: number | null;
  reasons: string[];
};

type T = {
  id: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  entry: number;
  stop: number;
  target: number;
  notional: number;
  status: 'OPEN' | 'TP' | 'SL';
  pnl?: number;
};

const price = (n: number) =>
  n < 1
    ? '$' + n.toPrecision(5)
    : '$' + n.toLocaleString('en-US', {
        maximumFractionDigits: 4,
      });

const compact = (n: number) =>
  n > 1e9
    ? (n / 1e9).toFixed(1) + 'B'
    : n > 1e6
      ? (n / 1e6).toFixed(1) + 'M'
      : (n / 1e3).toFixed(0) + 'K';

export function QuantAIEngine() {
  const [signals, setSignals] = useState<S[]>([]);
  const [markets, setMarkets] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('score');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [bot, setBot] = useState(false);
  const [size, setSize] = useState('25');
  const [maxOpen, setMaxOpen] = useState('3');

  const [trades, setTrades] = useState<T[]>([]);

  const [selected, setSelected] = useState<S | null>(null);
  const [explain, setExplain] = useState('');
  const [busyExplain, setBusyExplain] = useState(false);

  const busy = useRef(false);

  const scan = useCallback(async () => {
    if (busy.current) return;

    busy.current = true;
    setLoading(true);
    setError('');

    try {
      const [u, s] = await Promise.all([
        fetch('/api/quant/universe', {
          cache: 'no-store',
        }),
        fetch('/api/quant/scan?limit=40&minVolume=250000', {
          cache: 'no-store',
        }),
      ]);

      const ud = await u.json();
      const sd = await s.json();

      if (!u.ok || !ud.success) {
        throw Error(ud.message || 'Market list failed');
      }

      if (!s.ok || !sd.success) {
        throw Error(sd.message || 'Scanner failed');
      }

      setMarkets(ud.count);
      setSignals(sd.signals || []);
    } catch (e: any) {
      setError(e.message || 'Quant scanner unavailable');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void scan();

    const id = setInterval(() => void scan(), 60000);

    return () => clearInterval(id);
  }, [scan]);

  const rows = useMemo(
    () =>
      signals
        .filter(s =>
          s.symbol.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) =>
          sort === 'volume'
            ? b.quoteVolume - a.quoteVolume
            : sort === 'change'
              ? b.change24h - a.change24h
              : Math.abs(b.score) - Math.abs(a.score)
        ),
    [signals, search, sort]
  );

  const open = trades.filter(t => t.status === 'OPEN');
  const closed = trades.filter(t => t.status !== 'OPEN');

  const pnl = closed.reduce(
    (v, t) => v + (t.pnl || 0),
    0
  );

  const discuss = async (s: S) => {
    setSelected(s);
    setExplain('');
    setBusyExplain(true);

    try {
      const r = await fetch('/api/quant/discuss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis: s,
        }),
      });

      const d = await r.json();

      setExplain(
        d.discussion ||
        d.message ||
        'No explanation available'
      );
    } catch (e: any) {
      setExplain(e.message);
    } finally {
      setBusyExplain(false);
    }
  };

  useEffect(() => {
    if (!bot) return;

    const id = setInterval(() => {
      setTrades(prev => {
        let next = prev.map(t => {
          if (t.status !== 'OPEN') return t;

          const s = signals.find(
            x => x.symbol === t.symbol
          );

          if (!s) return t;

          const hitSL =
            t.side === 'BUY'
              ? s.price <= t.stop
              : s.price >= t.stop;

          const hitTP =
            t.side === 'BUY'
              ? s.price >= t.target
              : s.price <= t.target;

          if (!hitSL && !hitTP) return t;

          const exit = hitSL ? t.stop : t.target;

          const move =
            t.side === 'BUY'
              ? (exit - t.entry) / t.entry
              : (t.entry - exit) / t.entry;

          return {
            ...t,
            status: hitSL ? 'SL' : 'TP',
            pnl: t.notional * move,
          } as T;
        });

        const openCount = next.filter(
          t => t.status === 'OPEN'
        ).length;

        if (
          openCount >=
          Math.min(5, Math.max(1, Number(maxOpen) || 1))
        ) {
          return next;
        }

        const candidate = signals.find(
          s =>
            s.direction !== 'NEUTRAL' &&
            Math.abs(s.score) >= 55 &&
            s.confidence >= 72 &&
            s.volatilityPct > 0.03 &&
            s.volatilityPct < 4 &&
            !next.some(
              t =>
                t.symbol === s.symbol &&
                t.status === 'OPEN'
            )
        );

        if (!candidate) return next;

        const side = candidate.direction as 'BUY' | 'SELL';

        const newTrade: T = {
          id: Date.now(),
          symbol: candidate.symbol,
          side,
          entry: candidate.price,
          stop:
            candidate.stopLoss ||
            candidate.price * (side === 'BUY' ? 0.99 : 1.01),
          target:
            candidate.takeProfit ||
            candidate.price * (side === 'BUY' ? 1.02 : 0.98),
          notional: Math.min(
            100,
            Math.max(5, Number(size) || 25)
          ),
          status: 'OPEN',
        };

        return [newTrade, ...next].slice(0, 100);
      });
    }, 15000);

    return () => clearInterval(id);
  }, [bot, signals, size, maxOpen]);

  return (
    <section className="rounded-2xl border border-cyan-500/25 bg-[#0d1726] p-4 md:p-5 space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-black tracking-widest text-cyan-300">
            QUANT AI LAB
          </h2>

          <p className="mt-1 text-[10px] text-slate-400">
            All active Binance USDⓈ-M USDT perpetuals ·
            multi-factor 15m scanner
          </p>
        </div>

        <div className="flex gap-2">
          <span className="rounded bg-slate-900 px-3 py-2 text-[10px] text-cyan-300">
            {markets} pairs
          </span>

          <button
            onClick={() => void scan()}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-3 py-2 text-[10px]"
          >
            {loading ? 'SCANNING…' : 'RESCAN ↻'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['ANALYSED', signals.length],
          ['BUY', signals.filter(s => s.direction === 'BUY').length],
          ['SELL', signals.filter(s => s.direction === 'SELL').length],
          ['OPEN PAPER', open.length],
        ].map(([k, v]) => (
          <div
            key={String(k)}
            className="rounded-lg border border-slate-800 bg-slate-900 p-3"
          >
            <p className="text-[9px] text-slate-500">{k}</p>
            <p className="mt-1 text-lg font-black text-white">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search any contract…"
          className="min-w-[180px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
        />

        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
        >
          <option value="score">Strongest score</option>
          <option value="volume">Highest volume</option>
          <option value="change">24h change</option>
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[760px] text-left text-[10px]">
          <thead className="bg-slate-950 text-slate-500">
            <tr>
              {[
                'PAIR',
                'PRICE',
                '24H',
                'VOLUME',
                'RSI',
                'SCORE',
                'SIGNAL',
                'REVIEW',
              ].map(x => (
                <th key={x} className="p-3">{x}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map(s => (
              <tr key={s.symbol} className="border-t border-slate-800">
                <td className="p-3 font-bold text-white">{s.symbol}</td>
                <td className="p-3">{price(s.price)}</td>
                <td className={`p-3 ${s.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {s.change24h.toFixed(2)}%
                </td>
                <td className="p-3">{compact(s.quoteVolume)}</td>
                <td className="p-3">{s.rsi}</td>
                <td className="p-3 font-bold">
                  {s.score > 0 ? '+' : ''}{s.score}
                </td>
                <td className="p-3">{s.direction}</td>
                <td className="p-3">
                  <button
                    onClick={() => void discuss(s)}
                    className="text-cyan-300 underline"
                  >
                    Discuss
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">

        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
          <div className="flex justify-between">
            <h3 className="text-xs font-black text-white">
              AUTONOMOUS PAPER BOT
            </h3>

            <span className="text-[9px] text-amber-300">
              NO EXCHANGE ORDERS
            </span>
          </div>

          <p className="text-[10px] text-slate-400">
            Runs on scanner signals every 15 seconds.
            Uses ATR-based stop/target levels and a strict
            open-position cap. Paper only; does not call
            the Binance order endpoint.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-slate-400">
              Notional / trade USDT
              <input
                type="number"
                min="5"
                max="100"
                value={size}
                onChange={e => setSize(e.target.value)}
                className="mt-1 w-full rounded bg-slate-900 p-2 text-white"
              />
            </label>

            <label className="text-[10px] text-slate-400">
              Max open trades
              <input
                type="number"
                min="1"
                max="5"
                value={maxOpen}
                onChange={e => setMaxOpen(e.target.value)}
                className="mt-1 w-full rounded bg-slate-900 p-2 text-white"
              />
            </label>
          </div>

          <button
            onClick={() => setBot(v => !v)}
            className={`w-full rounded-lg p-3 text-xs font-black ${
              bot
                ? 'border border-rose-500/40 bg-rose-500/10 text-rose-300'
                : 'bg-cyan-400 text-slate-950'
            }`}
          >
            {bot ? 'STOP PAPER BOT' : 'START PAPER BOT'}
          </button>

          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">
              Closed trades: {closed.length}
            </span>

            <span className={pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              Simulated PnL: {price(pnl)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-2">
          <h3 className="text-xs font-black text-white">
            AI / SIGNAL DISCUSSION
          </h3>

          {selected ? (
            <>
              <p className="text-sm font-bold text-cyan-300">
                {selected.symbol} · {selected.direction} · score {selected.score}
              </p>

              <p className="text-[10px] text-slate-400">
                {selected.reasons.join(' · ')}
              </p>

              <p className="text-[10px] leading-relaxed text-slate-200">
                {busyExplain ? 'Reviewing indicators…' : explain}
              </p>
            </>
          ) : (
            <p className="text-[10px] text-slate-500">
              Choose Discuss on a signal to see its evidence and limitations.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 p-4">
        <h3 className="mb-2 text-xs font-black text-white">
          PAPER TRADE JOURNAL
        </h3>

        {trades.slice(0, 10).map(t => (
          <div
            key={t.id}
            className="flex flex-wrap justify-between gap-2 border-b border-slate-800 py-2 text-[10px]"
          >
            <span>
              {t.symbol} {t.side} · {t.notional} USDT
            </span>

            <span>
              Entry {price(t.entry)} / SL {price(t.stop)} / TP {price(t.target)}
            </span>

            <span className={
              t.status === 'OPEN'
                ? 'text-amber-300'
                : (t.pnl || 0) >= 0
                  ? 'text-emerald-300'
                  : 'text-rose-300'
            }>
              {t.status}
              {t.pnl !== undefined ? ' · ' + price(t.pnl) : ''}
            </span>
          </div>
        ))}

        {!trades.length && (
          <p className="text-[10px] text-slate-500">
            No simulated trades yet.
          </p>
        )}
      </div>

      <p className="text-[9px] leading-relaxed text-slate-500">
        Composite score uses EMA 9/21/50 trend, Wilder RSI,
        MACD momentum, 20-candle breakout, relative volume
        and ATR volatility. Score is not a probability.
        Backtest with fees, funding, slippage and
        out-of-sample data before risking capital.
      </p>

    </section>
  );
}
