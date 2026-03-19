import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function manualChunks(id: string) {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (id.includes('pdf-lib') || id.includes('fontkit')) return 'vendor-pdf';
  if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n';
  if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
    return 'vendor-form';
  }
  if (id.includes('react-router-dom')) return 'vendor-router';
  if (id.includes('@tanstack/react-query')) return 'vendor-query';

  return 'vendor';
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        name: 'LedgerFlow 记账软件',
        short_name: 'LedgerFlow',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/logo.png',
            sizes: '720x720',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks
      }
    }
  }
});
