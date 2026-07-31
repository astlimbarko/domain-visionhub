import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // Separa las dependencias pesadas en chunks propios: quedan cacheadas
        // por el navegador independiente del código de la app (que cambia en
        // cada deploy), y las páginas que no las usan no las descargan.
        codeSplitting: {
          groups: [
            { name: 'vendor-charts', test: /node_modules[\\/](recharts|d3-[\w-]+|victory-vendor|decimal\.js-light|internmap|delaunator|robust-predicates)[\\/]/ },
            { name: 'vendor-radix', test: /node_modules[\\/](radix-ui|@radix-ui|cmdk)[\\/]/ },
            { name: 'vendor-i18n', test: /node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'vendor-tanstack', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
})
