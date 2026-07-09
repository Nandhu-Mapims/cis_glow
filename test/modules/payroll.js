import { assertOk } from '../lib/assert.js';
import { PAYROLL_SETUP, setupLoadTests } from '../lib/screens.js';

const PAYROLL_REPORTS = [
  { path: '/api/payroll/generate-payroll', name: 'Generate payroll report', screen: 'generate-payroll' },
  { path: '/api/payroll/att-report', name: 'Payroll attendance report', screen: 'payroll-att-report' },
  { path: '/api/payroll/monthly-report', name: 'Payroll monthly report', screen: 'payroll-monthly-report' },
  { path: '/api/payroll/tax-report', name: 'Payroll tax report', screen: 'payroll-tax-report' },
  { path: '/api/payroll/stipend/generate-payroll', name: 'Stipend generate payroll', screen: 'stipend-generate' },
  { path: '/api/payroll/stipend/att-report', name: 'Stipend attendance report', screen: 'stipend-att-report' },
];

export const payrollTests = [
  ...setupLoadTests({ module: 'payroll', basePath: '/api/payroll/setup', screens: PAYROLL_SETUP }),
  ...PAYROLL_REPORTS.map(({ path, name, screen }) => ({
    id: `payroll.read.${screen}`,
    module: 'payroll',
    op: 'R',
    name,
    screen,
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get(path);
      assertOk(res, name);
    },
  })),
  {
    id: 'payroll.update.pf-esi-setup',
    module: 'payroll',
    op: 'U',
    name: 'Update PF/ESI setup slab',
    screen: 'pf-esi-setup',
    mutation: true,
    async run(ctx) {
      await ctx.client.login();
      const load = await ctx.post('/api/payroll/setup/pf-esi-setup/load', { fields: {} });
      assertOk(load, 'load pf-esi-setup');
      const selected = load.data?.selected;
      if (!selected?.id || !selected.fromMonth || !selected.toMonth) {
        throw new Error('No PF/ESI slab with valid from/to months in database');
      }
      const save = await ctx.post('/api/payroll/setup/pf-esi-setup/save', {
        fields: {
          Submit: 'Update',
          academic_date: selected.id,
          h_from_date: selected.fromMonth,
          h_to_date: selected.toMonth,
          epf_er: String(selected.epfEr ?? '1.67'),
          eps: String(selected.eps ?? '8.33'),
          adm_charge: String(selected.admCharge ?? '0.5'),
          edli: String(selected.edli ?? '0.5'),
          adli_add: String(selected.adliAdd ?? '0'),
          esi_min: String(selected.esiMin ?? '4000'),
          esi_er: String(selected.esiEr ?? '4.75'),
        },
      });
      assertOk(save, 'save pf-esi-setup');
      if (save.data?.success === false) {
        throw new Error(save.data.message || 'PF/ESI save failed');
      }
    },
  },
  {
    id: 'payroll.update.payroll-config',
    module: 'payroll',
    op: 'U',
    name: 'Update payroll group setup',
    screen: 'payroll-config',
    mutation: true,
    async run(ctx) {
      await ctx.client.login();
      const load = await ctx.post('/api/payroll/setup/payroll-config/load', { fields: {} });
      assertOk(load, 'load payroll-config');
      const selected = load.data?.selected;
      if (!selected?.id) {
        throw new Error('No payroll group in database');
      }
      const save = await ctx.post('/api/payroll/setup/payroll-config/save', {
        fields: {
          Submit: 'Update',
          payroll_type: selected.id,
          payroll_title: String(selected.payrollType ?? ''),
          payroll_start: String(selected.payrollStart ?? ''),
          tds_limit: String(selected.tdsLimit ?? ''),
          basic_pay: String(selected.basicPay ?? '1'),
          basic_margin: String(selected.basicMargin ?? '1'),
          hra_allowance: String(selected.hraAllowance ?? '1'),
          d_allowance: String(selected.dAllowance ?? '1'),
          m_allowance: String(selected.mAllowance ?? '1'),
          c_allowance: String(selected.cAllowance ?? '1'),
          pf_percentage: String(selected.pfPercentage ?? ''),
          salary_limit: String(selected.salaryLimit ?? ''),
          minimum_late: String(selected.minimumLate ?? ''),
          minimum_permission: String(selected.minimumPermission ?? ''),
          yearly_leave: String(selected.yearlyLeave ?? ''),
          yearly_el: String(selected.yearlyEl ?? ''),
        },
      });
      assertOk(save, 'save payroll-config');
      if (save.data?.success === false) {
        throw new Error(save.data.message || 'Payroll group save failed');
      }
    },
  },
  {
    id: 'payroll.read.salary-add-search',
    module: 'payroll',
    op: 'R',
    name: 'Search staff on salary setup',
    screen: 'salary-add',
    async run(ctx) {
      await ctx.client.login();
      const initial = await ctx.post('/api/payroll/setup/salary-add/load', { fields: {} });
      assertOk(initial, 'load salary-add');
      if (!initial.data?.staffList?.length) {
        throw new Error('Expected initial staff list on salary setup');
      }
      const search = await ctx.post('/api/payroll/setup/salary-add/load', {
        fields: { search_by: 'name', search_input: '20' },
      });
      assertOk(search, 'search salary-add');
      if (!search.data?.staffList?.length) {
        throw new Error('Expected staff search results for salary setup');
      }
      const staffId = search.data.staffList[0].id;
      const load = await ctx.post('/api/payroll/setup/salary-add/load', { fields: { staff_id: staffId } });
      assertOk(load, 'load salary-add profile');
      if (!load.data?.profile?.id) {
        throw new Error('Expected staff profile after salary setup search');
      }
      if (!load.data?.policyFlags) {
        throw new Error('Expected payroll policy flags for salary setup');
      }
    },
  },
  {
    id: 'payroll.read.salary-advance-add',
    module: 'payroll',
    op: 'R',
    name: 'Load salary advance add form',
    screen: 'salary-advance-add',
    async run(ctx) {
      await ctx.client.login();
      const load = await ctx.post('/api/payroll/setup/salary-advance-add/load', { fields: {} });
      assertOk(load, 'load salary-advance-add');
      if (!load.data?.advanceNo?.startsWith('APAD')) {
        throw new Error('Expected APAD account number on salary advance add');
      }
      if (!load.data?.staffOptions?.length) {
        throw new Error('Expected staff options on salary advance add');
      }
      if (!load.data?.advanceTypes?.length) {
        throw new Error('Expected advance type options');
      }
      if (!load.data?.suretyOptions?.length) {
        throw new Error('Expected surety staff options');
      }
    },
  },
  {
    id: 'payroll.read.salary-arrear-add',
    module: 'payroll',
    op: 'R',
    name: 'Load salary arrear add form',
    screen: 'salary-arrear-add',
    async run(ctx) {
      await ctx.client.login();
      const load = await ctx.post('/api/payroll/setup/salary-arrear-add/load', { fields: {} });
      assertOk(load, 'load salary-arrear-add');
      if (!load.data?.arrearNo?.startsWith('APAR')) {
        throw new Error('Expected APAR account number on salary arrear add');
      }
      if (!load.data?.staffOptions?.length) {
        throw new Error('Expected staff options on salary arrear add');
      }
      if (!load.data?.arrearTypes?.length) {
        throw new Error('Expected arrear type options');
      }
    },
  },
  {
    id: 'payroll.read.salary-arrear-release',
    module: 'payroll',
    op: 'R',
    name: 'Load salary arrear release list',
    screen: 'salary-arrear-release',
    async run(ctx) {
      await ctx.client.login();
      const load = await ctx.post('/api/payroll/setup/salary-arrear-release/load', { fields: {} });
      assertOk(load, 'load salary-arrear-release');
      if (!Array.isArray(load.data?.arrears)) {
        throw new Error('Expected arrears list on salary arrear release');
      }
      if (load.data?.mode !== 'list') {
        throw new Error('Expected list mode on initial salary arrear release load');
      }
      const first = load.data.arrears[0];
      if (first?.id) {
        const edit = await ctx.post('/api/payroll/setup/salary-arrear-release/load', {
          fields: { edit_id: first.id },
        });
        assertOk(edit, 'load salary-arrear-release edit');
        if (edit.data?.mode !== 'edit') {
          throw new Error('Expected edit mode when loading arrear by id');
        }
        if (!edit.data?.selectedArrear?.receiptNo?.startsWith('APAR')) {
          throw new Error('Expected APAR receipt on arrear edit load');
        }
      }
    },
  },
  {
    id: 'payroll.read.salary-advance-close',
    module: 'payroll',
    op: 'R',
    name: 'Load salary advance close list',
    screen: 'salary-advance-close',
    async run(ctx) {
      await ctx.client.login();
      const load = await ctx.post('/api/payroll/setup/salary-advance-close/load', { fields: {} });
      assertOk(load, 'load salary-advance-close');
      if (!Array.isArray(load.data?.advances)) {
        throw new Error('Expected advances list on salary advance close');
      }
      if (load.data?.mode !== 'list') {
        throw new Error('Expected list mode on initial salary advance close load');
      }
    },
  },
  {
    id: 'payroll.read.security-deposit-add',
    module: 'payroll',
    op: 'R',
    name: 'Load security deposit add form',
    screen: 'security-deposit-add',
    async run(ctx) {
      await ctx.client.login();
      const load = await ctx.post('/api/payroll/setup/security-deposit-add/load', { fields: {} });
      assertOk(load, 'load security-deposit-add');
      if (!load.data?.depositNo?.startsWith('APSD')) {
        throw new Error('Expected APSD account number on security deposit add');
      }
      if (!load.data?.staffOptions?.length) {
        throw new Error('Expected staff options on security deposit add');
      }
      if (!load.data?.depositTypes?.length) {
        throw new Error('Expected deposit type option');
      }
    },
  },
  {
    id: 'payroll.read.security-deposit-close',
    module: 'payroll',
    op: 'R',
    name: 'Load security deposit close list',
    screen: 'security-deposit-close',
    async run(ctx) {
      await ctx.client.login();
      const load = await ctx.post('/api/payroll/setup/security-deposit-close/load', { fields: {} });
      assertOk(load, 'load security-deposit-close');
      if (!Array.isArray(load.data?.deposits)) {
        throw new Error('Expected deposits list on security deposit close');
      }
      if (load.data?.mode !== 'list') {
        throw new Error('Expected list mode on initial security deposit close load');
      }
    },
  },
];
