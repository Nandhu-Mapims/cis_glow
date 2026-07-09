import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const BUDGET_PAGE = 'task_budget_approved.php';

function formatMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('en-IN');
}

function formatDate(value) {
  if (!value || String(value).startsWith('0000-00-00')) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function listStatusBadge(row) {
  const sendApproval = Number(row.send_approval) === 1;
  const rsendApproval = Number(row.rsend_approval) === 1;
  const budgetStatus = Number(row.budget_status) || 0;
  const budgetFstatus = Number(row.budget_fstatus) || 0;

  if (rsendApproval && budgetFstatus === 1) {
    return { label: 'Final Approved', tone: 'final', dateLabel: 'Final Approved On', date: row.budget_fapproved_date };
  }
  if (rsendApproval && budgetFstatus === 0) {
    return { label: 'Rev: Waiting for Approval', tone: 'rev-wait', dateLabel: 'Waiting From', date: row.rsend_approval_date };
  }
  if (sendApproval && budgetStatus === 1) {
    return { label: 'Approved', tone: 'approved', dateLabel: 'Approved On', date: row.budget_approved_date };
  }
  if (sendApproval && budgetStatus === 2) {
    return { label: 'Rejected', tone: 'rejected', dateLabel: 'Rejected On', date: row.budget_approved_date };
  }
  if (sendApproval && budgetStatus === 0) {
    return { label: 'Waiting for Approval', tone: 'waiting', dateLabel: 'Waiting From', date: row.send_approval_date };
  }
  return { label: 'Waiting for Approval', tone: 'waiting', dateLabel: 'Waiting From', date: row.send_approval_date };
}

async function loadExpenseTitles() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, title FROM t_budget_expenses WHERE del=1 ORDER BY t_order ASC
  `);
  return Object.fromEntries(rows.map((r) => [Number(r.id), r.title || '']));
}

async function loadClientMap() {
  const rows = await prisma.$queryRawUnsafe(`SELECT id, client_name FROM t_client_master WHERE del=1`);
  return Object.fromEntries(rows.map((r) => [Number(r.id), r.client_name || '']));
}

function mapListItem(row, clientMap) {
  const badge = listStatusBadge(row);
  return {
    taskId: Number(row.task_allocation_id),
    title: row.task_name || '',
    categoryName: clientMap[Number(row.client_id)] || '',
    badgeLabel: badge.label,
    badgeTone: badge.tone,
    dateLabel: badge.dateLabel,
    dateValue: formatDate(badge.date),
  };
}

function mapBudgetLine(row, expenseTitles) {
  const titleId = Number(row.budget_title);
  const requestAmount = Number(row.budget_amount) || 0;
  const revisedAmount = Number(row.budget_ramount) || requestAmount;
  return {
    id: Number(row.id),
    titleId,
    titleName: expenseTitles[titleId] || String(titleId),
    details: row.budget_details || '',
    requestAmount,
    revisedAmount,
    finalAmount: Number(row.budget_rramount) || 0,
  };
}

function mapDetailSummary(row) {
  const income = Number(row.budget_income) || 0;
  const expenses = Number(row.budget_expenses) || 0;
  const revisedExpenses = Number(row.budget_rexpenses) || 0;
  const finalExpenses = Number(row.budget_rrexpenses) || 0;
  const required = Number(row.budget_required) || 0;
  const revisedRequired = Number(row.budget_rrequired) || 0;
  const finalRequired = Number(row.budget_rrrequired) || 0;

  return {
    income,
    expenses,
    revisedExpenses,
    finalExpenses,
    gain: Number(row.budget_tamount) || (income - expenses),
    revisedGain: Number(row.budget_rtamount) || (income - revisedExpenses),
    finalGain: Number(row.budget_rrtamount) || 0,
    required,
    revisedRequired,
    finalRequired,
    pending: expenses - required,
    revisedPending: revisedExpenses - revisedRequired,
    finalPending: finalExpenses - finalRequired,
    requiredWhom: row.budget_required_whom || '',
    sendApproval: Number(row.send_approval) || 0,
    rsendApproval: Number(row.rsend_approval) || 0,
    budgetStatus: Number(row.budget_status) || 0,
    budgetRstatus: Number(row.budget_rstatus) || 0,
    budgetFstatus: Number(row.budget_fstatus) || 0,
    showRevised: Number(row.budget_rstatus) === 1,
    showFinal: Number(row.rsend_approval) === 1 && Number(row.send_approval) === 1,
    canEditRevised: Number(row.rsend_approval) === 0 && Number(row.send_approval) === 1,
  };
}

export async function loadCommitteeTaskBudget(memberId, fields = {}, audit = {}) {
  const taskId = fields.taskId ? parseId(fields.taskId) : 0;
  const [clientMap, expenseTitles] = await Promise.all([loadClientMap(), loadExpenseTitles()]);

  if (!taskId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT A.task_allocation_id, B.task_name, B.client_id,
        A.send_approval,
        IF(A.send_approval_date='0000-00-00', NULL, A.send_approval_date) AS send_approval_date,
        A.budget_status,
        IF(A.budget_approved_date='0000-00-00', NULL, A.budget_approved_date) AS budget_approved_date,
        A.rsend_approval,
        IF(A.rsend_approval_date='0000-00-00', NULL, A.rsend_approval_date) AS rsend_approval_date,
        A.budget_fstatus,
        IF(A.budget_fapproved_date='0000-00-00', NULL, A.budget_fapproved_date) AS budget_fapproved_date
      FROM t_budget A
      INNER JOIN t_task_allocation B ON A.task_allocation_id=B.id
      WHERE A.del=1 AND B.del=1 AND B.status='Open' AND A.send_approval=1
      ORDER BY A.send_approval_date ASC
    `);

    if (!audit.skipLog) {
      await logModulePage(BUDGET_PAGE, 'View', 'Successful', 'list', memberId, audit);
    }

    return {
      success: true,
      view: 'list',
      items: rows.map((r) => mapListItem(r, clientMap)),
    };
  }

  const taskRows = await prisma.$queryRawUnsafe(`
    SELECT id, task_name FROM t_task_allocation WHERE del=1 AND id=${taskId} LIMIT 1
  `);
  if (!taskRows[0]) {
    return { success: false, message: 'Task not found.' };
  }

  const budgetRows = await prisma.$queryRawUnsafe(`
    SELECT id, budget_title, budget_details, budget_amount, budget_ramount, budget_rramount,
      budget_expenses, budget_rexpenses, budget_rrexpenses, budget_income, budget_tamount,
      budget_rtamount, budget_rrtamount, budget_required, budget_rrequired, budget_rrrequired,
      budget_required_whom, send_approval, rsend_approval, budget_status, budget_rstatus, budget_fstatus
    FROM t_budget WHERE del=1 AND task_allocation_id=${taskId}
    ORDER BY id ASC
  `);

  const summaryRow = budgetRows[0] || {};
  const summary = mapDetailSummary(summaryRow);
  const lines = budgetRows.map((r) => mapBudgetLine(r, expenseTitles));

  if (!audit.skipLog) {
    await logModulePage(BUDGET_PAGE, 'View', 'Successful', String(taskId), memberId, audit);
  }

  return {
    success: true,
    view: 'detail',
    taskId: String(taskId),
    taskName: taskRows[0].task_name || '',
    lines,
    summary,
  };
}

