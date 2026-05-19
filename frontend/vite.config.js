import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'events'],
    }),
  ],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      three: path.resolve('node_modules/three'),
    },
  },
  build: {
    outDir: 'build',
    // Đợt 13 (hiệu năng): sau route-level code-splitting main chunk ~427kB
    // (trước 1769kB). Hạ band-aid 6000→900 để BẮT hồi quy bundle.
    chunkSizeWarningLimit: 900,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', '@headlessui/react'],
          web3: ['ethers'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['three'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    https: (() => {
      const keyPath = path.resolve(__dirname, 'localhost-key.pem');
      const certPath = path.resolve(__dirname, 'localhost.pem');
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
      }
      return false;
    })(),
    port: 3000,
    fs: {
      strict: true,
      allow: ['..'],
    },
  },
  preview: {
    https: (() => {
      const keyPath = path.resolve(__dirname, 'localhost-key.pem');
      const certPath = path.resolve(__dirname, 'localhost.pem');
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
      }
      return false;
    })(),
    port: 5000,
  },
});
