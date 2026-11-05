import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Target modern browsers — smaller, faster output
    target: 'es2020',
    // Split vendor libraries into cacheable chunks (LCP + cache efficiency)
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        staticCity: fileURLToPath(new URL('./static-city.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-router/')) {
            return 'router'
          }
        },
      },
    },
  },
})
