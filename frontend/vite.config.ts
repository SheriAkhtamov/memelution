import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function serviceWorkerPlugin() {
  const swSource = `self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach((client) => {
        if (client.navigate) {
          client.navigate(client.url);
        }
      });
    })
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

function packageNameFromModuleId(id: string) {
  const normalizedId = id.replaceAll(path.sep, '/');
  const nodeModulesIndex = normalizedId.lastIndexOf('/node_modules/');
  if (nodeModulesIndex === -1) return undefined;

  const parts = normalizedId.slice(nodeModulesIndex + '/node_modules/'.length).split('/');
  if (parts[0]?.startsWith('@')) return `${parts[0]}/${parts[1]}`;
  return parts[0];
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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            const packageName = packageNameFromModuleId(id);
            if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
              return 'vendor-react';
            }
            if (packageName === 'react-router' || packageName === 'react-router-dom') return 'vendor-router';
            if (packageName === '@tanstack/query-core' || packageName === '@tanstack/react-query') return 'vendor-query';
            if (packageName === 'lucide-react') return 'vendor-icons';
            return 'vendor';
          },
        },
      },
    },
  };
});
