import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildId = new Date().toISOString();

export default defineConfig({
  base: './',
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId }, null, 2),
        });
      },
    },
  ],
  server: {
    port: 5180,
  },
  build: {
    target: 'esnext',
  },
});
