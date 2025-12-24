export function formatMoney(price, currency) {
  if (price === null || price === undefined || price === '') return '';
  const n = Number(price);
  if (Number.isNaN(n)) return `${price} ${currency || ''}`.trim();
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency || ''}`.trim();
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}
