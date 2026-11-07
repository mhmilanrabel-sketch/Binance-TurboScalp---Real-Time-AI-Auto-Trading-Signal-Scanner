import React, { useState } from 'react';
import { BinanceApiSettings } from '../types';
import { verifyBinanceApiConnection } from '../services/binanceService';
import {
  X,
  Key,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Server,
} from 'lucide-react';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BinanceApiSettings;
  onSaveSettings: (newSettings: BinanceApiSettings) => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<BinanceApiSettings>({ ...settings });
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await verifyBinanceApiConnection(formData);
      setTestResult({
        success: res.success,
        message: res.message,
      });
      if (res.success) {
        setFormData((prev) => ({
          ...prev,
          isConfigured: true,
          usdtBalance: res.balanceUsdt,
        }));
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  const handleResetDemoBalance = () => {
    setFormData((prev) => ({ ...prev, demoBalance: 10000.0 }));
    setTestResult({
      success: true,
      message: 'Demo paper trading balance reset to $10,000.00 USDT!',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Binance API & Network Configuration</h2>
              <span className="text-[10px] text-slate-400">Zero-Latency Secure Local Storage</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
          {/* Network Selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Trading Execution Network
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              {[
                { id: 'DEMO_PAPER', label: 'Demo Paper ($10k)', desc: 'Zero Risk' },
                { id: 'BINANCE_TESTNET', label: 'Binance Testnet', desc: 'Mock API' },
                { id: 'BINANCE_LIVE', label: 'Binance Live', desc: 'Real Capital' },
              ].map((net) => (
                <button
                  type="button"
                  key={net.id}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, network: net.id as any }))
                  }
                  className={`py-2 px-1 rounded-lg font-bold text-center transition-all ${
                    formData.network === net.id
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="block text-xs">{net.label}</span>
                  <span className="text-[9px] opacity-75 block">{net.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trading Market Type */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Instrument Type
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, tradingType: 'SPOT' }))}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  formData.tradingType === 'SPOT'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Binance Spot
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, tradingType: 'FUTURES_USDM' }))}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  formData.tradingType === 'FUTURES_USDM'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                USD-M Futures (Leveraged)
              </button>
            </div>
          </div>

          {/* If Live or Testnet, Show API Key Inputs */}
          {formData.network !== 'DEMO_PAPER' ? (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Binance API Key
                </label>
                <input
                  type="text"
                  placeholder="Paste your 64-character Binance API Key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value.trim() }))}
                  className="w-full bg-slate-950 text-white font-mono p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Binance Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Paste your Binance Secret Key"
                    value={formData.apiSecret}
                    onChange={(e) => setFormData((prev) => ({ ...prev, apiSecret: e.target.value.trim() }))}
                    className="w-full bg-slate-950 text-white font-mono p-2.5 pr-10 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">Virtual Paper Balance:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  ${(formData.demoBalance || 10000).toLocaleString()} USDT
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Practice scalping and automated bot trading without risking actual capital. Orders are filled against real live Binance WebSocket prices with realistic slippage.
              </p>
              <button
                type="button"
                onClick={handleResetDemoBalance}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold pt-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Virtual Balance to $10,000.00</span>
              </button>
            </div>
          )}

          {/* Test connection feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{testResult.message}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>{testing ? 'Testing Handshake...' : 'Test Handshake'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition-all"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
