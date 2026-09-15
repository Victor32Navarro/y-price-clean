/**
 * Y-Price — POST /api/search  (dvoufázový backend: Firecrawl → Gemini)
 * ---------------------------------------------------------------------------
 * Serverless funkce pro Vercel (Node.js runtime, žádné npm závislosti).
 * Frontend odsud nezná žádný API klíč — vše běží pod centrálními klíči
 * uloženými jako proměnné prostředí na Vercelu.
 *
 * JAK TO FUNGUJE (dva kroky):
 *   1) FIRECRAWL SEARCH — dotaz pošleme na Firecrawl Search API, které
 *      prohledá web a vrátí čistý markdown obsah stránek nalezených e-shopů.
 *      Bazary jsou vyloučené už tady přes `excludeDomains`.
 *   2) GEMINI EXTRAKCE — nascrapovaný obsah předáme Gemini jako kontext
 *      (BEZ jeho vlastního google_search nástroje — Gemini už nesmí sám
 *      chodit na web, smí pracovat jen s tím, co dodal Firecrawl). Gemini
 *      z tohoto kontextu vybere reálné nabídky, aplikuje filtry a vrátí
 *      striktní JSON pole.
 *
 * Nakonec ještě běží lokální bezpečnostní filtr (BANNED_KEYWORDS), který
 * z výstupu odstraní cokoli, co by přesto na bazar nebo P2P inzerci
 * ukazovalo.
 *
 * ODOLNOST VŮČI "The string did not match the expected pattern" (Safari):
 * Tahle chyba v prohlížeči vzniká, když frontend zavolá `res.json()` na
 * odpověď, která NENÍ platný JSON (např. HTML/textová crash stránka
 * z platformy po nezachycené výjimce). Proto tenhle soubor:
 *   - nikde nepoužívá pomocné metody typu `res.status().json()` (ty
 *     existují jen díky Vercel wrapperu — pokud by z libovolného důvodu
 *     chyběly, volání by spadlo ještě dřív, než by se cokoli odeslalo),
 *     ale vždy jen syrové Node.js API: `res.statusCode`, `res.setHeader`,
 *     `res.end()`. Tohle funguje vždy, bez ohledu na runtime,
 *   - každou jednu odpověď posílá přes jediný `sendJson()` helper, který
 *     natvrdo nastaví `Content-Type: application/json` a tělo vždy
 *     vytvoří přes `JSON.stringify()` — nikdy neposílá syrový text/HTML,
 *   - celou logiku obaluje vnějším try/catch, který i při úplně
 *     neočekávané chybě garantuje validní JSON odpověď.
 *
 * VSTUP (POST, JSON tělo):
 *   {
 *     "query": "Jordan 4 Military Blue 43",
 *     "filters": {
 *       "brand": "Jordan", "category": "Tenisky",
 *       "colors": ["Modrá"], "priceMin": 3000, "priceMax": 8000
 *     }
 *   }
 *
 * VÝSTUP:
 *   200 { "offers": [ { store, title, price, url, availability }, ... ] }
 *
 * NASTAVENÍ NA VERCELU (Environment Variables):
 *   GEMINI_API_KEY    = klíč z https://aistudio.google.com/apikey
 *   FIRECRAWL_API_KEY = klíč z https://www.firecrawl.dev/app/api-keys
 */

const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v2/search';
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Kolik výsledků si necháme scrapnout markdownem z Firecrawlu na jeden dotaz.
const SEARCH_RESULT_LIMIT = 8;

// ---------------------------------------------------------------------------
// ODESÍLÁNÍ ODPOVĚDI — jediné místo, které smí psát do `res`
// ---------------------------------------------------------------------------
// Používá výhradně holé Node.js API, žádné frameworkové pomůcky. Díky tomu
// nemůže selhat kvůli chybějící metodě a vždy pošle validní JSON tělo se
// správnou hlavičkou Content-Type.

function sendJson(res, statusCode, payload) {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  let body;
  try {
    body = JSON.stringify(payload);
  } catch (err) {
    // Payload se z nějakého důvodu nedá serializovat (nemělo by nastat,
    // ale kdyby ano, pošleme aspoň minimální validní JSON, ne pád).
    res.statusCode = 500;
    body = JSON.stringify({ error: 'Odpověď serveru se nepodařilo sestavit jako JSON.' });
  }
  res.end(body);
}

