/**
 * lib/data/brands.js — katalog značek
 * ---------------------------------------------------------------------------
 * Statická data přímo v JS modulu. Na tuhle velikost katalogu (řádově
 * stovky značek) je to naprosto v pořádku výkonově — celé se to jednou
 * zabalí do JS bundlu, žádný databázový roundtrip na vykreslení filtrů.
 *
 * Až budete chtít fulltextové/fuzzy hledání NAPŘÍČ produkty (ne jen filtr
 * na značku v dropdownu), tohle přestane stačit — na to je určený
 * Meilisearch/Algolia/Typesense (viz doporučení na konci odpovědi).
 */

export const BRAND_GROUPS = [
  {
    id: 'footwear',
    label: 'Obuv a Tenisky',
    brands: [
      'Nike', 'Jordan', 'adidas', 'New Balance', 'ASICS', 'Puma', 'Reebok',
      'Under Armour', 'Converse', 'Vans', 'Yeezy', 'Salomon', 'Hoka',
      'On Running', 'Mizuno', 'Saucony', 'Onitsuka Tiger', 'Li-Ning',
      'Maison Mihara Yasuhiro', 'Rick Owens', 'Balenciaga', 'Lanvin',
      'Alexander McQueen', 'Crocs',
    ],
  },
  {
    id: 'apparel',
    label: 'Oblečení',
    brands: [
      'Supreme', 'Palace', 'Stüssy', 'Carhartt WIP', 'BAPE', 'Trapstar',
      'Corteiz', 'Cactus Plant Flea Market (CPFM)', 'Broken Planet',
      'Hellstar', 'Fear of God (Essentials)', 'Palm Angels', 'Ralph Lauren',
      'Heron Preston', "A-COLD-WALL*", 'Kith', 'Denim Tears', 'Amiri',
      'Off-White', "Arc'teryx", 'The North Face', 'Patagonia', 'Columbia',
    ],
  },
  {
    id: 'luxury',
    label: 'Luxusní domy',
    brands: [
      'Louis Vuitton', 'Gucci', 'Prada', 'Balenciaga', 'Dior', 'Chanel',
      'Hermès', 'Burberry', 'Bottega Veneta', 'Saint Laurent', 'Valentino',
      'Givenchy', 'Celine', 'Rick Owens', 'Chrome Hearts', 'Fendi', 'Versace',
    ],
  },
  {
    id: 'accessories-collectibles',
    label: 'Doplňky a Art hračky',
    brands: [
      'Casio G-Shock', 'Swatch', 'Oakley', 'Goyard', 'Telfar', 'Marc Jacobs',
      'Stanley', 'Sprayground', 'Kaws', 'Bearbrick (Medicom Toy)', 'Pop Mart',
      'LEGO', 'Pokémon TCG', 'Magic: The Gathering', 'Hot Toys',
    ],
  },
];

// Ploché pole + Map pro O(1) lookup, když potřebuješ jen "existuje tahle
// značka?" nebo "do jaké skupiny patří?", bez procházení všech skupin.
export const ALL_BRANDS = BRAND_GROUPS.flatMap((g) =>
  g.brands.map((name) => ({ name, groupId: g.id, groupLabel: g.label }))
);

export const BRAND_INDEX = new Map(ALL_BRANDS.map((b) => [b.name, b]));

export function getBrandGroup(brandName) {
  return BRAND_INDEX.get(brandName)?.groupLabel ?? null;
}
