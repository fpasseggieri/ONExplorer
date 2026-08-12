import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frontendPort = Number.parseInt(process.env.PORT, 10) || 3000;

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/notifyServer': `http://127.0.0.1:${frontendPort + 1}`
    }
  },
  build: {
    outDir: 'build'
  }
});
