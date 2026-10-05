import { resolve } from 'node:path';

export default {
  base: './',
  server: { fs: { allow: [resolve('..')] } },
  worker: { format: 'iife' },
  build: {
    target: 'es2022',
    rollupOptions: { input: { home: resolve('index.html'), features: resolve('features.html'), plans: resolve('plans.html'), why: resolve('why-humm.html') } },
  },
};
