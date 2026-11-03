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

// Victor's own overview of every client and campaign, for his bookmarks.
// Deliberately not at the site root: clients see that link, and must not see
// each other's campaigns. The random suffix keeps the page unguessable, and
// noindex keeps it out of search engines.
const OVERVIEW_PATH = 'overzicht-840415de'

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

function overviewPage() {
  return {
    name: 'overview-page',
    apply: 'build',
    closeBundle() {
      const fmt = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
      const sections = clients()
        .map((client) => {
          const dir = path.join(adsDir, client.slug)
          const listing = readJson(path.join(dir, 'campaigns.json'))
          const legacy = client.legacy ? readJson(path.join(dir, 'ads.json')) : null
          const name = listing?.client || legacy?.client || client.slug
          const listed = new Map((listing?.campaigns || []).map((c) => [c.slug, c]))
          const rows = client.campaigns
            .map((slug) => {
              const meta = listed.get(slug)
              const ads = readJson(path.join(dir, slug, 'ads.json'))?.ads?.length ?? 0
              return { href: `../${client.slug}/${slug}/`, label: meta?.name || slug, ads, updatedAt: meta?.updatedAt }
            })
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
          if (client.legacy) {
            rows.push({ href: `../${client.slug}/`, label: client.campaigns.length ? 'Oudere losse set' : 'Advertenties', ads: legacy?.ads?.length ?? 0 })
          }
          const items = rows
            .map(
              (r) =>
                `<li><a href="${r.href}">${escapeHtml(r.label)}</a><span>${r.ads} ads${r.updatedAt ? ` · ${fmt.format(new Date(r.updatedAt))}` : ''}</span></li>`
            )
            .join('')
          return `<section><h2><a href="../${client.slug}/">${escapeHtml(name)}</a></h2><ul>${items}</ul></section>`
        })
        .join('\n')
      const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Showcase — alle klanten</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#f4f5f7;color:#212121;margin:0;padding:40px 20px}
main{max-width:760px;margin:0 auto}h1{font-size:28px;margin:0 0 24px}
section{background:#fff;border-radius:12px;padding:18px 22px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h2{font-size:19px;margin:0 0 8px}h2 a{color:#212121;text-decoration:none}h2 a:hover{color:#ef3713}
ul{list-style:none;margin:0;padding:0}li{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-top:1px solid #eee}
li a{color:#ef3713;text-decoration:none;font-weight:600}li a:hover{text-decoration:underline}li span{color:#777;font-size:14px;white-space:nowrap}
</style></head><body><main><h1>Showcase — alle klanten</h1>
${sections}
</main></body></html>
`
      const outDir = path.join(rootDir, 'dist', OVERVIEW_PATH)
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(path.join(outDir, 'index.html'), html)
    },
  }
}

// Relative base so the build works both locally and on GitHub Pages
// (project site served from /meta-ad-showcase/).
export default defineConfig({
  base: './',
  plugins: [react(), clientPages(), overviewPage()],
})
