import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MasterQala',
        short_name: 'MasterQala',
        // Раньше здесь стоял бирюзовый, которого не было ни в старой палитре,
        // ни в новой. Теперь — --color-primary.
        theme_color: '#1E40AF',
        background_color: '#F8FAFC',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // maskable отдельным элементом: тот же ключ на заливке без
          // скругления — форму вырезает ОС, и purpose:any не годится для неё
          // (проверено кругом safe zone 80% при рендере, см. scripts/generate-brand-assets).
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
