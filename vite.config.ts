import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/binance-spot': {
          target: 'https://api.binance.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/binance-spot/, ''),
        },
        '/api/binance-fapi': {
          target: 'https://fapi.binance.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/binance-fapi/, ''),
        },
        '/api/binance-testnet': {
          target: 'https://testnet.binance.vision',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/binance-testnet/, ''),
        },
        '/api/binance-testnet-fapi': {
          target: 'https://testnet.binancefuture.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/binance-testnet-fapi/, ''),
        },
      },
    },
  };
});
