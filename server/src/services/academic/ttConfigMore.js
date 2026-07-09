import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';
import { resolveSubjectAcademicYear } from './academicSetupShared.js';

/** Legacy: tt_config_more.php (timetable_tb) and tt_config_more_v3.php (timetable_tb_new). */

export const TT_CONFIG_V1 = { tableName: 'timetable_tb', logPage: 'tt_config_more.php' };
export const TT_CONFIG_V3 = { tableName: 'timetable_tb_new', logPage: 'tt_config_more_v3.php' };

function parseBody(body) {
  const params = new URLSearchParams(body || '');
  const out = {};
  for (const [key, val] of params.entries()) {
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2);
      if (!out[k]) out[k] = [];
      out[k].push(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function parseTimetableInputDate(val) {
  const s = String(val || '').trim();
  if (!s) return null;
  const dmY = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmY) {
    const iso = `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return iso;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function staffLabel(row) {
  const title = row.staff_title ? `${row.staff_title}. ` : '';
  return `${row.staff_id} | ${title}${row.staff_name || ''} ${row.staff_initial || ''}`.trim();
}

async function loadStaffOptions(deptIds) {
  let deptFilter = '';
  if (deptIds) {
    const parts = String(deptIds).split(',').map((d) => d.trim()).filter(Boolean)
      .map((d) => `B.department='${escapeSql(d)}'`);
    if (parts.length) deptFilter = ` AND (${parts.join(' OR ')})`;
  }
  let rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_title, A.staff_name, A.staff_initial
     FROM staff_profile_tb AS A
     INNER JOIN staff_designation_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND (A.releaving_date = '0000-00-00' OR A.releaving_date > CURDATE())
       AND B.del = 1 AND B.is_academic = 1 ${deptFilter}
     ORDER BY A.staff_id ASC`,
  );
  if (!rows.length) {
    rows = await prisma.$queryRawUnsafe(
      `SELECT A.id, A.staff_id, A.staff_title, A.staff_name, A.staff_initial
       FROM staff_profile_tb AS A
       INNER JOIN staff_designation_tb AS B ON A.id = B.staff_id
       WHERE A.del = 1 AND (A.releaving_date = '0000-00-00' OR A.releaving_date > CURDATE())
         AND B.del = 1 AND B.is_academic = 1 ORDER BY A.staff_id ASC`,
    );
  }
  return rows.map((r) => `<option value="${r.id}">${staffLabel(r)}</option>`).join('');
}

async function loadTopicOptions(subjectKey) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.name, B.name AS topic_name, B.id AS topic_id
     FROM basic_subject_unit AS A
     INNER JOIN basic_subject_chapter AS B ON A.id = B.u_id
     WHERE A.del = 1 AND B.del = 1 AND A.subject_id = '${escapeSql(String(subjectKey))}'
     ORDER BY B.name ASC`,
  );
  return rows.map((r) => `<option value="${r.topic_id}">${r.name} | ${r.topic_name}</option>`).join('');
}

function batchSelectHtml(rowIndex, batchCount, selected = '') {
  const count = Math.max(1, Number(batchCount) || 1);
  if (count <= 1) {
    return `<input type="hidden" name="tsub_batch_${rowIndex}[]" value="1" />`;
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const selectedList = String(selected || '').split(',').map((s) => s.trim()).filter(Boolean);
  let html = `<select name="tsub_batch_${rowIndex}[]" class="form-select form-select-sm" multiple>`;
  for (let b = 1; b <= count; b += 1) {
    const sel = selectedList.includes(String(b)) ? ' selected' : '';
    html += `<option value="${b}"${sel}>${letters[b - 1] || b}</option>`;
  }
  return `${html}</select>`;
}

async function callTimetable(pdayList, pnoList, tcourse, tayear, tcyear, tcacademic, tmp, tableName) {
  const teopt = tmp[0];
  const tptype = tmp[1];
  const tsgp = tmp[2];

  let periodDayStr = '';
  let periodSearchString = '';
  let periodSearchLabel = '';
  for (let p = 0; p < pdayList.length; p += 1) {
    if (pdayList[p] && pnoList[p]) {
      periodDayStr += `<input type="hidden" name="tt_day[]" value="${pdayList[p]}" />
        <input type="hidden" name="tt_period[]" value="${pnoList[p]}" />`;
      periodSearchLabel += `${pdayList[p]} - ${pnoList[p]}, `;
      periodSearchString += ` (t_day='${escapeSql(pdayList[p])}' AND period='${escapeSql(pnoList[p])}') OR`;
    }
  }
  if (periodSearchString) {
    periodSearchString = ` AND (${periodSearchString.slice(0, -2)})`;
    periodSearchLabel = periodSearchLabel.slice(0, -2);
  }

  const subjectYear = await resolveSubjectAcademicYear(tcourse, tayear, tcyear);

  const batchRow = await prisma.$queryRawUnsafe(
    `SELECT batch_no FROM basic_subject_batch_tb
     WHERE course_id = '${escapeSql(tcourse)}' AND academic_year = '${escapeSql(subjectYear)}'
       AND current_year = '${escapeSql(tcyear)}' AND academic_type = '${escapeSql(tcacademic)}' AND del = 1
     ORDER BY batch_no+0 DESC LIMIT 1`,
  );
  let totalBatch = Math.max(1, Number(batchRow[0]?.batch_no) || 1);

  const subcatRows = await prisma.$queryRawUnsafe(
    "SELECT id, category_name FROM subject_master WHERE del = 1 AND category = 'Timetable' ORDER BY category_order ASC",
  );
  const subcatMap = Object.fromEntries(subcatRows.map((r) => [String(r.id), r.category_name]));

  const subjectRows = await prisma.$queryRawUnsafe(
    `SELECT A.subject_id, A.subject_name, B.id, B.subject_id AS t_subject_id, B.subject_name AS t_subject_name,
            B.subject_category, B.s_batch, B.department, B.short_subject_name, A.id AS setup_rid
     FROM basic_setup_subject_tb AS A
     INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
     WHERE A.del = 1 AND A.academic_year = '${escapeSql(subjectYear)}'
       AND A.course_id = '${escapeSql(tcourse)}' AND A.semester_no = '${escapeSql(tcyear)}' AND B.del = 1
     ORDER BY A.subject_order ASC`,
  );

  const subjectListArray = {};
  let subjectListString = '';
  for (const row of subjectRows) {
    const tSid = row.id;
    const cat = subcatMap[String(row.subject_category)] || '';
    const fname = `${row.t_subject_id} | ${row.t_subject_name} | ${cat}`;
    const sname = `${row.short_subject_name || row.t_subject_name} (${cat.slice(0, 2)})`;
    subjectListArray[tSid] = {
      name: fname,
      sname,
      dept: row.department,
      batch: row.s_batch === 1 ? totalBatch : 1,
      rid: row.setup_rid || tSid,
    };
    subjectListString += `<option value="${tSid}">${fname}</option>`;
  }

  let fPeriodType = 0;
  let fSubjectCount = 1;
  const existing = await prisma.$queryRawUnsafe(
    `SELECT period_type, subject_count FROM ${tableName}
     WHERE del = 1 AND course_id = '${escapeSql(tcourse)}' AND academic_year = '${escapeSql(tayear)}'
       AND current_year = '${escapeSql(tcyear)}' AND academic_type = '${escapeSql(tcacademic)}'
       ${periodSearchString} LIMIT 1`,
  );
  if (existing[0]) {
    fPeriodType = Number(existing[0].period_type) || 0;
    fSubjectCount = Number(existing[0].subject_count) || 1;
  }
  if (tptype !== '' && tptype !== undefined && tptype !== null) {
    fPeriodType = Number(tptype);
    fSubjectCount = Number(tsgp) || fSubjectCount;
  }

  let tempSubList = '';
  const tempSubList1 = [];
  const ttRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT subject_id, batch_no, staff_id,
            CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date,
            period_type, subject_count, topic_id, id
     FROM ${tableName} WHERE del = 1 AND course_id = '${escapeSql(tcourse)}'
       AND academic_year = '${escapeSql(tayear)}' AND current_year = '${escapeSql(tcyear)}'
       AND academic_type = '${escapeSql(tcacademic)}' ${periodSearchString}
     ORDER BY from_date ASC`,
  );

  let scount = 0;
  for (const row of ttRows) {
    const fromDisp = row.from_date && !String(row.from_date).startsWith('0000')
      ? new Date(row.from_date).toLocaleDateString('en-GB').replace(/\//g, '-') : '';
    const toDisp = row.to_date && !String(row.to_date).startsWith('0000')
      ? new Date(row.to_date).toLocaleDateString('en-GB').replace(/\//g, '-') : '';

    let subjectDetails = `<select name="tsub_id[]" class="form-select form-select-sm" data-row="${scount}"><option value="">--Subject--</option>`;
    let deptStr = '';
    for (const [tsubId, tsub] of Object.entries(subjectListArray)) {
      const sel = String(row.subject_id) === String(tsubId) ? ' selected' : '';
      if (sel) deptStr = tsub.dept;
      subjectDetails += `<option value="${tsubId}"${sel}>${tsub.name}</option>`;
    }
    subjectDetails += '</select>';

    const staffOpts = await loadStaffOptions(deptStr);
    const topicOpts = await loadTopicOptions(
      subjectListArray[row.subject_id]?.rid || row.subject_id,
    );
    const batchHtml = batchSelectHtml(
      scount,
      subjectListArray[row.subject_id]?.batch || 1,
      row.batch_no,
    );

    tempSubList += `<tr><td class="text-center">${scount + 1}</td><td>${subjectDetails}
      <input name="tt_id[]" type="hidden" value="${row.id}" /></td>
      <td id="topic_con_${scount}"><select name="ttopic_${scount}[]" class="form-select form-select-sm" multiple>${topicOpts}</select></td>
      <td id="batch_con_${scount}">${batchHtml}</td>
      <td id="dept_con_${scount}"><select name="tsub_department_${scount}[]" class="form-select form-select-sm" multiple>${staffOpts}</select></td>
      <td><input type="text" name="fdate[]" class="form-control form-control-sm" placeholder="dd-mm-yyyy" value="${fromDisp}" /></td>
      <td><input type="text" name="tdate[]" class="form-control form-control-sm" placeholder="dd-mm-yyyy" value="${toDisp}" /></td></tr>`;
    tempSubList1.push(`<strong>${subjectListArray[row.subject_id]?.sname || ''}</strong><br>`);
    scount += 1;
  }

  if (!tempSubList) {
    tempSubList = `<tr><td class="text-center">1</td><td><select name="tsub_id[]" class="form-select form-select-sm" data-row="0"><option value="">--Subject--</option>${subjectListString}</select></td>
      <td id="topic_con_0"></td><td id="batch_con_0"></td><td id="dept_con_0"></td>
      <td><input type="text" name="fdate[]" class="form-control form-control-sm" placeholder="dd-mm-yyyy" /></td>
      <td><input type="text" name="tdate[]" class="form-control form-control-sm" placeholder="dd-mm-yyyy" /></td></tr>`;
  }

  const subjectMetaHidden = Object.entries(subjectListArray)
    .map(([id, sub]) => `<input type="hidden" id="sbtch_${id}" value="${sub.batch}" />`)
    .join('');

  const c1 = fPeriodType === 1 ? '' : ' checked';
  const c2 = fPeriodType === 1 ? ' checked' : '';

  const html = `<form id="tt-allocation-form">
  ${periodDayStr}
  <input type="hidden" name="total_subject" id="total_subject" value="${fSubjectCount}" />
  ${subjectMetaHidden}
  <div class="row g-2 mb-3 tt-allocation-meta">
    <div class="col-sm-6 col-lg-4">
      <div class="border rounded p-2 h-100">
        <div class="text-muted small">Day &amp; Period</div>
        <div class="fw-semibold">${periodSearchLabel}</div>
      </div>
    </div>
    <div class="col-sm-6 col-lg-4">
      <div class="border rounded p-2 h-100">
        <div class="text-muted small">Type</div>
        <div class="mt-1">
          <label class="me-3 mb-0"><input name="period_type" type="radio" value="0"${c1} /> Single</label>
          <label class="mb-0"><input name="period_type" type="radio" value="1"${c2} /> Combined</label>
        </div>
      </div>
    </div>
  </div>
  <div class="table-responsive">
    <table class="table table-bordered table-sm tt-allocation-grid mb-0" id="mySubTable">
      <thead class="table-secondary">
        <tr>
          <th style="width:3rem">#</th>
          <th style="min-width:12rem">Subject</th>
          <th style="min-width:10rem">Topic</th>
          <th style="min-width:6rem">Batch</th>
          <th style="min-width:12rem">Staff</th>
          <th style="min-width:7rem">From</th>
          <th style="min-width:7rem">To</th>
        </tr>
      </thead>
      <tbody>${tempSubList}</tbody>
    </table>
  </div>
</form>`;

  const summary = tempSubList1.length > 5
    ? tempSubList1.slice(0, 5).join('') + `+${tempSubList1.length - 5} more...`
    : tempSubList1.join('');

  return [html, summary];
}

async function saveTimetable(post, memberId, audit, { tableName, logPage }) {
  const ttCourse = post.tt_course;
  const ttAyear = post.tt_ayear;
  const ttCyear = post.tt_cyear;
  const ttCacademic = post.tt_cacademic;
  if (!ttCourse || !ttAyear || !ttCyear || !ttCacademic) {
    return { success: false };
  }

  const ttDays = Array.isArray(post.tt_day) ? post.tt_day : [post.tt_day].filter(Boolean);
  const ttPeriods = Array.isArray(post.tt_period) ? post.tt_period : [post.tt_period].filter(Boolean);
  const subIds = Array.isArray(post.tsub_id) ? post.tsub_id : [post.tsub_id].filter(Boolean);
  const fdates = Array.isArray(post.fdate) ? post.fdate : [post.fdate].filter(Boolean);
  const tdates = Array.isArray(post.tdate) ? post.tdate : [post.tdate].filter(Boolean);
  const now = new Date();

  for (let i = 0; i < ttDays.length; i += 1) {
    const day = ttDays[i];
    const period = ttPeriods[i];
    if (!day || !period) continue;

    await prisma.$executeRawUnsafe(
      `UPDATE ${tableName} SET del = 0, updated_by = '${escapeSql(memberId)}',
         updated_dt = NOW(), updated_ip = '${escapeSql(audit.ip || '')}'
         WHERE del = 1 AND course_id = '${escapeSql(ttCourse)}'
         AND academic_year = '${escapeSql(ttAyear)}' AND current_year = '${escapeSql(ttCyear)}'
         AND academic_type = '${escapeSql(ttCacademic)}' AND t_day = '${escapeSql(day)}'
         AND period = '${escapeSql(period)}'`,
    );

    for (let s = 0; s < subIds.length; s += 1) {
      const subId = subIds[s];
      const batchKey = `tsub_batch_${s}`;
      const staffKey = `tsub_department_${s}`;
      const topicKey = `ttopic_${s}`;
      const batchList = Array.isArray(post[batchKey]) ? post[batchKey] : post[batchKey] ? [post[batchKey]] : ['1'];
      const staffList = Array.isArray(post[staffKey]) ? post[staffKey] : post[staffKey] ? [post[staffKey]] : [];
      const topicList = Array.isArray(post[topicKey]) ? post[topicKey] : post[topicKey] ? [post[topicKey]] : [];

      const fdate = parseTimetableInputDate(fdates[s]);
      const tdate = parseTimetableInputDate(tdates[s]);
      if (!subId || !batchList.length) continue;

      if (tableName === 'timetable_tb') {
        await prisma.$executeRawUnsafe(
          `INSERT INTO timetable_tb(tt_id, course_id, academic_year, current_year, academic_type,
             t_day, period, subject_id, batch_no, staff_id, from_date, to_date, period_type,
             subject_count, topic_id, room_no, pg_std_id, created_dt, created_ip, created_by)
           VALUES ('', '${escapeSql(ttCourse)}', '${escapeSql(ttAyear)}', '${escapeSql(ttCyear)}',
             '${escapeSql(ttCacademic)}', '${escapeSql(day)}', '${escapeSql(period)}',
             '${escapeSql(subId)}', '${escapeSql(batchList.join(','))}', '${escapeSql(staffList.join(','))}',
             '${fdate || '1970-01-01'}', '${tdate || '1970-01-01'}', '${Number(post.period_type) || 0}',
             '${Number(post.total_subject) || 1}', '${escapeSql(topicList.join(','))}', 0, '',
             NOW(), '${escapeSql(audit.ip || '')}', '${escapeSql(memberId)}')`,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO timetable_tb_new (
             course_id, academic_year, current_year, academic_type, t_day, period, subject_id,
             batch_no, staff_id, from_date, to_date, period_type, subject_count, topic_id, room_no,
             created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
           ) VALUES (
             '${escapeSql(ttCourse)}', '${escapeSql(ttAyear)}', '${escapeSql(ttCyear)}',
             '${escapeSql(ttCacademic)}', '${escapeSql(day)}', '${escapeSql(period)}',
             '${escapeSql(subId)}', '${escapeSql(batchList.join(','))}', '${escapeSql(staffList.join(','))}',
             '${fdate || '1970-01-01'}', '${tdate || '1970-01-01'}', '${Number(post.period_type) || 0}',
             '${Number(post.total_subject) || 1}', '${escapeSql(topicList.join(','))}', 0,
             NOW(), '${escapeSql(audit.ip || '')}', '${escapeSql(memberId)}',
             NOW(), '${escapeSql(audit.ip || '')}', '${escapeSql(memberId)}', 1
           )`,
        );
      }
    }
  }

  await insertLog(
    [logPage, 'Update', 'Successful', `${ttCourse}, ${ttAyear}, ${ttCyear}`, now, audit.ip || '', '', memberId],
    '',
  );
  return { success: true, ttDays, ttPeriods, ttCourse, ttAyear, ttCyear, ttCacademic };
}

export async function runTtConfigMoreNative(memberId, { body, query } = {}, audit = {}, config = TT_CONFIG_V1) {
  const { tableName, logPage } = config;
  if (body) {
    const post = parseBody(body);
    if (post.Save === 'Save') {
      const saved = await saveTimetable(post, memberId, audit, { tableName, logPage });
      if (!saved.success) return JSON.stringify([0]);
      const tmp = ['', 0, ''];
      const result = await callTimetable(
        saved.ttDays, saved.ttPeriods, saved.ttCourse, saved.ttAyear, saved.ttCyear, saved.ttCacademic, tmp, tableName,
      );
      return JSON.stringify([1, result[1]]);
    }
    return JSON.stringify([0]);
  }

  const q = query || {};
  const flag = Number(q.flag);
  if (flag === 1 && q.sid && /^\d+$/.test(String(q.sid))) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT department, rid FROM basic_subject_tt_tb WHERE del = 1 AND id = ${Number(q.sid)} LIMIT 1`,
    );
    const row = rows[0];
    const subjectKey = row?.rid || q.sid;
    const staffOpts = await loadStaffOptions(row?.department);
    const topicOpts = await loadTopicOptions(subjectKey);
    return JSON.stringify([1, staffOpts, topicOpts]);
  }

  if (flag === 2) {
    const pday = String(q.pday || '');
    const pno = String(q.pno || '');
    const tcourse = String(q.tcourse || '');
    const tayear = String(q.tayear || '');
    const tcyear = String(q.tcyear || '');
    const tcacademic = String(q.tcacademic || '');
    if (pday && pno && tcourse && tayear && tcyear && tcacademic) {
      const result = await callTimetable(
        pday.split(','), pno.split(','), tcourse, tayear, tcyear, tcacademic,
        [q.eopt || '', q.ptype || '', q.sgp || ''],
        tableName,
      );
      return JSON.stringify([1, result[0], result[1]]);
    }
  }

  return JSON.stringify([0]);
}
