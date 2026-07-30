import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base/index.scss';
import './styles/tailwind.css';
import { initThemeFromStorage } from './theme/applyTheme.js';
import './styles/theme.css';
import './styles/cis.css';
import './styles/pages.css';
import './styles/att_card.css';
import './styles/dashboard.css';
import './styles/login.css';
import './styles/hub.css';
import './styles/list.css';
import './styles/datatable.css';
import './styles/form.css';
import './styles/student.css';
import './styles/staff.css';
import './styles/fees.css';
import './styles/theme-control.css';
import './styles/toast.css';
import './styles/command-palette.css';
import App from './App.jsx';

initThemeFromStorage();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
