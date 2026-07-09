/** Legacy student_fee_add.js fee total logic for collection slips. */

export function clampPayAmount(rawValue, balance) {
  const balanceNum = Number(balance) || 0;
  let pay = Number(rawValue);
  if (Number.isNaN(pay)) pay = 0;
  if (pay > balanceNum) pay = balanceNum;
  if (pay < 0) pay = 0;
  return pay;
}

export function computeFeeCollectionTotals(entries, discounts = {}) {
  const checked = entries.filter((e) => e.selected && e.status !== 'paid');
  const feeTot = {};

  checked.forEach((entry) => {
    const ftype = entry.feeType;
    if (!feeTot[ftype]) {
      feeTot[ftype] = { tot: 0, fine: 0, acYears: new Set() };
    }
    const pay = clampPayAmount(entry.feeAmount, entry.balanceAmount);
    feeTot[ftype].tot += pay;
    const acYear = entry.academicYear;
    if (!feeTot[ftype].acYears.has(acYear)) {
      feeTot[ftype].acYears.add(acYear);
      feeTot[ftype].fine += Number(entry.feeFine) || 0;
    }
  });

  let fineTypeId = null;
  let maxFine = 0;
  Object.entries(feeTot).forEach(([ftype, value]) => {
    if (value.fine > maxFine) {
      maxFine = value.fine;
      fineTypeId = ftype;
    }
  });

  let grandTotal = 0;
  const byType = {};

  Object.entries(feeTot).forEach(([ftype, value]) => {
    const discount = Number(discounts[ftype]?.amount) || 0;
    const fine = ftype === fineTypeId ? value.fine : 0;
    const total = value.tot + fine - discount;
    byType[ftype] = {
      fee: value.tot,
      fine,
      discount,
      discountDetails: discounts[ftype]?.details || '',
      total,
      fineApplied: ftype === fineTypeId,
    };
    if (!Number.isNaN(total)) grandTotal += total;
  });

  return { grandTotal, byType, fineTypeId };
}

export function groupEntriesForTabs(entries, feeTypeTabs = []) {
  const tabs = feeTypeTabs.length
    ? feeTypeTabs
    : [...new Set(entries.map((e) => e.feeType))].map((id) => ({ id, name: `Type ${id}` }));

  return tabs
    .map((tab) => ({
      ...tab,
      sections: groupSections(entries.filter((e) => e.feeType === tab.id)),
    }))
    .filter((tab) => tab.sections.some((s) => s.rows.length));
}

function groupSections(rows) {
  const sections = [];
  const seen = new Map();
  rows.forEach((row) => {
    if (!seen.has(row.sectionKey)) {
      const section = { key: row.sectionKey, label: row.sectionLabel, rows: [] };
      seen.set(row.sectionKey, section);
      sections.push(section);
    }
    seen.get(row.sectionKey).rows.push(row);
  });
  return sections;
}

export function totalsPayload(byType) {
  return Object.fromEntries(
    Object.entries(byType).map(([ftype, value]) => [
      ftype,
      {
        fee: String(value.fee),
        fine: String(value.fine),
        total: String(value.total),
        discount: String(value.discount),
        discountDetails: value.discountDetails || '',
      },
    ]),
  );
}

/** Sum of balance amounts for pending fee lines (legacy t_total_balance). */
export function computePendingBalanceTotal(entries) {
  return entries
    .filter((e) => e.status === 'pending')
    .reduce((sum, entry) => sum + (Number(entry.balanceAmount) || 0), 0);
}

/** Balance due for selected pending lines only. */
export function computeSelectedBalanceTotal(entries) {
  return entries
    .filter((e) => e.selected && e.status === 'pending')
    .reduce((sum, entry) => sum + (Number(entry.balanceAmount) || 0), 0);
}
