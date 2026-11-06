import { useEffect, useState } from 'react';
import { loadOverview } from '../lib/ads';
import './Overview.css';

const fmt = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

/** Victor's own list of every client and campaign (OVERVIEW_SLUG in lib/ads.js). */
export default function Overview() {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Showcase — alle klanten';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.append(robots);
    loadOverview().then(setClients, (err) => setError(err.message));
  }, []);

  return (
    <main className="overview">
      <h1>Showcase — alle klanten</h1>
      {error && <p>Kon het overzicht niet laden: {error}</p>}
      {!clients && !error && <p>Laden…</p>}
      {clients?.map((c) => (
        <section key={c.slug}>
          <h2><a href={c.href}>{c.name}</a></h2>
          <ul>
            {c.campaigns.map((camp) => (
              <li key={camp.href}>
                <a href={camp.href}>{camp.name}</a>
                <span>{camp.ads} ads{camp.updatedAt ? ` · ${fmt.format(new Date(camp.updatedAt))}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
