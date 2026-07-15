import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        timeout: 300000,
      },
      '/legacy': {
        target: 'http://localhost:4000',
        timeout: 300000,
      },
    },
  },
});
