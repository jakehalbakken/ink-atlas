import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

const projectRoot = import.meta.dirname;

// Source lives in src/ ; static assets (icons, manifest sources) in public/ ;
// the built site goes to dist/ . base is the GitHub Pages project path.
export default defineConfig({
  root: 'src',
  base: '/ink-atlas/',
  publicDir: resolve(projectRoot, 'public'),
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Keep three.js and the (large) body data in their own cached chunks
        // instead of inlining everything into one file.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('/src/body.js') || id.endsWith('body.js')) return 'body';
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'maskable-512.png'],
      manifest: {
        name: 'Ink Atlas',
        short_name: 'Ink Atlas',
        description: 'iPad-first 3D tattoo placement studio.',
        theme_color: '#17181d',
        background_color: '#17181d',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
