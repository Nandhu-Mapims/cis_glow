import app from './app.js';
import { config } from './config/index.js';
import { loadExamDashboard } from './services/exam/examDashboard.js';

app.listen(config.port, () => {
  console.log(`CIS server running on http://localhost:${config.port}`);
  loadExamDashboard('SYSTEM', { refresh: true }).catch(() => {});
});
