# Y-Price — nasazení

Prémiový cenový srovnávač pro tenisky, streetwear a doplňky. Dva soubory,
které do sebe zapadají:

- **`index.html`** — celý frontend v jednom souboru (Tailwind, dark mode,
  filtry na značku/kategorii/barvu/cenu). Neobsahuje žádný API klíč ani
  žádnou logiku volání AI — jen pošle dotaz na `/api/search` a vykreslí
  odpověď.
- **`api/search.js`** — serverless funkce pro Vercel. Běží pod dvěma
  centrálními klíči nastavenými jako proměnné prostředí, uživatel webu
  žádný klíč nezadává.

## Jak vyhledávání funguje (dva kroky)

1. **Firecrawl Search** — dotaz (rozšířený o zvolené filtry) se pošle na
   Firecrawl, který prohledá web a vrátí markdown obsah stránek nalezených
   e-shopů. Bazary jsou vyloučené už tady přes `excludeDomains`.
2. **Gemini extrakce** — nascrapovaný obsah dostane Gemini jako kontext
   (bez vlastního `google_search` nástroje — nesmí sám chodit na web) a
   z něj vybere skutečné nabídky, ceny převede na CZK a vrátí přísný JSON.

Nakonec ještě běží lokální filtr `BANNED_KEYWORDS`, který z výsledků
odstraní cokoli, co odpovídá bazaru nebo P2P inzerci — i kdyby se to
dostalo přes první dvě vrstvy.

## Nasazení na Vercel

1. Struktura repozitáře:
   ```
   /api/search.js
   /package.json
   /index.html
   ```
2. Získej dva API klíče:
   - Google Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Firecrawl: [firecrawl.dev/app/api-keys](https://www.firecrawl.dev/app/api-keys)
3. V nastavení projektu na vercel.com přidej **Environment Variables**:
   - `GEMINI_API_KEY`
   - `FIRECRAWL_API_KEY`
4. Nasaď: `vercel deploy` (nebo push do propojené větve).
5. Appka i endpoint běží na stejné doméně, frontend volá relativní
   `/api/search` — žádná další konfigurace není potřeba.

## Černá listina bazarů a P2P inzerce

Vynucená na třech místech zároveň:
- `excludeDomains` v požadavku na Firecrawl (vyloučení už při hledání),
- systémový prompt pro Gemini (explicitní zákaz),
- finální `sanitizeOffers()` filtr nad výstupem (i na frontendu jako
  poslední pojistka).

Aktuální seznam: Vinted, Bazoš, Sbazar, Aukro, Hyperinzerce, Bazarek,
Modrý koník, Depop, eBay, Craigslist, OLX, Kleinanzeigen, Grailed,
Vestiaire Collective, Facebook Marketplace.

## Náklady a limity

- Firecrawl Search účtuje kredity za dotaz (víc za scrapnutý markdown
  obsah než za holé odkazy) — sleduj spotřebu v Firecrawl dashboardu.
- Gemini v kroku 2 už nepoužívá grounding (žádný `google_search`), takže
  se účtují jen běžné tokeny za vstup/výstup.
- Přesnost záleží na tom, co Firecrawl v danou chvíli najde a nascrapuje —
  pokud se pro dotaz nenajde nic use­ful, appka vrátí prázdný výsledek
  místo vymyšlené nabídky.
