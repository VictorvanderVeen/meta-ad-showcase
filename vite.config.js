import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works both locally and on GitHub Pages
// (project site served from /meta-ad-showcase/).
export default defineConfig({
  base: './',
  plugins: [react()],
})
