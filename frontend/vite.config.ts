import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function serviceWorkerPlugin() {
  const version = Date.now().toString(36);
  const swSource = `const CACHE_NAME = 'memolution-pwa-${version}';
const API_CACHE = 'memolution-api-${version}';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API requests: stale-while-revalidate (show cached, update in background)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        }),
      ),
    );
    return;
  }

  // Navigation: network-first with offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/') || caches.match(event.request)),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && (url.pathname.match(/\\.(js|css|woff2?|svg|png|webp|jpg)$/) || url.pathname.startsWith('/assets/'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});
`;
  return {
    name: 'service-worker',
    generateBundle() {
      this.emitFile({type: 'asset', fileName: 'sw.js', source: swSource});
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), serviceWorkerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': 'http://localhost:8000',
        '/media': 'http://localhost:8000',
      },
    },
  };
});
