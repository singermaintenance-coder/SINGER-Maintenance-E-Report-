import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      chunkSizeWarningLimit: 1000
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // Unconditionally disable HMR to prevent localhost WebSocket connection failures in preview environments
      hmr: false,
      // Keep watcher off when HMR is off to prevent intermediate flickering
      watch: { ignored: ['**/*'] },
    },
  };
});
