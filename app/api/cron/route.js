/**
 * app/api/cron/route.js — denní pre-warm cache (Vercel Cron Job)
 * ---------------------------------------------------------------------------
 * Vercel tenhle endpoint zavolá podle vercel.json přes GET požadavek
 * s hlavičkou `Authorization: Bearer ${CRON_SECRET}`. Endpoint projde
 * kurátorovaný seznam "top" dotazů (SEED_QUERIES níže) a pro každý spustí
 * živé vyhledávání, jehož výsledek uloží do Redis cache — živý endpoint
 * (app/api/search/route.js) pak tyhle dotazy odpoví okamžitě.
 *
 * BEZ RUČNÍHO PŘEHAZOVÁNÍ NA LETNÍ/ZIMNÍ ČAS:
 * Vercel cron umí jen UTC, bez posunu na DST. Řešení: ve vercel.json je
 * tenhle endpoint naplánovaný na DVA UTC časy (2:00 a 3:00 UTC) — jeden
 * z nich vždy odpovídá 4:00 v Praze, ať je zrovna CET nebo CEST. Funkce
 * si při každém volání ověří přes `isLocalHourMatch()`, jestli je PRÁVĚ
 * TEĎ opravdu 4:00 pražského času, a pokud ne, rovnou se bez zpracování
 * ukončí. Vercel appku zavolá dvakrát denně, prakticky se ale spustí jen
 * jednou — přesně v 4:00 lokálního času, po celý rok, bez zásahu.
 *
 * DŮLEŽITÉ OMEZENÍ, KTERÉ MUSÍŠ ŘÍDIT SÁM: funkce má časový limit
 * (`maxDuration` níže, max. dle tvého Vercel plánu — Hobby ~60 s, Pro až
 * několik minut). Každé vyhledání (Firecrawl + Gemini) trvá řádově
 * 3–8 sekund, takže SEED_QUERIES drž na počtu, který se vejde do limitu
 * (např. 30–50 položek na Pro plánu). Pro OPRAVDU velký katalog dotazů
 * je lepší tenhle cron rozdělit na víc menších (viz doporučení na konci
 * naší odpovědi — Upstash QStash pro fan-out).
 */

import { runProductSearch } from '@/lib/search';
import { buildCacheKey, setCachedOffers } from '@/lib/cache';

export const maxDuration = 300; // vyžaduje Fluid Compute / Pro plán a vyšší

const TIMEZONE = 'Europe/Prague';
const TARGET_LOCAL_HOUR = 4; // kdy se má cron reálně spouštět, lokálního času

/** Vrátí true, pokud je v `timeZone` právě teď (v rámci té hodiny) `targetHour`. */
function isLocalHourMatch(timeZone, targetHour) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === 'hour');
  const localHour = hourPart ? parseInt(hourPart.value, 10) % 24 : null;
  return localHour === targetHour;
}

// Kurátorovaný seznam nejžádanějších kombinací — ne celý katalog (stovky
// značek × desítky kategorií by se do jednoho běhu nevešly). Postupně si
// tenhle seznam uprav podle toho, co lidé v appce nejvíc hledají.
const SEED_QUERIES = [
  { query: 'Jordan 4 Retro', filters: { brand: 'Jordan', category: 'Tenisky' } },
  { query: 'Nike Dunk Low Panda', filters: { brand: 'Nike', category: 'Tenisky' } },
  { query: 'Yeezy 350 Zebra', filters: { brand: 'Yeezy', category: 'Tenisky' } },
  { query: 'New Balance 550', filters: { brand: 'New Balance', category: 'Tenisky' } },
  { query: 'Supreme Box Logo Hoodie', filters: { brand: 'Supreme', category: 'Mikiny (Hoodies)' } },
  { query: 'Stüssy 8 Ball Hoodie', filters: { brand: 'Stüssy', category: 'Mikiny (Hoodies)' } },
  { query: 'Carhartt WIP Detroit Jacket', filters: { brand: 'Carhartt WIP', category: 'Bundy & Kabáty' } },
  { query: 'BAPE Shark Hoodie', filters: { brand: 'BAPE', category: 'Mikiny (Hoodies)' } },
  { query: 'Balenciaga Track', filters: { brand: 'Balenciaga', category: 'Tenisky' } },
  { query: 'Louis Vuitton belt', filters: { brand: 'Louis Vuitton', category: 'Pásky' } },
  { query: 'Chrome Hearts ring', filters: { brand: 'Chrome Hearts', category: 'Šperky' } },
  { query: 'Goyard tote bag', filters: { brand: 'Goyard', category: 'Tašky & Crossbody' } },
  { query: 'Telfar shopping bag', filters: { brand: 'Telfar', category: 'Tašky & Crossbody' } },
  { query: 'Kaws Companion figure', filters: { category: 'Art hračky' } },
  { query: 'Bearbrick 1000%', filters: { brand: 'Bearbrick (Medicom Toy)', category: 'Art hračky' } },
  { query: 'Pop Mart Labubu', filters: { brand: 'Pop Mart', category: 'Art hračky' } },
  { query: 'Casio G-Shock', filters: { brand: 'Casio G-Shock', category: 'Doplňky' } },
  // ... postupně doplň další podle skutečné poptávky ve vyhledávání appky.
];

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Vercel volá tenhle endpoint dvakrát denně (2:00 a 3:00 UTC — viz
  // vercel.json), aby pokryl obě varianty letního/zimního času. Skutečnou
  // práci ale odvedeme jen v tom volání, které opravdu padne na 4:00
  // pražského času — to druhé je levný no-op.
  if (!isLocalHourMatch(TIMEZONE, TARGET_LOCAL_HOUR)) {
    return Response.json({
      skipped: true,
      reason: `Aktuálně není ${TARGET_LOCAL_HOUR}:00 v ${TIMEZONE} — čeká se na druhé ` +
        'naplánované volání, které DST variantu pokryje.',
      ranAt: new Date().toISOString(),
    });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!geminiKey || !firecrawlKey) {
    return Response.json(
      { error: 'Chybí GEMINI_API_KEY a/nebo FIRECRAWL_API_KEY.' },
      { status: 500 }
    );
  }

  const results = [];

  // Sekvenčně, ne přes Promise.all — šetří to rate limity Firecrawl/Gemini
  // a je to předvídatelnější pro časový limit funkce.
  for (const seed of SEED_QUERIES) {
    try {
      const offers = await runProductSearch(seed.query, seed.filters, {
        geminiKey,
        firecrawlKey,
      });
      const cacheKey = buildCacheKey(seed.query, seed.filters);
      await setCachedOffers(cacheKey, offers);
      results.push({ query: seed.query, status: 'ok', offers: offers.length });
    } catch (err) {
      results.push({
        query: seed.query,
        status: 'error',
        detail: String(err && err.message || err),
      });
    }
  }

  const failed = results.filter((r) => r.status === 'error').length;
  return Response.json({
    ranAt: new Date().toISOString(),
    total: SEED_QUERIES.length,
    failed,
    results,
  });
}
