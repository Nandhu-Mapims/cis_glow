import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import menuRoutes from './routes/menu.js';
import studentRoutes from './routes/students.js';
import staffRoutes from './routes/staff.js';
import attendanceRoutes from './routes/attendance.js';
import feesRoutes from './routes/fees.js';
import academicRoutes from './routes/academic.js';
import examRoutes from './routes/exam.js';
import adminRoutes from './routes/admin.js';
import filesRoutes from './routes/files.js';
import payrollRoutes from './routes/payroll.js';
import smsRoutes from './routes/sms.js';
import webRoutes from './routes/web.js';
import tvRoutes from './routes/tv.js';
import kioskRoutes from './routes/kiosk.js';
import committeeRoutes from './routes/committee.js';
import certificateRoutes from './routes/certificate.js';
import naacRoutes from './routes/naac.js';
import portfolioRoutes from './routes/portfolio.js';
import elearningRoutes from './routes/elearning.js';
import libraryRoutes from './routes/library.js';
import hostelRoutes from './routes/hostel.js';
import circularRoutes from './routes/circular.js';
import adminOfficeRoutes from './routes/adminOffice.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust exactly one reverse-proxy hop (nginx/load balancer) - req.ip reflects
// X-Forwarded-For only from that hop, so a client can't spoof it directly.
app.set('trust proxy', 1);

// CSP disabled: many screens render legacy-parity HTML (dashboard widgets, print
// reports) via dangerouslySetInnerHTML with inline onclick handlers/styles - a
// default CSP would silently break that behavior. Other protective headers stay on.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());

app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedClientOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

app.use('/legacy', express.static(path.resolve(config.legacyImgPath, '..')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cis-server' });
});

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/web', webRoutes);
app.use('/api/tv', tvRoutes);
app.use('/api/kiosk', kioskRoutes);
app.use('/api/committee', committeeRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/naac', naacRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/elearning', elearningRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/circular', circularRoutes);
app.use('/api/admin-office', adminOfficeRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request too large. Try a shorter date range or fewer subjects.' });
  }
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
