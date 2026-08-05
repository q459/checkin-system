import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '課堂線上簽到系統',
        short_name: '簽到系統',
        description: '方便快速的學生課堂線上簽到工具',
        theme_color: '#4CAF50',
        background_color: '#ffffff',
        display: 'standalone', // 全螢幕運行，無瀏覽器網址列
        orientation: 'portrait',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3408/3408591.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3408/3408591.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});