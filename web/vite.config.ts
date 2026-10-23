import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  server: { host: '127.0.0.1', port: 4328, strictPort: true, watch: { ignored: ['**/.preview-data/**', '**/.preview-workspace/**', '**/preview-*.log', '**/artifacts/**'] }, proxy: { '/api': { target: 'http://127.0.0.1:4329', changeOrigin: true, configure(proxy) { proxy.on('proxyReq', request => request.setHeader('origin', 'http://127.0.0.1:4329')) } } } },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  define: {
    'import.meta.env.VITE_BASENAME': JSON.stringify(process.env.VITE_BASENAME || ''),
  }
})
