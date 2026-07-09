import { runLegacyBridge } from '../legacy/phpBridge.js';
import { logPayrollPage } from './payrollHelpers.js';
import { loadStipendPayrollMonthOptions } from './stipendHelpers.js';

const PAGE = 'stipend_payroll_individual_report3.php';

export async function loadStipendIndividualPdfReport(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadStipendPayrollMonthOptions(false);
  const payrollMonth = String(fields.payroll_month || '').trim();
  const copyType = String(fields.copy_type || 'Original Copy').trim();
  const isGenerate = fields.Submit === 'Generate';

  if (isGenerate && payrollMonth) {
    const raw = await runLegacyBridge('stipend_individual_report_pdf_bridge.php', {
      memberId,
      fields: {
        payroll_month: payrollMonth,
        copy_type: copyType,
      },
    });

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: 'Invalid response from PDF generator' };
    }

    if (parsed.error) {
      return { error: parsed.error };
    }

    await logPayrollPage(
      PAGE,
      'Generate',
      `${payrollMonth}___${copyType}`,
      memberId,
      audit,
    );

    return {
      monthOptions,
      selected: { payrollMonth, copyType },
      downloadUrl: parsed.downloadUrl || null,
      filename: parsed.filename,
      passwordHint: parsed.passwordHint,
      generated: true,
    };
  }

  await logPayrollPage(PAGE, 'View', payrollMonth, memberId, audit);

  return {
    monthOptions,
    selected: { payrollMonth, copyType },
    generated: false,
  };
}
