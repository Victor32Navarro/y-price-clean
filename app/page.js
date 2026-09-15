/**
 * app/page.js — hlavní stránka Y-Price
 * ---------------------------------------------------------------------------
 * Drží stav hledání (query/filters výsledek) a volá POST /api/search.
 * Samotné UI kusy (filtry, výsledky, reklamní pozice) žijí v components/.
 */
'use client';

import { useState } from 'react';
import AdSlot from '@/components/AdSlot';
import FilterPanel from '@/components/FilterPanel';
import SearchResults from '@/components/SearchResults';

export default function HomePage() {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [source, setSource] = useState(null);

  async function handleSearch(query, filters) {
    setStatus('loading');
    setLastQuery(query);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, filters }),
      });

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error('Server vrátil neočekávanou odpověď. Zkus to prosím znovu.');
      }

      if (!res.ok) {
        throw new Error(data?.error || `Server vrátil chybu (${res.status}).`);
      }

      setOffers(Array.isArray(data.offers) ? data.offers : []);
      setSource(data.source || null);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Nastala neočekávaná chyba.');
      setStatus('error');
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-24">
      {/* Header */}
      <header className="flex items-center justify-between py-6 border-b border-line">
        <div className="flex items-baseline gap-1">
          <span className="font-display font-700 text-2xl tracking-tight">Y</span>
          <span className="font-display font-700 text-2xl tracking-tight text-accent">
            -Price
          </span>
        </div>
      </header>

      {/* Leaderboard reklama */}
      <div className="pt-6">
        <AdSlot format="leaderboard" />
      </div>

      {/* Hero */}
      <section className="pt-10 pb-6">
        <h1 className="font-display font-700 text-3xl sm:text-4xl leading-tight max-w-2xl">
          Najdi nejlevnější <span className="text-accent">ověřenou</span> cenu.
        </h1>
        <p className="text-sm text-neutral-400 mt-3 max-w-xl">
          Y-Price prohledá živě internet a najde skladem dostupné nabídky napříč
          oficiálními e-shopy a autorizovanými platformami — žádné bazary.
        </p>
      </section>

      {/* Hlavní obsah: filtry + výsledky vlevo, sidebar reklama vpravo na desktopu */}
      <section className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <div className="space-y-8">
          <FilterPanel onSubmit={handleSearch} loading={status === 'loading'} />
          <SearchResults
            status={status}
            offers={offers}
            error={error}
            query={lastQuery}
            source={source}
          />
        </div>

        <aside className="lg:sticky lg:top-8">
          <AdSlot format="sidebar" />
        </aside>
      </section>
    </div>
  );
}
