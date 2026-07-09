/** Shared formatting for Fees module UI. */

export function formatIndianMoney(value) {
  const raw = String(value ?? '').replace(/,/g, '');
  const num = Number(raw);
  if (Number.isNaN(num)) return String(value ?? '0');
  return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function formatIndianMoneyDisplay(value) {
  return `₹ ${formatIndianMoney(value)}`;
}
