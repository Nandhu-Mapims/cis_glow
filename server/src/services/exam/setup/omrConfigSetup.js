import { prisma } from '../../../config/prisma.js';
import { auditFields, logExamSetup } from './setupAudit.js';

const PAGE = 'omr_style_config.php';

function mapConfig(row) {
  return {
    id: row?.id || 1,
    marginFirstPage: row?.t_margin_fpage || '',
    marginSecondPage: row?.t_margin_spage || '',
    qrTop: row?.qr_top || '',
    qrLeft: row?.qr_left || '',
    regTop: row?.reg_top || '',
    regLeft: row?.reg_left || '',
    rightWidth: row?.right_width || '',
    shadedPercent: row?.shaded_per || '',
  };
}

export async function loadOmrConfig(memberId, _fields = {}, audit = {}) {
  const row = await prisma.cia_sheet_config.findFirst({ where: { id: 1 } });
  await logExamSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return mapConfig(row);
}

export async function saveOmrConfig(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const data = {
    t_margin_fpage: String(payload.marginFirstPage || '').trim(),
    t_margin_spage: String(payload.marginSecondPage || '').trim(),
    qr_top: String(payload.qrTop || '').trim(),
    qr_left: String(payload.qrLeft || '').trim(),
    reg_top: String(payload.regTop || '').trim(),
    reg_left: String(payload.regLeft || '').trim(),
    right_width: String(payload.rightWidth || '').trim(),
    shaded_per: String(payload.shadedPercent || '').trim(),
    ...update,
  };

  const existing = await prisma.cia_sheet_config.findFirst({ where: { id: 1 } });
  if (!existing) {
    await prisma.cia_sheet_config.create({ data: { id: 1, ...data } });
  } else {
    await prisma.cia_sheet_config.update({ where: { id: 1 }, data });
  }

  await logExamSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadOmrConfig(memberId, {}, { ...audit, skipLog: true })),
  };
}
