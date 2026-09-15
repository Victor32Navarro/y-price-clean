/**
 * app/api/search/route.js — živý vyhledávací endpoint (Next.js App Router)
 * ---------------------------------------------------------------------------
 * Cache-aside: nejdřív se zkusí Redis (naplněný denním cronem pro populární
 * dotazy), a jen když tam nic není, spustí se živé Firecrawl→Gemini hledání
 * a výsledek se rovnou uloží do cache pro příště.
 *
 * Díky tomu funguje VŽDY (i pro dotaz, který cron nikdy nepředpočítal),
 * ale běžné/populární dotazy odpoví prakticky okamžitě z cache.
 */

import { runProductSearch } from '@/lib/search';
import { buildCacheKey, getCachedOffers, setCachedOffers } from '@/lib/cache';
import { checkRateLimit } from '@/lib/rateLimit';

// S Fluid Compute (zapnuté v Project Settings → Functions) jde tenhle
// limit zvednout nad původních 60 s bez něj. 120 s dává dost prostoru
// i pro pomalejší kombinaci Firecrawl + Gemini, aniž bychom mrhali časem
// navíc, co appka stejně nikdy nevyužije.
export const maxDuration = 120;

async function handlePost(request) {
  // Ochrana proti zahlcení/botům — musí být úplně první věc, dřív než
  // cokoli jiného, ať se neplatí ani za práci navíc s odmítnutým požadavkem.
  const rate = await checkRateLimit(request);
  if (!rate.success) {
    return Response.json(
      { error: 'Příliš mnoho požadavků z tvé sítě. Zkus to prosím za chvíli znovu.' },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return Response.json({ error: 'Tělo požadavku není platný JSON.' }, { status: 400 });
  }

  const query = (body.query || body.q || '').toString().trim();
  if (!query) {
    return Response.json({ error: 'Chybí "query" v těle požadavku.' }, { status: 400 });
  }

  const filters = (body.filters && typeof body.filters === 'object') ? body.filters : {};
  const cacheKey = buildCacheKey(query, filters);

  const cached = await getCachedOffers(cacheKey);
  if (cached) {
    return Response.json({ offers: cached, source: 'cache' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!geminiKey || !firecrawlKey) {
    return Response.json(
      { error: 'Server není nakonfigurovaný — chybí GEMINI_API_KEY a/nebo FIRECRAWL_API_KEY.' },
      { status: 500 }
    );
  }

  try {
    const offers = await runProductSearch(query, filters, { geminiKey, firecrawlKey });
    // Neblokujeme odpověď na zápis do cache, ale ani ji nepouštíme do ztracena.
    setCachedOffers(cacheKey, offers).catch(() => {});
    return Response.json({ offers, source: 'live' });
  } catch (err) {
    return Response.json(
      { error: 'Chyba při vyhledávání.', detail: String(err && err.message || err) },
      { status: 502 }
    );
  }
}

// Vnější bezpečnostní síť — garantuje validní JSON, i kdyby nastala
// úplně neočekávaná chyba, kterou handlePost výše neošetřuje. Přesně
// tohle dřív chybělo starému api/search.js a řešili jsme to tam stejně.
export async function POST(request) {
  try {
    return await handlePost(request);
  } catch (err) {
    return Response.json(
      { error: 'Neočekávaná chyba serveru.', detail: String(err && err.message || err) },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}


