import app from './app.js';
import { config } from './config/index.js';
import { prisma } from './config/prisma.js';
import { loadExamDashboard } from './services/exam/examDashboard.js';

const server = app.listen(config.port, () => {
  console.log(`CIS server running on http://localhost:${config.port}`);
  loadExamDashboard('SYSTEM', { refresh: true }).catch(() => {});
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: closing server, draining in-flight requests...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async (err) => {
    if (err) console.error('Error while closing HTTP server:', err);
    try {
      await prisma.$disconnect();
    } catch (disconnectErr) {
      console.error('Error while disconnecting Prisma:', disconnectErr);
    }
    clearTimeout(forceExitTimer);
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
