import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve, basename } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

// MediaPipe's runtime (automatic cutout) is served from this site, never a CDN.
// It is copied out of node_modules at build time and served from there in dev.
// The models, public/vision/magic_touch.tflite and pose_landmarker_full.task, are checked in (Apache-2.0).
const VISION_WASM = resolve(import.meta.dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
function visionRuntime() {
  return {
    name: 'vision-runtime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /\/vision\/(vision_wasm[a-z_]*\.(?:js|wasm))$/.exec((req.url || '').split('?')[0]);
        if (!m) return next();
        res.setHeader('Content-Type', m[1].endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(resolve(VISION_WASM, m[1])));
      });
    },
    generateBundle() {
      for (const f of readdirSync(VISION_WASM)) this.emitFile({ type: 'asset', fileName: 'vision/' + basename(f), source: readFileSync(resolve(VISION_WASM, f)) });
    },
  };
}

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
    visionRuntime(),
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
        // The cutout runtime and model are big and only needed when someone uses
        // automatic cutout: fetch them then, and keep them for offline use after.
        globIgnores: ['vision/**'],
        runtimeCaching: [{ urlPattern: /\/vision\/[^/]+\.(?:js|wasm|tflite|task)$/, handler: 'CacheFirst', options: { cacheName: 'ink-atlas-vision', expiration: { maxEntries: 8 } } }],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
