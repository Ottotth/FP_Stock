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
      }
    }
  },
})
