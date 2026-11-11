import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['API_PROXY_TARGET'])
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:3001'
  const url = new URL(target)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid API proxy target')
  return { plugins: [react(), tailwindcss()], server: { proxy: { '/api': { target, changeOrigin: false } } } }
})
