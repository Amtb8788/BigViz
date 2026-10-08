import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const MOCK_DIR = fileURLToPath(new URL('./src/mock', import.meta.url))

/**
 * Serves `src/mock/*.json` at `/mock/*.json` in dev and copies them into `dist/mock/` on build,
 * so the screen fetches mock data exactly the way it would fetch a real API.
 * Delete this plugin (and the folder) once `VITE_API_URL` points at a real backend.
 */
function mockJson(): Plugin {
  const files = () => readdirSync(MOCK_DIR).filter((f) => f.endsWith('.json'))
  return {
    name: 'bigviz-mock-json',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /^\/mock\/([\w-]+\.json)(?:\?.*)?$/.exec(req.url ?? '')
        const name = match?.[1]
        if (!name || !files().includes(name)) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(readFileSync(`${MOCK_DIR}/${name}`))
      })
    },
    generateBundle() {
      for (const name of files()) {
        this.emitFile({
          type: 'asset',
          fileName: `mock/${name}`,
          source: readFileSync(`${MOCK_DIR}/${name}`)
        })
      }
    }
  }
}

export default defineConfig({
  // Relative base so the built screen also works from a sub-path or file share
  base: './',
  plugins: [vue(), mockJson()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  build: {
    // ECharts alone is ~600 kB minified; split it so the app chunk stays small
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: { echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'] }
      }
    }
  }
})
