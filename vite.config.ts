import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
        timeout: 600000, // 10 minutes timeout
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Set longer timeout for generate requests
            if (req.url?.includes('/generate')) {
              proxyReq.setHeader('Connection', 'keep-alive');
              proxyReq.setHeader('Keep-Alive', 'timeout=600');
            }
          });
          proxy.on('error', (err, req, res) => {
            // Proxy error handling
          });
        }
      },
      '/knowledge': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
