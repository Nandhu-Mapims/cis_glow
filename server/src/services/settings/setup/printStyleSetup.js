import fs from 'fs/promises';
import path from 'path';
import { config } from '../../../config/index.js';
import { logSettingsSetup } from '../setupAudit.js';

const PAGE = 'print_style.php';
const STYLE_FILE = path.join(config.legacyCisPath, 'css/salary.css');

export async function loadPrintStyleSetup(memberId, _fields = {}, audit = {}) {
  let content = '';
  try {
    content = await fs.readFile(STYLE_FILE, 'utf8');
  } catch {
    content = '';
  }

  await logSettingsSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { content };
}

export async function savePrintStyleSetup(payload, memberId, audit = {}) {
  const content = String(payload.content ?? '');
  try {
    await fs.writeFile(STYLE_FILE, content, 'utf8');
    await logSettingsSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
    return {
      success: true,
      message: 'Your details are updated...',
      content,
    };
  } catch {
    await logSettingsSetup(PAGE, 'Update', 'Unsuccessful', '', memberId, audit);
    return { success: false, message: 'Unable to save style file' };
  }
}
