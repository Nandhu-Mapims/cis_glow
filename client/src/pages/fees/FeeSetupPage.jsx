import { Link, useOutletContext, useParams } from 'react-router-dom';
import FeeBankSetup from './setup/FeeBankSetup';
import FeeFineSetup from './setup/FeeFineSetup';
import FeeLabelSetup from './setup/FeeLabelSetup';
import FeeNameSetup from './setup/FeeNameSetup';
import FeeTypeSetup from './setup/FeeTypeSetup';
import FeeScholarshipSetup from './setup/FeeScholarshipSetup';
import FeeDmeSetup from './setup/FeeDmeSetup';
import FeeAcmecScholarshipSetup from './setup/FeeAcmecScholarshipSetup';
import { FEE_SETUP_BREADCRUMB, FEE_SETUP_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeHomeBreadcrumbs } from './FeePageShell';
import './FeeSetupPage.css';

const SETUP_COMPONENTS = {
  label: FeeLabelSetup,
  type: FeeTypeSetup,
  bank: FeeBankSetup,
  fine: FeeFineSetup,
  name: FeeNameSetup,
  scholarship: FeeScholarshipSetup,
  'dme-approve': FeeDmeSetup,
  'acmec-scholarship': FeeAcmecScholarshipSetup,
};

export default function FeeSetupPage() {
  const { screen } = useParams();
  const meta = FEE_SETUP_SCREEN_META[screen];
  const SetupComponent = SETUP_COMPONENTS[screen];

  const { settings, menu } = useOutletContext();

  if (!meta) {
    return (
      <div className="p-4">
        <p className="text-danger">Unknown fee setup screen.</p>
        <Link to="/fees/setup">Back to setup hub</Link>
      </div>
    );
  }

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
      dashboardTitle={meta.title}
      breadcrumbs={feeHomeBreadcrumbs(FEE_SETUP_BREADCRUMB, { label: meta.title })}
      title={meta.title}
      legacy={meta.legacy}
      actions={feeBackAction('/fees/setup')}
    >
      <div className="card shadow-sm cis-setup-card fee-setup-card">
        <div className="card-body cis-setup-root fee-setup-root">
          {SetupComponent ? <SetupComponent /> : <p className="text-muted mb-0">Form not available.</p>}
        </div>
      </div>
    </FeePageShell>
  );
}
