import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.DEV_PROXY_API_TARGET || 'http://localhost:8000'

  return {
    base: './',
    plugins: [react()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.js'],
    },
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api/organizze-proxy': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/api/v1': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  }
})
