/**
 * lib/data/size-guides.js — tabulky velikostí (boty + oblečení)
 * ---------------------------------------------------------------------------
 * `category.sizeGuide` v lib/data/categories.js ("shoes" | "apparel" | null)
 * říká, kterou z těchto tabulek pro danou kategorii zobrazit.
 */

export const SHOE_SIZE_GUIDE = {
  id: 'shoes',
  title: 'Tabulka velikostí — obuv (pánské, unisex)',
  unit: 'cm',
  columns: ['US', 'EU', 'UK', 'CM'],
  rows: [
    ['7', '40', '6', '25'],
    ['7.5', '40.5', '6.5', '25.5'],
    ['8', '41', '7', '26'],
    ['8.5', '42', '7.5', '26.5'],
    ['9', '42.5', '8', '27'],
    ['9.5', '43', '8.5', '27.5'],
    ['10', '44', '9', '28'],
    ['10.5', '44.5', '9.5', '28.5'],
    ['11', '45', '10', '29'],
    ['11.5', '45.5', '10.5', '29.5'],
    ['12', '46', '11', '30'],
    ['13', '47.5', '12', '31'],
  ],
  note: 'Dámské velikosti US bývají o cca 1,5 vyšší než pánské při stejné EU velikosti — u konkrétního modelu se řiď tabulkou daného obchodu, pokud ji uvádí.',
};

export const APPAREL_SIZE_GUIDE = {
  id: 'apparel',
  title: 'Tabulka velikostí — oblečení (unisex střih streetwear)',
  unit: 'cm',
  columns: ['Velikost', 'EU', 'Hrudník (cm)', 'Pas (cm)'],
  rows: [
    ['XS', '44', '86–91', '71–76'],
    ['S', '46', '91–97', '76–81'],
    ['M', '48', '97–102', '81–87'],
    ['L', '50', '102–109', '87–94'],
    ['XL', '52', '109–117', '94–102'],
    ['XXL', '54', '117–124', '102–109'],
  ],
  note: 'Oversize střih (Supreme, BAPE, Stüssy apod.) často sedí o velikost větší, než je běžný konfekční standard — u boxy/oversize kusů zvaž o velikost menší.',
};

export const SIZE_GUIDES = {
  shoes: SHOE_SIZE_GUIDE,
  apparel: APPAREL_SIZE_GUIDE,
};

export function getSizeGuideFor(categoryId, categoryIndex) {
  const category = categoryIndex.get(categoryId);
  if (!category || !category.sizeGuide) return null;
  return SIZE_GUIDES[category.sizeGuide] || null;
}
