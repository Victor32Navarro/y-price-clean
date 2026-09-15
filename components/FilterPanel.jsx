/**
 * components/FilterPanel.jsx — duální vyhledávání + filtry + size guide
 * ---------------------------------------------------------------------------
 * Dvě cesty k výsledku, stejný výstup (query + filters), který posílá
 * rodičovská stránka na /api/search:
 *   - "text"   — jedno vyhledávací pole, přesný název produktu
 *   - "wizard" — čtyřkrokový filtr: Kategorie → Značka → Barva → Velikost
 *
 * Když má aktivní kategorie navázanou tabulku velikostí (`sizeGuide` v
 * lib/data/categories.js), zobrazí se tlačítko na její rozbalení přímo
 * v panelu — uživatel nemusí odcházet jinam.
 */
'use client';

import { useMemo, useState } from 'react';
import { BRAND_GROUPS } from '@/lib/data/brands';
import { CATEGORY_GROUPS, CATEGORY_INDEX, COLORS } from '@/lib/data/categories';
import { SIZE_GUIDES } from '@/lib/data/size-guides';
import SizeGuideTable from './SizeGuideTable';

const QUICK_CHIPS = [
  'Jordan 4 Retro',
  'Supreme Box Logo Hoodie',
  'Yeezy 350 Zebra',
  'Balenciaga Track',
  'Chrome Hearts ring',
  'Bearbrick 1000%',
];

function getSizeOptions(categoryId) {
  const category = CATEGORY_INDEX.get(categoryId);
  if (!category || !category.sizeGuide) return [];
  const guide = SIZE_GUIDES[category.sizeGuide];
  if (guide.id === 'shoes') {
    return guide.rows.map((row) => `EU ${row[1]} (US ${row[0]})`);
  }
  return guide.rows.map((row) => row[0]);
}

