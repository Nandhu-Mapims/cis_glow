import { createMonthlyGridSetup } from './monthlyGridShared.js';

const otherDeduction = createMonthlyGridSetup({
  page: 'staff_deduction_add.php',
  tableName: 'salary_deductions',
  amountField: 'd_amount',
  reasonField: 'd_reason',
});

const lopDeduction = createMonthlyGridSetup({
  page: 'staff_lop_deduction.php',
  tableName: 'salary_lop_deductions',
  amountField: 'd_amount',
  reasonField: 'd_reason',
});

const tdsAdd = createMonthlyGridSetup({
  page: 'staff_tds_add.php',
  tableName: 'salary_tds',
  amountField: 'tds_amount',
  idField: 'tds_id',
  tdsFilter: true,
});

const chequePayment = createMonthlyGridSetup({
  page: 'staff_cheque_add.php',
  tableName: 'salary_cheque',
  amountField: 'pay_cheque',
  idField: 'tds_id',
  chequeMode: true,
});

export const loadOtherDeductionSetup = otherDeduction.load;
export const saveOtherDeductionSetup = otherDeduction.save;
export const loadLopDeductionSetup = lopDeduction.load;
export const saveLopDeductionSetup = lopDeduction.save;
export const loadTdsAddSetup = tdsAdd.load;
export const saveTdsAddSetup = tdsAdd.save;
export const loadChequePaymentSetup = chequePayment.load;
export const saveChequePaymentSetup = chequePayment.save;
