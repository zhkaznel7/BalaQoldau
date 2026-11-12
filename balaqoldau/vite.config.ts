import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { approvedAssets } from '../scripts/release-policy.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['API_PROXY_TARGET'])
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:3001'
  const url = new URL(target)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid API proxy target')
  return {
    plugins: [react(), tailwindcss(), {
      name: 'licensed-public-assets',
      apply: 'build',
      generateBundle() {
        for (const asset of approvedAssets(fileURLToPath(new URL('../', import.meta.url)))) {
          this.emitFile({ type: 'asset', fileName: asset.output, source: asset.bytes })
        }
      },
    }],
    build: { copyPublicDir: false },
    server: { proxy: { '/api': { target, changeOrigin: false } } },
  }
})
