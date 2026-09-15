/**
 * lib/data/categories.js — katalog kategorií
 */

export const CATEGORY_GROUPS = [
  {
    id: 'footwear',
    label: 'Obuv',
    items: [{ id: 'sneakers', label: 'Tenisky', sizeGuide: 'shoes' }],
  },
  {
    id: 'apparel',
    label: 'Oblečení',
    items: [
      { id: 'hoodie', label: 'Mikiny (Hoodies)', sizeGuide: 'apparel' },
      { id: 'tshirt', label: 'Trička (T-Shirts)', sizeGuide: 'apparel' },
      { id: 'jacket', label: 'Bundy & Kabáty', sizeGuide: 'apparel' },
      { id: 'pants', label: 'Kalhoty & Tepláky', sizeGuide: 'apparel' },
      { id: 'shorts', label: 'Kraťasy', sizeGuide: 'apparel' },
      { id: 'jersey', label: 'Dresy', sizeGuide: 'apparel' },
      { id: 'fleece', label: 'Fleecovky / Mikiny na zip', sizeGuide: 'apparel' },
    ],
  },
  {
    id: 'accessories',
    label: 'Doplňky',
    items: [
      { id: 'cap', label: 'Kšiltovky', sizeGuide: null },
      { id: 'bucket', label: 'Klobouky (Bucket Hats)', sizeGuide: null },
      { id: 'beanie', label: 'Kulichy (Beanies)', sizeGuide: null },
      { id: 'belt', label: 'Pásky', sizeGuide: null },
      { id: 'jewelry', label: 'Šperky', sizeGuide: null },
      { id: 'sunglasses', label: 'Sluneční brýle', sizeGuide: null },
      { id: 'crossbody', label: 'Tašky & Crossbody', sizeGuide: null },
      { id: 'backpack', label: 'Batohy', sizeGuide: null },
      { id: 'wallet', label: 'Peněženky', sizeGuide: null },
      { id: 'socks', label: 'Ponožky', sizeGuide: 'apparel' },
      { id: 'scarf', label: 'Šály & Šátky', sizeGuide: null },
      { id: 'watch', label: 'Hodinky', sizeGuide: null },
    ],
  },
  {
    id: 'collectibles',
    label: 'Art hračky a sběratelství',
    items: [
      { id: 'art-toys', label: 'Art hračky (Kaws, Bearbrick, Pop Mart...)', sizeGuide: null },
      { id: 'building-sets', label: 'Stavebnice (LEGO)', sizeGuide: null },
      { id: 'tcg', label: 'Sběratelské karty (Pokémon, MTG)', sizeGuide: null },
      { id: 'figures', label: 'Sběratelské figurky (Hot Toys)', sizeGuide: null },
    ],
  },
];

export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.items);
export const CATEGORY_INDEX = new Map(ALL_CATEGORIES.map((c) => [c.id, c]));

export const COLORS = [
  { id: 'black', label: 'Černá', hex: '#1a1a1a' },
  { id: 'white', label: 'Bílá', hex: '#f5f5f5' },
  { id: 'gray', label: 'Šedá', hex: '#9ca3af' },
  { id: 'beige', label: 'Béžová', hex: '#d8c3a5' },
  { id: 'brown', label: 'Hnědá', hex: '#6b4423' },
  { id: 'red', label: 'Červená', hex: '#dc2626' },
  { id: 'blue', label: 'Modrá', hex: '#2563eb' },
  { id: 'green', label: 'Zelená', hex: '#16a34a' },
  { id: 'pink', label: 'Růžová', hex: '#f472b6' },
  { id: 'purple', label: 'Fialová', hex: '#7c3aed' },
  { id: 'yellow', label: 'Žlutá', hex: '#eab308' },
  { id: 'orange', label: 'Oranžová', hex: '#f97316' },
  { id: 'multi', label: 'Multikolor', hex: null },
];
