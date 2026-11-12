/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // O app decide quando atualizar (nunca no meio de uma partida).
      registerType: 'prompt',
      injectRegister: false,
      // Usa o public/manifest.webmanifest existente.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,jpg,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
