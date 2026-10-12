import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const adsDir = path.join(rootDir, 'public/ads')

// Must match DEFAULT_CLIENT in src/lib/ads.js.
const DEFAULT_CLIENT = 'gehandicaptekind'

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
//
// A GitHub Pages project site is itself served from a path segment
// (…/meta-ad-showcase/<klant>/…), so the app can't tell its own routing
// segments apart from that site prefix just by counting path segments at
// runtime — "meta-ad-showcase" is as valid a slug as "hamlin" is. Each copy
// therefore also gets a small inline script stating exactly which
// client/campaign it is for; src/lib/ads.js reads that instead of guessing
// from the URL when it's present (dev keeps the URL-guessing, since the dev
// server has no such prefix to confuse it with).
function clientPages() {
  return {
    name: 'client-pages',
    apply: 'build',
    closeBundle() {
      const distDir = path.join(rootDir, 'dist')
      const rootHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
      // `consumed` is how many trailing URL segments are this app's own
      // routing (as opposed to the site's hosting path) — stated outright
      // rather than left for the browser to guess from segment count, since
      // the root page has a hosting-path segment in its URL on GitHub Pages
      // but consumes none of it (it's the default-client link).
      const linkScript = (slug, campaign, consumed) =>
        `<script>window.__SHOWCASE_LINK__=${JSON.stringify({ slug, campaign: campaign || null, consumed })}</script>`
      const writePage = (segments, slug, campaign) => {
        const html = rootHtml
          .replaceAll('="./', `="${'../'.repeat(segments.length)}`)
          .replace('</head>', `${linkScript(slug, campaign, segments.length)}</head>`)
        const dir = path.join(distDir, ...segments)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, 'index.html'), html)
      }
      for (const client of clients()) {
        writePage([client.slug], client.slug, null)
        for (const campaign of client.campaigns) writePage([client.slug, campaign], client.slug, campaign)
      }
      // The site root itself: the default client, consuming no segment of
      // its own (any segment present there is purely the hosting path).
      fs.writeFileSync(
        path.join(distDir, 'index.html'),
        rootHtml.replace('</head>', `${linkScript(DEFAULT_CLIENT, null, 0)}</head>`)
      )
    },
  }
}

// Relative base so the build works both locally and on GitHub Pages
// (project site served from /meta-ad-showcase/).
export default defineConfig({
  base: './',
  plugins: [react(), clientPages()],
})
