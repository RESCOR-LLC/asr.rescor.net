import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/asr': {
        target: 'http://localhost:5180',
        changeOrigin: true
      }
    }
  }
});
