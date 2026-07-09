import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { ensureResearchTables } from './webDb.js';
import { auditFields, logWebSetup } from './webAudit.js';
import { saveLegacyBinaryFile } from './webUpload.js';

const PAGE_ADD = 'web_research_news_add.php';
const PAGE_EDIT = 'web_research_news_edit.php';
const DOC_EXT = new Set(['pdf', 'doc', 'docx']);

function mapProgram(row) {
  return {
    id: row.id,
    researchData: row.research_data || '',
    registrationClose: row.registration_close ? String(row.registration_close).slice(0, 10) : '',
    fromDate: row.from_date ? String(row.from_date).slice(0, 10) : '',
    description: row.description || '',
    attachment: row.attachment || '',
    venue: row.venue || '',
    webView: row.web_view === 1,
    progTime: row.prog_time || '',
    researchTopic: row.research_topic || '',
    presenterName: row.presenter_dr_name || '',
    presenterDesig: row.presenter_dr_desig || '',
    presenterDept: row.presenter_dr_dept || '',
    presenterCollege: row.presenter_dr_college || '',
    presenterCity: row.presenter_dr_city || '',
    targetLink: row.target_link || '',
    region: row.region || '',
    memberView: row.member_view === 1,
    eventStatus: row.event_status || '',
    eventTypes: row.event_types || '',
  };
}

const emptyForm = () => ({
  researchData: '',
  registrationClose: '',
  fromDate: new Date().toISOString().slice(0, 10),
  description: '',
  venue: '',
  webView: true,
  progTime: '',
  researchTopic: '',
  presenterName: '',
  presenterDesig: '',
  presenterDept: '',
  presenterCollege: '',
  presenterCity: '',
  targetLink: '',
  region: '',
  memberView: false,
  eventStatus: '',
  eventTypes: '',
});

