/**
 * lib/rateLimit.js — ochrana /api/search proti zahlcení a botům
 * ---------------------------------------------------------------------------
 * Každé hledání stojí reálné peníze (Firecrawl + Gemini). Bez limitu by
 * appku mohl kdokoli (bot, script, omylem zacyklený požadavek) zahltit
 * a nechat tě platit za tisíce zbytečných volání. Tohle to omezuje na
 * rozumný počet hledání za minutu na jednu IP adresu.
 *
 * Používá @upstash/ratelimit (oficiální balíček od Upstash, ne vlastní
 * řešení) nad stejnou Redis databází, kterou už appka má pro cache.
 *
 * Pokud Redis není nakonfigurovaný, limiter se tiše vypne (appka dál
 * funguje bez ochrany, radši než aby kvůli chybějící databázi přestala
 * fungovat úplně) — stejná "fail-open" filozofie jako u cache.js.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// 10 hledání za minutu na jednu IP adresu. Uprav podle skutečného provozu —
// pro jednoho člověka co appku testuje je to víc než dost, na bota/skript
// to stačí zastavit hned po pár vteřinách.
const REQUESTS_PER_WINDOW = 10;
const WINDOW = '60 s';

let limiterInstance = null;

function buildRedisClient() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function getLimiter() {
  if (limiterInstance) return limiterInstance;

  const redis = buildRedisClient();
  if (!redis) return null;

  limiterInstance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(REQUESTS_PER_WINDOW, WINDOW),
    prefix: 'yprice:ratelimit',
    analytics: true,
  });
  return limiterInstance;
}

/** Vytáhne IP adresu volajícího z hlaviček (Vercel je posílá automaticky). */
export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Ověří limit pro daný požadavek. Vrací { success: boolean, ... }.
 * Nikdy nepadá nezachyceně — chyba limiteru appku neshodí, jen ochranu
 * pro tenhle jeden požadavek přeskočí.
 */
export async function checkRateLimit(request) {
  const limiter = getLimiter();
  if (!limiter) {
    return { success: true, skipped: 'redis-not-configured' };
  }

  const identifier = getClientIp(request);
  try {
    return await limiter.limit(identifier);
  } catch (err) {
    console.error('Rate limit check failed:', err);
    return { success: true, skipped: 'error' };
  }
}
