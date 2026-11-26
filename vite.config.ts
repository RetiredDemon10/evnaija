import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * The landing page is the entry route but it is lazy-loaded, so the browser
 * cannot discover its chunk until the main bundle has parsed and executed.
 * This injects a `modulepreload` hint (with the hashed filename) so the hero
 * route and its dependency graph download in parallel with the entry chunk
 * instead of in a waterfall after it.
 */
function preloadLandingChunk(): Plugin {
  return {
    name: 'ev-naija:preload-landing',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      const bundle = ctx.bundle ?? {}
      const tags = Object.values(bundle)
        .filter((item) => item.type === 'chunk' && /(^|\/)HomePage-/.test(item.fileName))
        .map((chunk) => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', href: `/${chunk.fileName}`, crossorigin: true },
          injectTo: 'head' as const,
        }))
      return { html, tags }
    },
  }
}

export default defineConfig({
  plugins: [react(), preloadLandingChunk()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    // MapLibre ships its worker as a module URL; prebundling breaks that worker
    // in dev, so let Vite serve the package directly.
    exclude: ['maplibre-gl'],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the large, rarely-changing vendors into their own long-lived
        // chunks. The entry chunk stays small, vendors download in parallel
        // and a repeat visit reuses them from cache. Charting (recharts) and
        // the map engine (maplibre) are already code-split by their lazy routes
        // and are left to Rollup so their shared utilities stay with the entry.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('react-router')) return 'router'
          if (id.includes('react-dom') || id.includes('scheduler') || /node_modules\/react\//.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
})
