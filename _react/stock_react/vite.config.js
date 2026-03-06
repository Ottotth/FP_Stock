import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // forward API calls to Spring Boot backend running on 8080
      '/heatMapData': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/updateheatMapData': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/recent30Data': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/realTimeStock': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/stockdata': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/lastcandle': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/stockNews': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  },
})
