/**
 * lib/cache.js — tenká vrstva nad Upstash Redis (Vercel Marketplace)
 * ---------------------------------------------------------------------------
 * DŮLEŽITÉ: Vercel KV (@vercel/kv) je mrtvý balíček — Vercel ho zrušil a
 * přesměroval na Upstash Redis. Proto tady používáme @upstash/redis přímo.
 *
 * NASTAVENÍ:
 *   1. Vercel Dashboard → Storage → propoj Upstash Redis databázi s projektem.
 *   2. Tohle do projektu přidá env proměnné — POZOR, integrace je aktuálně
 *      pojmenovává ve starším stylu (kvůli zpětné kompatibilitě s bývalým
 *      Vercel KV), tedy `KV_REST_API_URL` a `KV_REST_API_TOKEN`, ne
 *      `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, jak by se čekalo.
 *      Kód níže proto zkouší obě varianty názvů, ať funguje, ať se Vercel
 *      rozhodne pro kterékoli pojmenování.
 *   3. npm install @upstash/redis
 *
 * Cache klíč = normalizovaný dotaz + filtry (viz buildCacheKey), aby
 * "Jordan 4" a "jordan   4" trefily stejný záznam.
 */

import { Redis } from '@upstash/redis';

const CACHE_TTL_SECONDS = 26 * 60 * 60; // o něco víc než 24 h — kryje se s cronem

let redisClient = null;

function getRedis() {
  if (!redisClient) {
    // Zkusíme oba páry názvů, které Vercel/Upstash integrace v praxi používá.
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Chybí přístupové údaje k Redis (KV_REST_API_URL/TOKEN nebo ' +
        'UPSTASH_REDIS_REST_URL/TOKEN) — zkontroluj propojení Upstash databáze.'
      );
    }

    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

/** Deterministický cache klíč — stejný dotaz+filtry musí vždy dát stejný klíč. */
export function buildCacheKey(query, filters = {}) {
  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const parts = [
    normalizedQuery,
    filters.brand || '',
    filters.category || '',
    (filters.colors || []).slice().sort().join(','),
    filters.size || '',
    filters.priceMin ?? '',
    filters.priceMax ?? '',
  ];
  return `offers:${parts.join('|')}`;
}

export async function getCachedOffers(cacheKey) {
  try {
    const cached = await getRedis().get(cacheKey);
    return cached || null;
  } catch (err) {
    // Cache je optimalizace, ne kritická závislost — když Redis zlobí,
    // appka má dál fungovat, jen bez cache (živé vyhledávání jako fallback).
    console.error('Cache read failed:', err);
    return null;
  }
}

export async function setCachedOffers(cacheKey, offers) {
  try {
    await getRedis().set(cacheKey, offers, { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    console.error('Cache write failed:', err);
  }
}

