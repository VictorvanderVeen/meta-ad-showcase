import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const adsDir = path.join(rootDir, 'public/ads')

function hasManifest(dir) {
  return fs.existsSync(path.join(dir, 'ads.json'))
}

function subdirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())
}

// Every folder in public/ads is one client. A client is either a single
// campaign (ads.json directly in its folder — the shape before campaigns
// existed) or an archive of campaigns (one subfolder per campaign, each
// with its own ads.json). Both shapes are valid at once; new clients get
// the archive shape, old links keep working untouched.
function clients() {
  if (!fs.existsSync(adsDir)) return []
  return subdirs(adsDir)
    .map((entry) => {
      const dir = path.join(adsDir, entry.name)
      const campaigns = subdirs(dir)
        .filter((c) => hasManifest(path.join(dir, c.name)))
        .map((c) => c.name)
      return { slug: entry.name, campaigns, legacy: hasManifest(dir) }
    })
    .filter((c) => c.legacy || c.campaigns.length > 0)
}

// GitHub Pages only serves real files, so every link (a client, and a
// client/campaign for an archive client) gets its own copy of index.html.
// Each copy sits one folder deeper than the last, hence the asset paths
// are rewritten from ./ to ../ (or ../../ for a campaign link).
function clientPages() {
  return {
    name: 'client-pages',
    apply: 'build',
    closeBundle() {
      const distDir = path.join(rootDir, 'dist')
      const rootHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
      const writePage = (segments) => {
        const html = rootHtml.replaceAll('="./', `="${'../'.repeat(segments.length)}`)
        const dir = path.join(distDir, ...segments)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, 'index.html'), html)
      }
      for (const client of clients()) {
        writePage([client.slug])
        for (const campaign of client.campaigns) writePage([client.slug, campaign])
      }
    },
  }
}

// Relative base so the build works both locally and on GitHub Pages
// (project site served from /meta-ad-showcase/).
export default defineConfig({
  base: './',
  plugins: [react(), clientPages()],
})
