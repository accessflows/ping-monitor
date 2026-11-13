import { defineConfig } from 'vite'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const devHost = process.env.TAURI_DEV_HOST
const pkg = JSON.parse(readFileSync(path.resolve(rootDir, 'package.json'), 'utf8')) as { version: string }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Release builds override the version through APP_VERSION so the UI matches the installer.
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  // Tauri needs a fixed dev server port and should keep Rust output visible.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: devHost || false,
    hmr: devHost ? { protocol: 'ws', host: devHost, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  assetsInclude: ['**/*.svg', '**/*.csv', '**/*.ttf'],
})
