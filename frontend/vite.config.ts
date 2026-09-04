import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function backendHotReload() {
  return {
    name: 'backend-hot-reload',
    configureServer(server: any) {
      const backendRoot = path.resolve(__dirname, '../backend')
      // watch backend python files and trigger full reload when backend restarts
      const watcher = fs.watch ? null : null
      // use chokidar via vite's watcher by adding backend to server.watch
      server.watcher.add(path.join(backendRoot, 'app'))
      const triggerReload = (file: string) => {
        if (file.endsWith('.py')) {
          // debounce
          server.ws.send({ type: 'full-reload', path: '*' })
          console.log(`[backend] ${path.relative(backendRoot, file)} changed → full-reload`)
        }
      }
      server.watcher.on('change', triggerReload)
      server.watcher.on('add', triggerReload)

      // also poll backend health and reload when it comes back after reload
      let backendWasDown = false
      setInterval(async () => {
        try {
          const res = await fetch('http://localhost:8000/api/health').then(r => r.ok).catch(() => false)
          if (!res) backendWasDown = true
          else if (backendWasDown) {
            backendWasDown = false
            server.ws.send({ type: 'full-reload', path: '*' })
            console.log('[backend] restarted → full-reload')
          }
        } catch {}
      }, 1000)
    },
  }
}

export default defineConfig({
  plugins: [react(), backendHotReload()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: { overlay: true },
    watch: {
      // ensure vite watches backend as well (fallback)
      ignored: ['!**/backend/**', '**/node_modules/**', '**/.venv/**', '**/__pycache__/**'],
    },
    proxy: {
      '/api': 'http://localhost:8000'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: []
  }
})
