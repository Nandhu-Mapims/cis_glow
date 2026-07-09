import { createSetupApi } from '../../hooks/createSetupApi';
import { createModuleHub, createModuleSetupHub, createModuleSetupPage } from '../../components/ModuleSetupFactory';
import { KIOSK_SCREEN_META } from './kioskSetupMeta';
import {
  AnnouncementAddScreen,
  AnnouncementEditScreen,
  AttInstructionScreen,
  AttMenuAccessScreen,
  AttMenuScreen,
  AttStatementScreen,
  MachineAccessScreen,
  MachinePasswordScreen,
  MachineRoomAddScreen,
  MachineRoomEditScreen,
  MachineSliderScreen,
  PinResetScreen,
  ReceiptSetupScreen,
  SliderWidgetStyleScreen,
} from './setup/KioskScreens';

export const useKioskSetupApi = createSetupApi('/api/kiosk');

const COMPONENTS = {
  'machine-access': MachineAccessScreen,
  'machine-room-add': MachineRoomAddScreen,
  'machine-room-edit': MachineRoomEditScreen,
  'student-password': (props) => <MachinePasswordScreen {...props} type="student" />,
  'staff-password': (props) => <MachinePasswordScreen {...props} type="staff" />,
  'machine-slider': MachineSliderScreen,
  'slider-widget': SliderWidgetStyleScreen,
  'att-menu': AttMenuScreen,
  'att-menu-access': AttMenuAccessScreen,
  'att-instruction': AttInstructionScreen,
  'staff-pin-reset': (props) => <PinResetScreen {...props} type="staff" />,
  'student-pin-reset': (props) => <PinResetScreen {...props} type="student" />,
  'att-statement': AttStatementScreen,
  'announcement-add': AnnouncementAddScreen,
  'announcement-edit': AnnouncementEditScreen,
  'receipt-setup': ReceiptSetupScreen,
};

export const KioskSetupPage = createModuleSetupPage({
  moduleTitle: 'Kiosk',
  hubPath: '/kiosk/setup',
  metaMap: KIOSK_SCREEN_META,
  components: COMPONENTS,
  useSetupApi: useKioskSetupApi,
});

export const KioskHub = createModuleHub({ title: 'Kiosk', basePath: '/kiosk', metaMap: KIOSK_SCREEN_META });
export const KioskSetupHub = createModuleSetupHub({ title: 'Kiosk', basePath: '/kiosk', metaMap: KIOSK_SCREEN_META, parentPath: '/kiosk' });

export default KioskSetupPage;
