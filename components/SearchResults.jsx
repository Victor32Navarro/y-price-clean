/**
 * components/SearchResults.jsx — vykreslení výsledků hledání
 * ---------------------------------------------------------------------------
 * Dostane hotová data z app/page.js (stav dotazu se řeší tam) a postará se
 * jen o zobrazení: loading skeleton, chybu, prázdný výsledek, nebo karty
 * s nabídkami proložené in-feed reklamní pozicí.
 */
'use client';

import { formatCZK } from '@/lib/formatPrice';
import AdSlot from './AdSlot';

function ResultCard({ offer }) {
  return (
    <div
      className="bg-card border border-line rounded-xl p-5 flex flex-col
                 sm:flex-row sm:items-center gap-4 hover:border-accent/50
                 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-accent-soft uppercase tracking-wide">
            {offer.store}
          </span>
          <span className="text-[10px] text-neutral-500">•</span>
          <span className="text-[11px] text-neutral-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {offer.availability}
          </span>
        </div>
        <p className="text-sm text-neutral-100 truncate">{offer.title}</p>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-4 sm:w-56 shrink-0">
        <span className="font-display font-700 text-xl text-white">
          {formatCZK(offer.price)}
        </span>
        <a
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary !py-2 !px-4 !text-xs whitespace-nowrap"
        >
          Koupit
        </a>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-accent-soft mb-4">
        <span className="spinner" /> Y-Price hledá živě na webu…
      </div>
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-card bg-card border border-line rounded-xl h-28" />
        ))}
      </div>
    </div>
  );
}

export default function SearchResults({ status, offers, error, query, source }) {
  if (status === 'idle') {
    return (
      <p className="text-sm text-neutral-500">
        Napiš, co hledáš, nebo si projdi krokový filtr vlevo, a stiskni „Najít nejlepší cenu".
      </p>
    );
  }

  if (status === 'loading') return <LoadingSkeleton />;

  if (status === 'error') {
    return (
      <div className="border border-accent/40 bg-accent/10 text-accent-soft rounded-xl p-4 text-sm">
        {error}
      </div>
    );
  }

  if (!offers || !offers.length) {
    return (
      <div className="border border-line bg-card rounded-xl p-6 text-sm text-neutral-400">
        Pro dotaz „{query}" se nepodařilo najít žádnou aktuálně skladem dostupnou
        nabídku na ověřeném e-shopu. Zkus upravit dotaz nebo filtry.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm text-neutral-400">
          Výsledky pro <span className="text-white">„{query}"</span>{' '}
          <span className="text-neutral-600">
            · {offers.length} nabídek {source === 'cache' ? '· z cache ⚡' : ''}
          </span>
        </h2>
        <span className="text-[11px] text-neutral-600">cena ↑</span>
      </div>

      <div className="grid gap-3">
        {offers.map((offer, i) => (
          <div key={`${offer.store}-${i}`}>
            <ResultCard offer={offer} />
            {(i + 1) % 3 === 0 && i !== offers.length - 1 && (
              <div className="mt-3">
                <AdSlot format="in-feed" />
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-5 text-[11px] text-neutral-600 leading-relaxed max-w-xl">
        Ceny a dostupnost ověřuje AI živým vyhledáváním v okamžiku dotazu — před
        nákupem to prosím ještě zkontroluj přímo na stránce obchodu.
      </p>
    </div>
  );
}
