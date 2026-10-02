import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const adsDir = path.join(rootDir, 'public/ads')

// Every folder in public/ads with an ads.json is one client.
function clientSlugs() {
  if (!fs.existsSync(adsDir)) return []
  return fs
    .readdirSync(adsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(adsDir, entry.name, 'ads.json')))
    .map((entry) => entry.name)
}

// GitHub Pages only serves real files, so each client link (…/<klant>/) gets
// its own copy of index.html. The copy sits one folder deeper, hence the
// asset paths are rewritten from ./ to ../.
function clientPages() {
  return {
    name: 'client-pages',
    apply: 'build',
    closeBundle() {
      const distDir = path.join(rootDir, 'dist')
      const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8').replaceAll('="./', '="../')
      for (const slug of clientSlugs()) {
        fs.mkdirSync(path.join(distDir, slug), { recursive: true })
        fs.writeFileSync(path.join(distDir, slug, 'index.html'), html)
      }
    },
  }
}

// Relative base so the build works both locally and on GitHub Pages
// (project site served from /meta-ad-showcase/).
export default defineConfig({
  base: './',
  plugins: [react(), clientPages()],
  define: {
    __CLIENT_SLUGS__: JSON.stringify(clientSlugs()),
  },
})
