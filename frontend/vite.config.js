import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Serve public/<path>/index.html for directory URLs like /events/ in dev,
// so Vite's SPA fallback doesn't hijack them to the React root.
function staticDirIndexPlugin() {
  return {
    name: 'static-dir-index',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        try {
          const url = req.url || '/'
          const qIdx = url.search(/[?#]/)
          const pathname = qIdx >= 0 ? url.slice(0, qIdx) : url
          const suffix = qIdx >= 0 ? url.slice(qIdx) : ''
          if (pathname === '/' || !pathname.endsWith('/')) return next()
          const candidate = join(server.config.publicDir, pathname, 'index.html')
          if (existsSync(candidate)) {
            req.url = pathname + 'index.html' + suffix
          }
        } catch (_) { /* fall through */ }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), staticDirIndexPlugin()],
  base: '/',
})
