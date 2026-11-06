import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is hosted at a fixed path on db.vdveen.online (Caddy serves dist/
// there, with every unknown path falling back to index.html). Because the
// path is fixed, src/lib/ads.js reads the client and campaign straight from
// the URL: a new client or campaign is a few PocketBase records, not a build.
// Deploy with pocketbase/app-naar-server.sh.
export default defineConfig({
  base: '/showcase/',
  plugins: [react()],
})
