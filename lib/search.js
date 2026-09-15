/**
 * lib/search.js — sdílená vyhledávací logika (Firecrawl → Gemini)
 * ---------------------------------------------------------------------------
 * Stejná dvoufázová logika jako v původním api/search.js, jen vytažená do
 * samostatného modulu, aby ji mohl volat jak živý endpoint
 * (app/api/search/route.js), tak denní cron job (app/api/cron/route.js).
 *
 * Nic tady neřeší HTTP request/response ani cache — jen: dotaz + filtry
 * dovnitř, sanitizovaná pole nabídek ven (max. MAX_RESULTS položek).
 */

const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v2/search';
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SEARCH_RESULT_LIMIT = 8; // kolik stránek necháme scrapnout Firecrawlem
export const MAX_RESULTS = 4;  // pevný limit výsledků pro jedno hledání

// ---------------------------------------------------------------------------
// ČERNÁ LISTINA — bazary a P2P inzerce
// ---------------------------------------------------------------------------

const BANNED_KEYWORDS = [
  'vinted', 'bazoš', 'bazos', 'sbazar', 'aukro', 'hyperinzerce',
  'annonce', 'bazarek', 'modrykonik',
  'depop', 'ebay', 'craigslist', 'olx', 'kleinanzeigen',
  'grailed', 'vestiairecollective',
  'facebook.com/marketplace', 'marketplace.facebook',
];

const EXCLUDED_DOMAINS = [
  'vinted.cz', 'vinted.com', 'bazos.cz', 'sbazar.cz', 'aukro.cz',
  'hyperinzerce.cz', 'bazarek.cz', 'modrykonik.cz',
  'depop.com', 'ebay.com', 'craigslist.org', 'olx.cz', 'olx.sk',
  'kleinanzeigen.de', 'grailed.com', 'vestiairecollective.com',
  'facebook.com',
];

function containsBanned(value) {
  const text = (value || '').toString().toLowerCase();
  return BANNED_KEYWORDS.some((k) => text.includes(k));
}

// ---------------------------------------------------------------------------
// KROK 1: FIRECRAWL SEARCH
// ---------------------------------------------------------------------------

async function firecrawlSearch(query, apiKey) {
  const res = await fetch(FIRECRAWL_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: `${query} skladem koupit`,
      limit: SEARCH_RESULT_LIMIT,
      sources: ['web'],
      excludeDomains: EXCLUDED_DOMAINS,
      scrapeOptions: { formats: ['markdown'] },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Firecrawl API vrátilo chybu (${res.status}). ${detail.slice(0, 150)}`);
  }

  const data = await res.json();
  const results = (data && data.data && data.data.web)
    || (data && data.data)
    || data.web
    || [];

  if (!Array.isArray(results)) return [];

  return results.filter((item) => {
    const combined = `${item.url || ''} ${item.title || ''}`;
    return !containsBanned(combined);
  });
}

function buildScrapedContext(results) {
  return results
    .map((item, i) => {
      const title = item.title || '(bez názvu)';
      const url = item.url || '';
      const content = (item.markdown || item.description || '').slice(0, 4000);
      return `--- ZDROJ ${i + 1} ---\nNÁZEV STRÁNKY: ${title}\nURL: ${url}\nOBSAH:\n${content}`;
    })
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// KROK 2: GEMINI — EXTRAKCE NABÍDEK Z DODANÉHO KONTEXTU
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return `
Jsi extrakční modul cenového srovnávače Y-Price pro tenisky, streetwear,
luxusní zboží a sběratelské předměty (art hračky, TCG karty apod.).

DŮLEŽITÉ: Níže v uživatelské zprávě dostaneš už nascrapovaný obsah
konkrétních webových stránek. Nemáš vlastní přístup k internetu — pracuj
VÝHRADNĚ s dodaným obsahem. Nic mimo něj si nevymýšlej.

ABSOLUTNÍ ZÁKAZ BAZARŮ A P2P INZERCE
I kdyby se v dodaném obsahu objevil zdroj podobný Vinted, Bazoš, Sbazar,
Aukro, Hyperinzerce, Facebook Marketplace, OLX, Kleinanzeigen, Craigslist,
Depop, Grailed nebo Vestiaire Collective, tento zdroj úplně ignoruj.

ÚKOL
Z dodaných zdrojů vyber jen oficiální e-shopy a autorizované prodejce
odpovídající dotazu a filtrům. Pro každý urči cenu v CZK (celé číslo,
případně přibližně přepočtenou), zda je skladem (jinak zdroj vynech), a
přímou URL, kterou jsi dostal.

FORMÁT ODPOVĚDI — VÝHRADNĚ validní JSON pole, bez Markdownu, bez textu okolo:
[
  { "store": "...", "title": "...", "price": 4200, "url": "https://...",
    "availability": "Skladem" }
]
Seřaď od nejnižší ceny. Pokud nic nevyhovuje, vrať prázdné pole: []
  `.trim();
}

function buildUserPrompt(query, filters, scrapedContext) {
  const lines = [`Dotaz uživatele: "${query}"`];
  if (filters.brand) lines.push(`Preferovaná značka: ${filters.brand}`);
  if (filters.category) lines.push(`Preferovaná kategorie: ${filters.category}`);
  if (filters.colors && filters.colors.length) {
    lines.push(`Preferovaná barva/barvy: ${filters.colors.join(', ')}`);
  }
  if (filters.size) lines.push(`Preferovaná velikost: ${filters.size}`);
  if (filters.priceMin != null) lines.push(`Minimální cena: ${filters.priceMin} Kč`);
  if (filters.priceMax != null) lines.push(`Maximální cena: ${filters.priceMax} Kč`);
  lines.push('', 'DODANÝ OBSAH Z VYHLEDÁVÁNÍ:', scrapedContext);
  return lines.join('\n');
}

async function geminiExtract(systemPrompt, userPrompt, apiKey) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini API vrátilo chybu (${res.status}). ${detail.slice(0, 150)}`);
  }

  const data = await res.json();
  const candidate = (data.candidates || [])[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  const text = parts.map((p) => p.text || '').join('\n').trim();
  if (!text) throw new Error('Gemini nevrátil žádný text.');
  return text;
}

