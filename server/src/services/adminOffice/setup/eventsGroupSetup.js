import { logAdminOfficeSetup } from '../setupAudit.js';

const PAGE = 'events_group_add.php';

const GROUP_CATEGORIES = [
  { value: '1', label: 'Academic' },
  { value: '2', label: 'Sports' },
  { value: '3', label: 'Fine Arts' },
  { value: '4', label: 'Association' },
  { value: '5', label: 'Others' },
];

export async function loadEventsGroupSetup(memberId, _fields = {}, audit = {}) {
  await logAdminOfficeSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    readOnly: true,
    notice: 'Event group setup is not fully implemented in the legacy PHP screen. Use Committee module screens for committee-based events when available.',
    categoryOptions: GROUP_CATEGORIES,
    form: {
      groupTitle: '',
      groupCat: '1',
      masterList: '',
      webView: false,
      rows: [{ name: '', rollNo: '', fromDate: '', toDate: '' }],
    },
  };
}

export async function saveEventsGroupSetup(_payload, memberId, audit = {}) {
  await logAdminOfficeSetup(PAGE, 'Save', 'Unsuccessful', 'not implemented', memberId, audit);
  return {
    success: false,
    message: 'Event group save is not available in this build. Legacy events_group_add.php had no database save logic.',
  };
}
