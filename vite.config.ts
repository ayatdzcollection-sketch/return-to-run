import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// Importing from 'vitest/config' also augments vite's UserConfig with `test`.
import { configDefaults } from 'vitest/config'

// Production is served from the /return-to-run/ GitHub Pages path; the dev
// server stays root-relative so local preview reaches it at /.
export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    // Offline app shell. The athlete opens this at a treadmill in a basement;
    // the network is not assumed. The event log already lives in IndexedDB, so
    // precaching the shell closes the remaining cold-start gap.
    //
    // manifest: false — public/manifest.json stays the canonical manifest.
    // injectRegister: null — main.tsx registers the worker itself so a new
    // deploy applies on the next reload rather than the one after it.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  base: command === 'serve' && mode === 'development' ? '/' : '/return-to-run/',
  // Honor a harness-assigned PORT (autoPort) so the dev server binds where the
  // preview tooling expects it. No PORT set → Vite's default behavior.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
  test: {
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
}))
