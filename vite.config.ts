/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths: the same build works on GitHub Pages (/<repo>/) and locally.
  base: './',
  plugins: [
    svelte(),
    // Installable, offline-capable app for the tablet: everything is precached on first visit.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['CC-BY.txt', 'apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Plateau SRD 5.2.1',
        short_name: 'Plateau SRD',
        description:
          'Fiche de personnage interactive pour les règles 2024 (SRD 5.2.1) / interactive character sheet for the 2024 rules (SRD 5.2.1)',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#fbfaf7',
        theme_color: '#1a1714',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,webp,png,svg,txt}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // one JS bundle with the SRD data in three languages (5.6 MB on 2026-10-26)
      },
    }),
  ],
  test: {
    projects: [
      // Engine, model and server-side rendering tests.
      { extends: true, test: { name: 'node', include: ['src/**/*.test.ts'], exclude: ['src/**/*.dom.test.ts'] } },
      // Panes mounted with Svelte's browser runtime (happy-dom): catches errors that only exist there (a keyed
      // {#each} with a duplicate key, state written while rendering), which made the Spells tab refuse to open.
      {
        extends: true,
        resolve: { conditions: ['browser'] },
        test: { name: 'dom', include: ['src/**/*.dom.test.ts'], environment: 'happy-dom', testTimeout: 60_000 },
      },
    ],
  },
})
