import { createSetupApi } from '../../hooks/createSetupApi';
import { createModuleHub, createModuleSetupHub, createModuleSetupPage } from '../../components/ModuleSetupFactory';
import { CERTIFICATE_SCREEN_META } from './certificateSetupMeta';
import {
  ApproveScreen,
  CertRequestScreen,
  CertificateSetupScreen,
  GenerateScreen,
  ImplantCertScreen,
  InternshipGenerateScreen,
  InternshipPhotoScreen,
  InternshipScheduleScreen,
  LaserCertScreen,
  ReceiptAddScreen,
  ReceiptEditScreen,
  ReceiptReportScreen,
  TcDetailsScreen,
  TcGenerateScreen,
  TcRequestAddScreen,
  TcRequestEditScreen,
} from './setup/CertificateScreens';

export const useCertificateSetupApi = createSetupApi('/api/certificates');

const COMPONENTS = {
  setup: CertificateSetupScreen,
  approve: ApproveScreen,
  generate: GenerateScreen,
  'receipt-add': ReceiptAddScreen,
  'receipt-edit': ReceiptEditScreen,
  'receipt-report': ReceiptReportScreen,
  'cert-request': CertRequestScreen,
  'tc-details': TcDetailsScreen,
  'tc-request-add': TcRequestAddScreen,
  'tc-request-edit': TcRequestEditScreen,
  'tc-generate': TcGenerateScreen,
  'internship-schedule': InternshipScheduleScreen,
  'internship-generate': InternshipGenerateScreen,
  'internship-photo': InternshipPhotoScreen,
  'implant-cert': ImplantCertScreen,
  'laser-cert': LaserCertScreen,
};

export const CertificateSetupPage = createModuleSetupPage({
  moduleTitle: 'Certificates',
  hubPath: '/certificates/setup',
  metaMap: CERTIFICATE_SCREEN_META,
  components: COMPONENTS,
  useSetupApi: useCertificateSetupApi,
});

export const CertificateHub = createModuleHub({ title: 'Certificates', basePath: '/certificates', metaMap: CERTIFICATE_SCREEN_META });
export const CertificateSetupHub = createModuleSetupHub({ title: 'Certificates', basePath: '/certificates', metaMap: CERTIFICATE_SCREEN_META, parentPath: '/certificates' });

export default CertificateSetupPage;
