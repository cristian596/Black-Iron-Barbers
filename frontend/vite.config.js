import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // El .env único vive en la raíz del repo (VITE_API_URL, VITE_WHATSAPP_NUMERO).
  envDir: '..',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
