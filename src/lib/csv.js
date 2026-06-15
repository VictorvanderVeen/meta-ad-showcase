/**
 * Builds a CSV of all decisions and triggers a download. No dependencies —
 * a Blob + temporary anchor is enough for a client-side export.
 */

function escapeCell(value) {
  const s = String(value ?? '');
  // Quote when the cell contains a delimiter, quote, or newline; double inner quotes.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(ads, decisions) {
  const header = ['id', 'name', 'format', 'brand', 'status', 'comment', 'updatedAt'];
  const rows = ads.map((ad) => {
    const d = decisions[ad.id] || {};
    return [ad.id, ad.name, ad.format || '', ad.brand || '', d.status || 'pending', d.comment || '', d.updatedAt || ''];
  });
  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