function sendNoContent(res, statusCode) {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.end();
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ---------------------------------------------------------------------------
// ČERNÁ LISTINA — bazary a P2P inzerce
// ---------------------------------------------------------------------------

// Použito jako textový filtr (substring match) nad názvem obchodu, URL,
// titulkem i scrapnutým obsahem — funguje na cokoli, i necelé domény.
const BANNED_KEYWORDS = [
  // CZ / SK bazary a inzertní portály
  'vinted', 'bazoš', 'bazos', 'sbazar', 'aukro', 'hyperinzerce',
  'annonce', 'bazarek', 'modrykonik',
  // Globální a evropské bazary / P2P
  'depop', 'ebay', 'craigslist', 'olx', 'kleinanzeigen',
  'grailed', 'vestiairecollective',
  // Sociální sítě / marketplace
  'facebook.com/marketplace', 'marketplace.facebook',
];

// Podmnožina výše, která odpovídá reálným doménám — použito v požadavku na
// Firecrawl (excludeDomains), aby se bazary vyloučily už při hledání.
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

  // Druhá vrstva obrany: i kdyby excludeDomains něco propustilo, vyhodíme
  // to tady, než se to vůbec dostane ke Gemini jako kontext.
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
// KROK 2: GEMINI — EXTRAKCE NABÍDEK Z DODANÉHO KONTEXTU (bez vlastního hledání)
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return `
Jsi extrakční modul cenového srovnávače Y-Price pro tenisky, streetwear
a doplňky.

DŮLEŽITÉ: Níže v uživatelské zprávě dostaneš už nascrapovaný obsah
konkrétních webových stránek (výsledek samostatného vyhledávání). Nemáš
vlastní přístup k internetu ani k žádným jiným informacím o cenách —
pracuj VÝHRADNĚ s dodaným obsahem. Nic mimo něj si nevymýšlej ani
nedosazuj z vlastní paměti.

ABSOLUTNÍ ZÁKAZ BAZARŮ A P2P INZERCE
I kdyby se v dodaném obsahu objevil zdroj, který vypadá jako Vinted,
Bazoš, Sbazar, Aukro, Hyperinzerce, Facebook Marketplace, OLX,
Kleinanzeigen, Craigslist, Depop, Grailed, Vestiaire Collective nebo
jakýkoli jiný bazar či P2P inzerce, tento zdroj úplně ignoruj a nic
z něj nepoužívej.

ÚKOL
Z dodaných zdrojů vyber jen ty, které jsou oficiální e-shopy nebo
autorizovaní prodejci (např. Footshop, StockX, GOAT, END. Clothing,
Nike, Supreme, Snipes, BSTN, Zalando apod.) a odpovídají zadanému
dotazu a filtrům. Pro každý takový zdroj urči:
- přesnou cenu v korunách českých (CZK) jako celé číslo (pokud je
  uvedená v jiné měně, proveď přibližný přepočet),
- zda z obsahu vyplývá, že je produkt skladem — pokud text výslovně
  říká "sold out", "vyprodáno", "not available" apod., tento zdroj
  úplně vynech,
- přímou URL adresu, kterou jsi dostal u daného zdroje (nevymýšlej ani
  needituj).

Pokud si u některého zdroje nejsi jistý cenou nebo dostupností, tento
zdroj radši vynech, než abys hádal.

FORMÁT ODPOVĚDI
Odpověz VÝHRADNĚ validním JSON polem, bez Markdownu, bez uvozovacích
bloků a bez jakéhokoli textu navíc, přesně v tomto tvaru:

[
  {
    "store": "Název obchodu",
    "title": "Název produktu, jak ho obchod uvádí",
    "price": 4200,
    "url": "https://presna-adresa-produktu",
    "availability": "Skladem"
  }
]

Výsledné pole seřaď od nejnižší ceny po nejvyšší. Pokud v dodaném
obsahu nic vyhovujícího není, vrať prázdné pole: []
  `.trim();
}

function buildUserPrompt(query, filters, scrapedContext) {
  const lines = [`Dotaz uživatele: "${query}"`];
  if (filters.brand) lines.push(`Preferovaná značka: ${filters.brand}`);
  if (filters.category) lines.push(`Preferovaná kategorie: ${filters.category}`);
  if (filters.colors && filters.colors.length) {
    lines.push(`Preferovaná barva/barvy: ${filters.colors.join(', ')}`);
  }
  if (filters.priceMin != null) lines.push(`Minimální cena: ${filters.priceMin} Kč`);
  if (filters.priceMax != null) lines.push(`Maximální cena: ${filters.priceMax} Kč`);
  lines.push('', 'DODANÝ OBSAH Z VYHLEDÁVÁNÍ:', scrapedContext);
  return lines.join('\n');
}

async function geminiExtract(systemPrompt, userPrompt, apiKey) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      // Žádné tools zde záměrně — Gemini smí pracovat jen s dodaným
      // kontextem z Firecrawlu, ne s vlastním google_search nástrojem.
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

// ---------------------------------------------------------------------------
// ČIŠTĚNÍ A PARSOVÁNÍ ODPOVĚDI Z GEMINI (požadavek č. 1)
// ---------------------------------------------------------------------------

