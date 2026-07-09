import { prisma } from '../../../config/prisma.js';
import { printSetupTbSelect, printSignatureTbSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'print_setup.php';

function boolInt(val) {
  return val ? 1 : 0;
}

function mapPageOption(row) {
  return {
    value: String(row.id),
    label: `${row.id} | ${row.title}`,
    category: row.category,
  };
}

function mapSignature(sig) {
  return sig
    ? { id: sig.id, name: sig.staff_name, designation: sig.staff_designation }
    : { id: null, name: '', designation: '' };
}

export async function loadPrintSetupSetup(memberId, fields = {}, audit = {}) {
  const pageRef = String(fields.pageRef || '').trim();
  const allPages = await prisma.print_setup_tb.findMany({
    where: { del: 1 },
    orderBy: [{ category: 'asc' }, { p_order: 'asc' }],
    select: printSetupTbSelect,
  });

  const categories = [...new Set(allPages.map((p) => p.category))];
  const pageOptions = allPages.map(mapPageOption);

  let selected = null;
  if (pageRef && pageRef !== 'add_new') {
    const page = allPages.find((p) => String(p.id) === pageRef);
    if (page) {
      const sigRows = await prisma.print_signature_tb.findMany({
        where: { print_id: String(page.id), del: 1, category: { not: 'signature' } },
        select: printSignatureTbSelect,
      });
      const sigMap = Object.fromEntries(sigRows.map((s) => [s.category, s]));
      selected = {
        id: page.id,
        title: page.title,
        subTitle: page.sub_title,
        bodyTitle: page.body_title,
        category: page.category,
        order: page.p_order,
        pageNote: page.page_note,
        pageNo: page.page_no || 'none',
        rowCount: page.row_count,
        homeHeader: page.home_header === 1,
        innerHeader: page.inner_header === 1,
        homeHeight: page.home_height,
        innerHeight: page.inner_height,
        footer: page.footer === 1,
        rightText: page.right_text === 1,
        signature: page.signature === 1,
        generatedBy: page.generated_by === 1,
        approved: mapSignature(sigMap.approved),
        checked: mapSignature(sigMap.checked),
        verified: mapSignature(sigMap.verified),
      };
    }
  } else if (pageRef === 'add_new') {
    selected = {
      id: null,
      title: '',
      subTitle: '',
      bodyTitle: '',
      category: '',
      order: 1,
      pageNote: '',
      pageNo: 'none',
      rowCount: '',
      homeHeader: false,
      innerHeader: false,
      homeHeight: 0,
      innerHeight: 0,
      footer: false,
      rightText: false,
      signature: false,
      generatedBy: false,
      approved: { id: null, name: '', designation: '' },
      checked: { id: null, name: '', designation: '' },
      verified: { id: null, name: '', designation: '' },
    };
  }

  await logSettingsSetup(PAGE, 'View', 'Successful', pageRef, memberId, audit);
  return { pageRef, pageOptions, categories, selected };
}

async function upsertRoleSignature(printId, role, data, memberId, audit) {
  const { create, update } = auditFields(memberId, audit);
  const name = String(data.name || '').trim();
  const designation = String(data.designation || '').trim();
  if (!data.id && !name && !designation) return;
  if (!data.id) {
    await prisma.print_signature_tb.create({
      data: {
        print_id: String(printId),
        category: role,
        staff_name: name,
        staff_designation: designation,
        staff_order: 0,
        print_format: '',
        ...create,
      },
    });
  } else {
    await prisma.print_signature_tb.update({
      where: { id: Number(data.id) },
      data: { staff_name: name, staff_designation: designation, del: 1, ...update },
    });
  }
}

export async function savePrintSetupSetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const pageRef = String(payload.pageRef || '').trim();
  const form = payload.form || {};

  let pageId = pageRef === 'add_new' ? null : parseId(pageRef);
  const data = {
    title: String(form.title || '').trim(),
    sub_title: String(form.subTitle || '').trim(),
    body_title: String(form.bodyTitle || '').trim(),
    category: String(form.category || '').trim(),
    p_order: Number(form.order) || 0,
    page_note: String(form.pageNote || ''),
    page_no: String(form.pageNo || 'none'),
    row_count: String(form.rowCount || ''),
    home_header: boolInt(form.homeHeader),
    inner_header: boolInt(form.innerHeader),
    home_height: Number(form.homeHeight) || 0,
    inner_height: Number(form.innerHeight) || 0,
    footer: boolInt(form.footer),
    right_text: boolInt(form.rightText),
    signature: boolInt(form.signature),
    generated_by: boolInt(form.generatedBy),
    approved_by: boolInt(form.approved?.name || form.approved?.designation),
    checked_by: boolInt(form.checked?.name || form.checked?.designation),
    verified_by: boolInt(form.verified?.name || form.verified?.designation),
  };

  if (pageRef === 'add_new') {
    if (!data.title) return { success: false, message: 'Header title is required' };
    const created = await prisma.print_setup_tb.create({ data: { ...data, ...create } });
    pageId = created.id;
  } else if (pageId) {
    await prisma.print_setup_tb.update({ where: { id: pageId }, data: { ...data, ...update } });
    await prisma.print_signature_tb.updateMany({
      where: { print_id: String(pageId), category: { not: 'signature' } },
      data: { del: 0, ...update },
    });
  } else {
    return { success: false, message: 'Please select a print page' };
  }

  await upsertRoleSignature(pageId, 'approved', form.approved || {}, memberId, audit);
  await upsertRoleSignature(pageId, 'checked', form.checked || {}, memberId, audit);
  await upsertRoleSignature(pageId, 'verified', form.verified || {}, memberId, audit);

  await logSettingsSetup(PAGE, 'Update', 'Successful', data.title, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadPrintSetupSetup(memberId, { pageRef: String(pageId) }, { ...audit, skipLog: true })),
  };
}
