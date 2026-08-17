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
        icons: [],
      },
    }),
  ],
});
