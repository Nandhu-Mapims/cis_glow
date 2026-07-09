import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run a legacy-bridge PHP script with JSON stdin.
 */
export function runLegacyBridge(scriptName, payload) {
  const scriptPath = path.resolve(__dirname, '../../../legacy-bridge', scriptName);

  return new Promise((resolve, reject) => {
    const env = { ...process.env, LEGACY_CIS_PATH: config.legacyCisPath };
    const child = spawn('php', [scriptPath], { env });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `PHP bridge ${scriptName} exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