// Vyčistí odpověď od Markdown code fence bloků. Gemini je občas zabalí
// jako ```json ... ```, jindy jen jako ``` ... ``` (bez jazykové nálepky),
// nebo přidá vysvětlující větu před/za blokem — tohle pokrývá všechny
// tři varianty.
function stripCodeFences(text) {
  let cleaned = text.trim();

  const fenced = cleaned.match(/```[a-z]*\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    cleaned = fenced[1].trim();
  } else {
    // Osamocené ``` znaky bez páru (např. jen na začátku) — smaž je.
    cleaned = cleaned.replace(/```[a-z]*/gi, '').trim();
  }

  return cleaned;
}

// Odřízne jakýkoli text před prvním '[' a po posledním ']' — řeší
// případy, kdy model přidá úvodní nebo závěrečnou větu mimo JSON pole.
function extractJsonArraySlice(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

// Opraví pár nejčastějších drobných chyb, které JSON.parse jinak odmítne
// (trailing čárky před ] nebo }, "chytré" uvozovky místo rovných).
function repairCommonJsonIssues(text) {
  return text
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

// Bezpečně vyčistí Markdown/okolní text a naparsuje JSON pole. Zkusí to
// dvakrát — podruhé už s opravou drobných formátovacích chyb — než se
// definitivně vzdá. Nikdy nepadá nezachyceně; chybu řeší volající pomocí
// try/catch a vrátí ji jako čitelnou JSON odpověď, ne syrový výjimkový text.
function parseOffersFromText(text) {
  const withoutFences = stripCodeFences(text);
  const sliced = extractJsonArraySlice(withoutFences);

  try {
    return JSON.parse(sliced);
  } catch (firstError) {
    try {
      return JSON.parse(repairCommonJsonIssues(sliced));
    } catch (secondError) {
      throw secondError;
    }
  }
}

// ---------------------------------------------------------------------------
// FINÁLNÍ SANITIZACE (třetí a poslední vrstva obrany)
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
    .sort((a, b) => a.price - b.price);
}

// ---------------------------------------------------------------------------
// ČTENÍ TĚLA POŽADAVKU
// ---------------------------------------------------------------------------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string') {
      try {
        resolve(req.body ? JSON.parse(req.body) : {});
      } catch (err) {
        reject(err);
      }
      return;
    }

    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// HTTP HANDLER (požadavek č. 2 — vždy jen validní JSON, nikdy syrový text/HTML)
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    sendNoContent(res, 204);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Použij POST požadavek s JSON tělem.' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: 'Tělo požadavku není platný JSON.' });
    return;
  }

  const query = (body.query || body.q || '').toString().trim();
  if (!query) {
    sendJson(res, 400, { error: 'Chybí "query" v těle požadavku.' });
    return;
  }

  const filters = (body.filters && typeof body.filters === 'object') ? body.filters : {};

  const geminiKey = process.env.GEMINI_API_KEY;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!geminiKey || !firecrawlKey) {
    sendJson(res, 500, {
      error: 'Server není nakonfigurovaný — chybí GEMINI_API_KEY a/nebo FIRECRAWL_API_KEY.',
    });
    return;
  }

  // --- Krok 1: Firecrawl ---
  let searchResults;
  try {
    searchResults = await firecrawlSearch(query, firecrawlKey);
  } catch (err) {
    sendJson(res, 502, {
      error: 'Chyba při vyhledávání přes Firecrawl.',
      detail: String(err && err.message || err),
    });
    return;
  }

  if (!searchResults.length) {
    // Nic ověřeného se nenašlo už na úrovni vyhledávání — nemá smysl
    // zatěžovat Gemini prázdným kontextem, rovnou vrátíme prázdný výsledek.
    sendJson(res, 200, { offers: [] });
    return;
  }

  // --- Krok 2: Gemini extrakce z dodaného kontextu ---
  let offers = [];
  try {
    const scrapedContext = buildScrapedContext(searchResults);
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(query, filters, scrapedContext);
    const rawText = await geminiExtract(systemPrompt, userPrompt, geminiKey);

    let parsedOffers;
    try {
      parsedOffers = parseOffersFromText(rawText);
    } catch (err) {
      // I po dvou pokusech o opravu (viz parseOffersFromText) se JSON
      // nepodařilo naparsovat — vrátíme čitelnou JSON chybu i syrový text
      // pro ladění, místo aby cokoli neošetřené uniklo mimo tenhle blok.
      sendJson(res, 502, {
        error: 'Odpověď AI se nepodařilo rozparsovat jako JSON ani po opravě formátu.',
        raw: rawText,
      });
      return;
    }

    offers = sanitizeOffers(parsedOffers, filters);
  } catch (err) {
    sendJson(res, 502, {
      error: 'Chyba při zpracování odpovědi Gemini.',
      detail: String(err && err.message || err),
    });
    return;
  }

  sendJson(res, 200, { offers });
}

// Vnější bezpečnostní síť: garantuje, že klient VŽDY dostane validní JSON
// se správnou hlavičkou, i kdyby nastala úplně neočekávaná chyba, kterou
// výše neošetřuje žádný try/catch. Právě tohle přímo řeší chybu
// "The string did not match the expected pattern" v mobilním Safari —
// ta vznikala přesně ve chvíli, kdy frontend dostal místo JSONu syrovou
// chybovou stránku a pokusil se ji naparsovat jako JSON.
module.exports = async function handler(req, res) {
  try {
    await handleRequest(req, res);
  } catch (err) {
    sendJson(res, 500, {
      error: 'Neočekávaná chyba serveru.',
      detail: String(err && err.message || err),
    });
  }
};



