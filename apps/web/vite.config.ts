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
        theme_color: '#0f766e',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
});
