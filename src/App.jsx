import { useEffect, useMemo, useState } from 'react';
import AdCard from './components/AdCard';
import SummaryBar from './components/SummaryBar';
import { loadAds, client } from './lib/ads';
import {
  getAllDecisions,
  setDecision,
  clearDecisions,
  syncWithRemote,
  onSyncStatus,
  EMPTY_DECISION,
} from './lib/storage';
import { buildCsv, downloadCsv } from './lib/csv';
import './App.css';

export default function App() {
  const [ads, setAds] = useState([]);
  const [clientName, setClientName] = useState('');
  const [decisions, setDecisions] = useState({});
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [syncStatus, setSyncStatus] = useState('local');

  useEffect(() => onSyncStatus(setSyncStatus), []);

  useEffect(() => {
    let cancelled = false;
    loadAds()
      .then(({ ads: list, clientName: name }) => {
        if (cancelled) return;
        setAds(list);
        setClientName(name);
        setDecisions(getAllDecisions());
        setStatus('ready');
        // Show local decisions right away, then merge in what the sheet has.
        return syncWithRemote(list).then((merged) => {
          if (!cancelled) setDecisions(merged);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetStatus = (adId, next) => {
    const updated = setDecision(adId, { status: next });
    setDecisions((prev) => ({ ...prev, [adId]: updated }));
  };

  const handleSetComment = (adId, comment) => {
    const updated = setDecision(adId, { comment });
    setDecisions((prev) => ({ ...prev, [adId]: updated }));
  };

  const handleReset = () => {
    if (!window.confirm('Alle beslissingen en opmerkingen wissen?')) return;
    setDecisions(clearDecisions());
  };

  const handleExport = () => {
    downloadCsv(`meta-ad-goedkeuring-${client.slug}.csv`, buildCsv(ads, decisions));
  };

  const counts = useMemo(() => {
    const c = { total: ads.length, approved: 0, rejected: 0, pending: 0 };
    for (const ad of ads) {
      const s = decisions[ad.id]?.status || 'pending';
      c[s] += 1;
    }
    return c;
  }, [ads, decisions]);

  const visibleAds = useMemo(() => {
    if (filter === 'all') return ads;
    return ads.filter((ad) => (decisions[ad.id]?.status || 'pending') === filter);
  }, [ads, decisions, filter]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Meta Ad Showcase{clientName ? ` — ${clientName}` : ''}</h1>
        <p className="app-subtitle">Beoordeel en keur de advertenties goed of af.</p>
      </header>

      {status === 'loading' && <p className="state-msg">Advertenties laden…</p>}

      {status === 'error' && (
        <div className="state-msg state-error">
          <p>Kon de advertenties niet laden: {error}</p>
          <p className="state-hint">
            Zorg dat <code>public/ads/{client.slug}/ads.json</code> bestaat en naar bestaande PNG&apos;s verwijst.
          </p>
        </div>
      )}

      {status === 'ready' && ads.length === 0 && (
        <p className="state-msg">Nog geen advertenties. Voeg PNG&apos;s toe in <code>public/ads/{client.slug}/</code>.</p>
      )}

      {status === 'ready' && ads.length > 0 && (
        <>
          <SummaryBar
            counts={counts}
            filter={filter}
            onFilter={setFilter}
            syncStatus={syncStatus}
            onExport={handleExport}
            onReset={handleReset}
          />
          <main className="ad-grid">
            {visibleAds.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                decision={decisions[ad.id] || EMPTY_DECISION}
                onSetStatus={handleSetStatus}
                onSetComment={handleSetComment}
              />
            ))}
          </main>
          {visibleAds.length === 0 && (
            <p className="state-msg">Geen advertenties in dit filter.</p>
          )}
        </>
      )}
    </div>
  );
}