export async function saveCommitteeTaskBudget(payload, memberId, audit = {}) {
  const taskId = Number(payload.taskId);
  if (!taskId) return { success: false, message: 'Select a task.' };

  const { update } = auditFields(memberId, audit);
  const aStatus = payload.aStatus !== undefined ? Number(payload.aStatus) : null;
  const fStatus = payload.fStatus ? 1 : 0;
  const today = new Date().toISOString().slice(0, 10);
  const approvedDate = (aStatus === 1 || aStatus === 2) ? `'${today}'` : `'0000-00-00'`;

  let result = true;

  if (fStatus === 1) {
    await prisma.$executeRawUnsafe(`
      UPDATE t_budget SET budget_fstatus=1, budget_fapproved_date='${today}',
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE task_allocation_id=${taskId} AND del=1
    `);
  } else if (aStatus === 2) {
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    const totalRevised = Number(payload.totalRevisedExpenses) || 0;
    const totalIncome = Number(payload.totalIncome) || 0;
    const totalGain = Number(payload.totalGain) || 0;
    const revisedRequired = Number(payload.revisedRequired) || 0;

    for (const line of lines) {
      if (!line.id) continue;
      await prisma.$executeRawUnsafe(`
        UPDATE t_budget SET budget_ramount=${Number(line.revisedAmount) || 0},
          budget_rexpenses=${totalRevised},
          budget_rtamount=${totalGain},
          budget_rrequired=${revisedRequired},
          budget_status=1,
          budget_approved_date=${approvedDate},
          budget_rstatus=1,
          budget_rapproved_date=${approvedDate},
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE id=${Number(line.id)} AND del=1
      `);
    }
  } else if (aStatus === 1 || aStatus === 0) {
    await prisma.$executeRawUnsafe(`
      UPDATE t_budget SET budget_status=${aStatus},
        budget_approved_date=${approvedDate},
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE task_allocation_id=${taskId} AND del=1
    `);
  } else {
    return { success: false, message: 'Select a status.' };
  }

  if (!result) {
    return { success: false, message: 'Unable to save budget approval.' };
  }

  await logModulePage(BUDGET_PAGE, 'Update', 'Successful', String(taskId), memberId, audit);

  return {
    success: true,
    message: 'Budget updated.',
    ...(await loadCommitteeTaskBudget(memberId, { taskId: String(taskId) }, { ...audit, skipLog: true })),
  };
}
