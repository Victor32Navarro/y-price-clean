/**
 * components/SizeGuideTable.jsx — tabulka velikostí s přepínačem
 * ---------------------------------------------------------------------------
 * Vykreslí SHOE_SIZE_GUIDE nebo APPAREL_SIZE_GUIDE z lib/data/size-guides.js.
 * Když je aktivní kategorie propojená s konkrétní tabulkou (viz
 * `sizeGuide` pole v lib/data/categories.js), otevře se rovnou na ní.
 */
'use client';

import { useState } from 'react';
import { SIZE_GUIDES } from '@/lib/data/size-guides';

export default function SizeGuideTable({ defaultGuide = 'shoes' }) {
  const [activeId, setActiveId] = useState(defaultGuide);
  const guide = SIZE_GUIDES[activeId];

  return (
    <div className="bg-card border border-line rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {Object.values(SIZE_GUIDES).map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActiveId(g.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeId === g.id
                ? 'border-accent text-white bg-accent/10'
                : 'border-line text-neutral-400 hover:text-white'
            }`}
          >
            {g.id === 'shoes' ? 'Boty' : 'Oblečení'}
          </button>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-white mb-3">{guide.title}</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="text-neutral-500 border-b border-line">
              {guide.columns.map((col) => (
                <th key={col} className="py-2 pr-4 font-medium">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.rows.map((row, i) => (
              <tr key={i} className="border-b border-line/50 text-neutral-200">
                {row.map((cell, j) => (
                  <td key={j} className="py-2 pr-4">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {guide.note && (
        <p className="mt-3 text-[11px] text-neutral-500 leading-relaxed">{guide.note}</p>
      )}
    </div>
  );
}
