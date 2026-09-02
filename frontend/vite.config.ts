import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-static-home',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== '/' && req.url !== '') return next()
          const home = path.resolve('public/home.html')
          if (!fs.existsSync(home)) return next()
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(fs.readFileSync(home))
        })
      },
    },
  ],
  server: {
    proxy: {
      '/api/seo-crm': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})