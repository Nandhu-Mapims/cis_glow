import { prisma } from '../../config/prisma.js';

const PAYMENT_MODES = [
  { value: '', label: 'All' },
  { value: 'Bank', label: 'Bank' },
  { value: 'Online', label: 'Online' },
  { value: 'RTGS/NEFT', label: 'RTGS/NEFT' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'D.D', label: 'D.D' },
];

export async function getFeeFilterOptions() {
  const accountHeads = await prisma.fee_label_master.findMany({
    where: { del: 1 },
    orderBy: { fee_order: 'asc' },
    select: { id: true, fee_name: true },
  });

  return {
    accountHeads: accountHeads.map((row) => ({
      value: String(row.id),
      label: row.fee_name,
    })),
    paymentModes: PAYMENT_MODES,
  };
}
