/**
 * lib/formatPrice.js — jednotné formátování cen napříč appkou.
 */
export function formatCZK(amount) {
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}