export default function FilterPanel({ onSubmit, loading }) {
  const [mode, setMode] = useState('text'); // 'text' | 'wizard'
  const [query, setQuery] = useState('');
  const [step, setStep] = useState(1);

  const [filters, setFilters] = useState({
    brand: '',
    category: '',
    colors: [],
    size: '',
    priceMin: '',
    priceMax: '',
  });

  const [showSizeGuide, setShowSizeGuide] = useState(false);

  const activeCategory = CATEGORY_INDEX.get(filters.category) || null;
  const sizeOptions = useMemo(() => getSizeOptions(filters.category), [filters.category]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleColor(colorId) {
    setFilters((prev) => {
      const has = prev.colors.includes(colorId);
      return {
        ...prev,
        colors: has ? prev.colors.filter((c) => c !== colorId) : [...prev.colors, colorId],
      };
    });
  }

  function colorLabels() {
    return filters.colors.map((id) => COLORS.find((c) => c.id === id)?.label).filter(Boolean);
  }

  function buildEffectiveQuery() {
    if (mode === 'text') return query.trim();
    // Ve wizard režimu dotaz poskládáme z filtrů, protože Firecrawl
    // potřebuje textový search query, i když uživatel nic nenapsal.
    const parts = [filters.brand, activeCategory?.label].filter(Boolean);
    return parts.join(' ').trim() || 'streetwear';
  }

  function handleSubmit(e) {
    e.preventDefault();
    const effectiveQuery = buildEffectiveQuery();
    if (!effectiveQuery) return;

    onSubmit(effectiveQuery, {
      brand: filters.brand || null,
      category: activeCategory?.label || null,
      colors: colorLabels(),
      size: filters.size || null,
      priceMin: filters.priceMin ? Number(filters.priceMin) : null,
      priceMax: filters.priceMax ? Number(filters.priceMax) : null,
    });
  }

  function handleChip(text) {
    setMode('text');
    setQuery(text);
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-5 sm:p-6">
      {/* Přepínač režimu hledání */}
      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setMode('text')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            mode === 'text'
              ? 'border-accent text-white bg-accent/10'
              : 'border-line text-neutral-400 hover:text-white'
          }`}
        >
          Přesné hledání
        </button>
        <button
          type="button"
          onClick={() => setMode('wizard')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            mode === 'wizard'
              ? 'border-accent text-white bg-accent/10'
              : 'border-line text-neutral-400 hover:text-white'
          }`}
        >
          Filtrovat krok za krokem
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {mode === 'text' ? (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='např. "Jordan 4 Military Blue 43"'
              className="field !py-3.5 !text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_CHIPS.map((text) => (
                <button key={text} type="button" className="chip" onClick={() => handleChip(text)}>
                  {text}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {/* Krokové ukazatele */}
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              {['Kategorie', 'Značka', 'Barva', 'Velikost'].map((label, i) => (
                <span
                  key={label}
                  className={`px-2 py-1 rounded-full border ${
                    step === i + 1
                      ? 'border-accent text-white'
                      : 'border-line text-neutral-500'
                  }`}
                >
                  {i + 1}. {label}
                </span>
              ))}
            </div>

            {step === 1 && (
              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Kategorie</label>
                <select
                  className="field"
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                >
                  <option value="">Jakákoli kategorie</option>
                  {CATEGORY_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            {step === 2 && (
              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Značka</label>
                <select
                  className="field"
                  value={filters.brand}
                  onChange={(e) => updateFilter('brand', e.target.value)}
                >
                  <option value="">Kterákoli značka</option>
                  {BRAND_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.brands.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            {step === 3 && (
              <div>
                <label className="block text-[11px] text-neutral-500 mb-2">Barva</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => toggleColor(color.id)}
                      className={`color-pill ${filters.colors.includes(color.id) ? 'active' : ''}`}
                    >
                      <span
                        className="color-dot"
                        style={{
                          background: color.hex
                            || 'conic-gradient(from 0deg, #ec4899, #eab308, #16a34a, #2563eb, #ec4899)',
                        }}
                      />
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Velikost</label>
                {sizeOptions.length ? (
                  <select
                    className="field"
                    value={filters.size}
                    onChange={(e) => updateFilter('size', e.target.value)}
                  >
                    <option value="">Jakákoli velikost</option>
                    {sizeOptions.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Pro tuhle kategorii se velikost neuplatňuje — pokračuj rovnou na hledání.
                  </p>
                )}

                {activeCategory?.sizeGuide && (
                  <button
                    type="button"
                    onClick={() => setShowSizeGuide((v) => !v)}
                    className="mt-2 text-[11px] text-accent-soft hover:underline"
                  >
                    {showSizeGuide ? 'Skrýt' : 'Zobrazit'} tabulku velikostí
                  </button>
                )}
              </div>
            )}

            {/* Navigace mezi kroky */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                className="btn-ghost !py-2 !px-4 !text-xs disabled:opacity-30"
                disabled={step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                Zpět
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  className="btn-primary !py-2 !px-4 !text-xs"
                  onClick={() => setStep((s) => Math.min(4, s + 1))}
                >
                  Další krok
                </button>
              ) : null}
            </div>

            {showSizeGuide && activeCategory?.sizeGuide && (
              <SizeGuideTable defaultGuide={activeCategory.sizeGuide} />
            )}
          </div>
        )}

        {/* Cena a odeslání jsou společné pro oba režimy */}
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div>
            <label className="block text-[11px] text-neutral-500 mb-1">Cena od (Kč)</label>
            <input
              type="number"
              min="0"
              step="100"
              className="field"
              placeholder="0"
              value={filters.priceMin}
              onChange={(e) => updateFilter('priceMin', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] text-neutral-500 mb-1">Cena do (Kč)</label>
            <input
              type="number"
              min="0"
              step="100"
              className="field"
              placeholder="bez limitu"
              value={filters.priceMax}
              onChange={(e) => updateFilter('priceMax', e.target.value)}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={loading}>
          {loading ? 'Hledám…' : 'Najít nejlepší cenu'}
        </button>
      </form>
    </div>
  );
}
