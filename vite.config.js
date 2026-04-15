import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/tests/setup.js'],
    env: {
      VITE_API_BASE_URL: 'http://localhost:8090/api/v1',
      VITE_PUBLIC_API_URL: 'http://localhost:8090',
    },
  },
})