function stripCodeFences(text) {
  let cleaned = text.trim();
  const fenced = cleaned.match(/```[a-z]*\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    cleaned = fenced[1].trim();
  } else {
    cleaned = cleaned.replace(/```[a-z]*/gi, '').trim();
  }
  return cleaned;
}

function extractJsonArraySlice(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

function repairCommonJsonIssues(text) {
  return text
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function parseOffersFromText(text) {
  const sliced = extractJsonArraySlice(stripCodeFences(text));
  try {
    return JSON.parse(sliced);
  } catch (e) {
    return JSON.parse(repairCommonJsonIssues(sliced));
  }
}

// ---------------------------------------------------------------------------
// SANITIZACE + OŘÍZNUTÍ NA MAX_RESULTS
// ---------------------------------------------------------------------------

function sanitizeOffers(rawOffers, filters) {
  if (!Array.isArray(rawOffers)) return [];

  return rawOffers
    .filter((item) => item && typeof item === 'object')
    .filter((item) => typeof item.price === 'number' && item.price > 0)
    .filter((item) => typeof item.url === 'string' && item.url.startsWith('http'))
    .filter((item) => !containsBanned(item.store)
      && !containsBanned(item.url)
      && !containsBanned(item.title))
    .filter((item) => filters.priceMin == null || item.price >= filters.priceMin)
    .filter((item) => filters.priceMax == null || item.price <= filters.priceMax)
    .map((item) => ({
      store: String(item.store || '').trim(),
      title: String(item.title || '').trim(),
      price: Math.round(item.price),
      url: String(item.url).trim(),
      availability: String(item.availability || 'Skladem').trim(),
    }))
    .sort((a, b) => a.price - b.price)
    .slice(0, MAX_RESULTS);
}

// ---------------------------------------------------------------------------
// VEŘEJNÉ API MODULU
// ---------------------------------------------------------------------------

/**
 * Spustí celé dvoufázové vyhledávání a vrátí max. MAX_RESULTS sanitizovaných
 * nabídek. Nečte process.env sama — klíče jí dodá volající (route handler
 * i cron job mají vlastní přístup k env, ale takhle je funkce testovatelná
 * bez závislosti na Next.js/Vercel runtime).
 */
export async function runProductSearch(query, filters, keys) {
  const { geminiKey, firecrawlKey } = keys;
  if (!geminiKey || !firecrawlKey) {
    throw new Error('Chybí GEMINI_API_KEY a/nebo FIRECRAWL_API_KEY.');
  }

  const searchResults = await firecrawlSearch(query, firecrawlKey);
  if (!searchResults.length) return [];

  const scrapedContext = buildScrapedContext(searchResults);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(query, filters, scrapedContext);
  const rawText = await geminiExtract(systemPrompt, userPrompt, geminiKey);
  const parsedOffers = parseOffersFromText(rawText);

  return sanitizeOffers(parsedOffers, filters);
}
