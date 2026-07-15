import { Fragment } from 'react';
import { createModuleHub } from '../../components/ModuleSetupFactory';

export const PortfolioHub = createModuleHub({
  title: 'Student Portfolio',
  basePath: '/portfolio',
  metaMap: {},
  dashboardPath: '/portfolio/dashboard',
  extraLinks: [
    {
      to: '/portfolio/individual-report',
      title: 'Portfolia Report',
      desc: 'Individual portfolio report',
      icon: 'fa fa-file-text-o',
      section: 'Reports',
    },
  ],
});

export default PortfolioHub;