async function saveProgramFields(memberId, fields, audit, programId = null) {
  const auditCtx = auditFields(memberId, audit);
  let attachment = fields.attachment || '';
  const attachFile = fields.files?.find((f) => f.field === 'attachment');
  if (attachFile) {
    const uploaded = await saveLegacyBinaryFile({
      folder: 'documents',
      file: attachFile,
      maxBytes: 10 * 1024 * 1024,
      allowedExt: DOC_EXT,
    });
    if (uploaded.error) return { error: uploaded.error };
    attachment = uploaded.filename;
  }

  const cols = {
    research_data: escapeSql(fields.researchData || ''),
    registration_close: fields.registrationClose ? `'${escapeSql(fields.registrationClose)}'` : 'NULL',
    from_date: fields.fromDate ? `'${escapeSql(fields.fromDate)}'` : 'NULL',
    description: escapeSql(fields.description || ''),
    attachment: escapeSql(attachment),
    venue: escapeSql(fields.venue || ''),
    web_view: fields.webView === false ? 0 : 1,
    prog_time: escapeSql(fields.progTime || ''),
    research_topic: escapeSql(fields.researchTopic || ''),
    presenter_dr_name: escapeSql(fields.presenterName || ''),
    presenter_dr_desig: escapeSql(fields.presenterDesig || ''),
    presenter_dr_dept: escapeSql(fields.presenterDept || ''),
    presenter_dr_college: escapeSql(fields.presenterCollege || ''),
    presenter_dr_city: escapeSql(fields.presenterCity || ''),
    target_link: escapeSql(fields.targetLink || ''),
    region: escapeSql(fields.region || ''),
    member_view: fields.memberView ? 1 : 0,
    event_status: escapeSql(fields.eventStatus || ''),
    event_types: escapeSql(fields.eventTypes || ''),
  };

  if (programId) {
    await prisma.$executeRawUnsafe(`
      UPDATE research_program SET
        research_data='${cols.research_data}',
        registration_close=${cols.registration_close},
        from_date=${cols.from_date},
        description='${cols.description}',
        attachment='${cols.attachment}',
        venue='${cols.venue}',
        web_view=${cols.web_view},
        prog_time='${cols.prog_time}',
        research_topic='${cols.research_topic}',
        presenter_dr_name='${cols.presenter_dr_name}',
        presenter_dr_desig='${cols.presenter_dr_desig}',
        presenter_dr_dept='${cols.presenter_dr_dept}',
        presenter_dr_college='${cols.presenter_dr_college}',
        presenter_dr_city='${cols.presenter_dr_city}',
        target_link='${cols.target_link}',
        region='${cols.region}',
        member_view=${cols.member_view},
        event_status='${cols.event_status}',
        event_types='${cols.event_types}',
        updated_dt=NOW(),
        updated_ip='${escapeSql(auditCtx.ip)}',
        updated_by='${escapeSql(auditCtx.by)}'
      WHERE id=${programId} AND del=1
    `);
    return { programId };
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO research_program
      (research_data, registration_close, from_date, description, attachment, venue,
       web_view, prog_time, research_topic, presenter_dr_name, presenter_dr_desig,
       presenter_dr_dept, presenter_dr_college, presenter_dr_city, target_link,
       region, member_view, event_status, event_types,
       created_dt, created_ip, created_by, del)
    VALUES
      ('${cols.research_data}', ${cols.registration_close}, ${cols.from_date},
       '${cols.description}', '${cols.attachment}', '${cols.venue}',
       ${cols.web_view}, '${cols.prog_time}', '${cols.research_topic}',
       '${cols.presenter_dr_name}', '${cols.presenter_dr_desig}',
       '${cols.presenter_dr_dept}', '${cols.presenter_dr_college}',
       '${cols.presenter_dr_city}', '${cols.target_link}',
       '${cols.region}', ${cols.member_view},
       '${cols.event_status}', '${cols.event_types}',
       NOW(), '${escapeSql(auditCtx.ip)}', '${escapeSql(auditCtx.by)}', 1)
  `);
  const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
  return { programId: Number(idRows[0]?.id) };
}

export async function loadWebResearchAdd(_memberId, _fields, _query, audit) {
  await ensureResearchTables();
  await logWebSetup(_memberId, audit, PAGE_ADD, 'load');
  return { success: true, form: emptyForm() };
}

export async function saveWebResearchAdd(memberId, fields, _query, audit) {
  await ensureResearchTables();
  if (!String(fields.researchTopic || '').trim()) {
    return { success: false, message: 'Research topic is required.' };
  }
  const result = await saveProgramFields(memberId, fields, audit);
  if (result.error) return { success: false, message: result.error };
  await logWebSetup(memberId, audit, PAGE_ADD, 'save');
  return { success: true, message: 'Research program added.', programId: result.programId };
}

export async function loadWebResearchEdit(_memberId, fields, query, audit) {
  await ensureResearchTables();
  const programId = fields.programId || query.programId ? parseId(fields.programId || query.programId) : null;
  const list = await prisma.$queryRawUnsafe(`
    SELECT id, research_topic, from_date, venue, web_view
    FROM research_program WHERE del=1
    ORDER BY from_date DESC, id DESC
    LIMIT 100
  `);

  let form = null;
  if (programId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT * FROM research_program WHERE del=1 AND id=${programId} LIMIT 1
    `);
    if (rows[0]) form = mapProgram(rows[0]);
  }

  await logWebSetup(_memberId, audit, PAGE_EDIT, 'load');
  return {
    success: true,
    programs: list.map((r) => ({
      id: r.id,
      topic: r.research_topic || r.id,
      fromDate: r.from_date ? String(r.from_date).slice(0, 10) : '',
      venue: r.venue || '',
      webView: r.web_view === 1,
    })),
    programId,
    form: form || emptyForm(),
  };
}

export async function saveWebResearchEdit(memberId, fields, _query, audit) {
  await ensureResearchTables();
  const programId = parseId(fields.programId);
  if (!programId) return { success: false, message: 'Select a program.' };
  const result = await saveProgramFields(memberId, fields, audit, programId);
  if (result.error) return { success: false, message: result.error };
  await logWebSetup(memberId, audit, PAGE_EDIT, 'save');
  return { success: true, message: 'Research program updated.' };
}
