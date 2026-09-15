/**
 * lib/cache.js — tenká vrstva nad Upstash Redis (Vercel Marketplace)
 * ---------------------------------------------------------------------------
 * DŮLEŽITÉ: Vercel KV (@vercel/kv) je mrtvý balíček — Vercel ho zrušil a
 * přesměroval na Upstash Redis. Proto tady používáme @upstash/redis přímo.
 *
 * NASTAVENÍ:
 *   1. Vercel Dashboard → Storage → Marketplace Database Providers → Upstash
 *      → vytvoř Redis databázi a propoj s projektem (nebo `vercel storage
 *      connect` z CLI, pokud dashboard zlobí).
 *   2. Tohle do projektu automaticky přidá env proměnné
 *      UPSTASH_REDIS_REST_URL a UPSTASH_REDIS_REST_TOKEN.
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
    // Redis.fromEnv() čte UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
    redisClient = Redis.fromEnv();
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
