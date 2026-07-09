import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { initThemeFromStorage } from './theme/applyTheme.js';
import './styles/theme.css';
import './styles/cis.css';
import './styles/pages.css';
import './styles/att_card.css';
import './styles/dashboard.css';
import './styles/login.css';
import './styles/hub.css';
import './styles/list.css';
import './styles/student.css';
import './styles/fees.css';
import './styles/theme-control.css';
import App from './App.jsx';

initThemeFromStorage();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
