import { defineConfig } from 'vitest/config';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { releaseProblems } from './scripts/release-config.ts';
import pkg from './package.json' with { type: 'json' };

/** Production builds get a Content-Security-Policy: the app may only load its own files (no remote
 * scripts, styles, fonts or frames). Blob URLs are for the audio worklet fallback and exported videos. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'humm-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

// HTTPS is required for microphone access on phones (getUserMedia needs a secure context).
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (mode === 'release') {
    const problems = releaseProblems(env);
    if (problems.length) throw new Error('Release configuration is incomplete:\n' + problems.join('\n'));
  } else if (mode !== 'testing' && env.VITE_DEV_PRO === 'true') {
    throw new Error('VITE_DEV_PRO=true requires an explicit testing build. Use npm run build:testing.');
  }
  return {
  plugins: [
    basicSsl(),
    contentSecurityPolicy(),
    {
      name: 'humm-release-marker',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'humm-release.json', source: JSON.stringify({
          ready: mode === 'release', mode, version: pkg.version,
        }) });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'HUMM — Hum a melody, get a band',
        short_name: 'HUMM',
        description: 'Hum a melody, get a full band.',
        theme_color: '#F6F4EF',
        background_color: '#F6F4EF',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,webmanifest}'],
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', sourcemap: false },
  worker: { format: 'iife' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  };
});
