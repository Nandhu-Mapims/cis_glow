import { createSetupApi } from '../../hooks/createSetupApi';
import { createModuleHub, createModuleSetupHub, createModuleSetupPage } from '../../components/ModuleSetupFactory';
import { SMS_HUB_LINKS, SMS_SCREEN_META } from './smsSetupMeta';
import SmsSendScreen from './setup/SmsSendScreen';
import ParentMeetingSmsScreen from './setup/ParentMeetingSmsScreen';
import SmsHistoryScreen from './setup/SmsHistoryScreen';
import SmsTemplateAddScreen from './setup/SmsTemplateAddScreen';
import SmsTemplateEditScreen from './setup/SmsTemplateEditScreen';
import SmsGroupAddScreen from './setup/SmsGroupAddScreen';
import SmsGroupEditScreen from './setup/SmsGroupEditScreen';

export const useSmsSetupApi = createSetupApi('/api/sms');

const COMPONENTS = {
  'student-sms': (props) => (
    <SmsSendScreen {...props} groupKey="selectedCourses" groupLabel="Class / batch" studentMode />
  ),
  'staff-sms': (props) => (
    <SmsSendScreen
      {...props}
      groupKey="selectedGroups"
      groupLabel="Category"
      groupMode
      showRecipientNames
      stepSelectLabel="Select categories"
      searchPlaceholder="Search categories…"
      emptyHint="Select staff categories on the left, then click Load recipients."
    />
  ),
  'group-sms': (props) => (
    <SmsSendScreen
      {...props}
      groupKey="selectedGroups"
      groupLabel="SMS groups"
      groupMode
      stepSelectLabel="Select groups"
      searchPlaceholder="Search groups…"
      emptyHint="Select SMS groups on the left, then click Load recipients."
    />
  ),
  'parent-meeting-sms': ParentMeetingSmsScreen,
  'sms-history': SmsHistoryScreen,
  'sms-template-add': SmsTemplateAddScreen,
  'sms-template-edit': SmsTemplateEditScreen,
  'group-add': SmsGroupAddScreen,
  'group-edit': SmsGroupEditScreen,
};

export const SmsSetupPage = createModuleSetupPage({
  moduleTitle: 'SMS',
  hubPath: '/sms/setup',
  metaMap: SMS_SCREEN_META,
  components: COMPONENTS,
  useSetupApi: useSmsSetupApi,
});

export default SmsSetupPage;

export const SmsHub = createModuleHub({
  title: 'SMS',
  basePath: '/sms',
  metaMap: {},
  extraLinks: SMS_HUB_LINKS,
});

export const SmsSetupHub = createModuleSetupHub({
  title: 'SMS',
  basePath: '/sms',
  metaMap: SMS_SCREEN_META,
  parentPath: '/sms',
  extraLinks: [{
    to: '/settings/setup/sms-cron',
    title: 'SMS Cron',
    desc: 'Scheduled SMS jobs',
    icon: 'fa fa-clock-o',
    section: 'Settings',
  }],
});
