import React, { useState } from 'react';
import { X, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

export function ApiSettingsModal({ isOpen, onClose, settings, onSaveSettings }: any) {
  const [network, setNetwork] = useState(settings.network || 'DEMO_PAPER');
  const [instrumentType, setInstrumentType] = useState('FUTURE'); // Only Future now
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [apiSecret, setApiSecret] = useState(settings.apiSecret || '');
  const [showSecret, setShowSecret] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  if (!isOpen) return null;

  const handleTestHandshake = async () => {
    setTestStatus({ message: 'Testing secure handshake with Binance Futures...' });
    try {
      const res = await fetch('/api/binance-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: '/fapi/v2/account', apiKey, secretKey: apiSecret })
      });

      // Safe JSON parsing handling to prevent Unexpected end of JSON input crash
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Server returned invalid JSON response during handshake.');
      }

      if (res.ok) {
        setTestStatus({ success: true, message: 'Handshake successful! Binance Futures connected.' });
      } else {
        setTestStatus({ success: false, message: data.details || data.error || 'Authentication failed. Check API keys.' });
      }
    } catch (err: any) {
      setTestStatus({ success: false, message: err.message || 'Connection failed: Unexpected response format.' });
    }
  };

  const handleSave = () => {
    onSaveSettings({
      ...settings,
      network,
      instrumentType: 'FUTURE',
      apiKey,
      apiSecret,
      isConfigured: true
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#131822] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl font-mono text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Binance API & Network Configuration</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Network Mode */}
        <div className="space-y-2">
          <label className="text-xs text-slate-400 uppercase font-bold">Trading Execution Network</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'DEMO_PAPER', label: 'Demo Paper ($10k)', sub: 'Zero Risk' },
              { id: 'BINANCE_TESTNET', label: 'Binance Testnet', sub: 'Mock API' },
              { id: 'BINANCE_LIVE', label: 'Binance Live', sub: 'Real Capital' },
            ].map((net) => (
              <button
                key={net.id}
                onClick={() => setNetwork(net.id)}
                className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                  network === net.id
                    ? 'bg-amber-500 text-black border-amber-400 font-bold'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs">{net.label}</div>
                <div className="text-[10px] opacity-75">{net.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Instrument Type (Spot Removed, Only Future Remains) */}
        <div className="space-y-2">
          <label className="text-xs text-slate-400 uppercase font-bold">Instrument Type</label>
          <div className="w-full p-3 rounded-xl bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border border-purple-500/50 text-purple-200 font-bold text-center text-sm">
            ⚡ Future (USD-M Leveraged Contracts)
          </div>
        </div>

        {/* API Credentials */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Binance API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter Binance API Key"
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Binance Secret Key</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter Binance Secret Key"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500 outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {testStatus && (
          <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${testStatus.success ? 'bg-emerald-950/50 border border-emerald-500 text-emerald-300' : testStatus.success === false ? 'bg-rose-950/50 border border-rose-500 text-rose-300' : 'bg-slate-900 border border-slate-700 text-slate-300'}`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{testStatus.message}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={handleTestHandshake}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Test Handshake
          </button>

          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}