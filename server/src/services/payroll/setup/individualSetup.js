import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../../config/prisma.js';
import { config } from '../../../config/index.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';

const PAGE = 'payroll_individual_setup.php';

export async function loadIndividualSetup(memberId, audit = {}) {
  const rows = await prisma.payroll_cover_page.findMany({
    where: { del: 1 },
    orderBy: { id: 'asc' },
  });
  await logPayrollSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    rows: rows.map((row) => ({
      id: row.id,
      bannerName: row.banner_name,
      bannerImage: row.banner_image,
      imageUrl: row.banner_image
        ? `/legacy/img/global_images/${encodeURIComponent(row.banner_image)}`
        : null,
    })),
  };
}

export async function saveIndividualSetup(fields, memberId, files = [], audit = {}) {
  const { update } = auditFields(memberId, audit);
  let saved = false;

  const idList = Array.isArray(fields.id) ? fields.id : [fields.id];
  const hdList = Array.isArray(fields.hd_banner_image) ? fields.hd_banner_image : [fields.hd_banner_image];

  for (let i = 0; i < idList.length; i++) {
    const id = Number(idList[i]);
    if (!id) continue;

    let bannerImage = hdList[i] || '';
    const fileEntry = files.find((f) => f.field === `banner_image[${i}]` || f.field === 'banner_image');
    if (fileEntry?.data) {
      const ext = path.extname(fileEntry.filename || '.png').toLowerCase();
      if (['.jpeg', '.jpg', '.png', '.gif'].includes(ext)) {
        const destDir = path.join(config.legacyImgPath, 'global_images');
        await fs.mkdir(destDir, { recursive: true });
        const newName = `${Date.now()}${Math.floor(Math.random() * 10000)}${fileEntry.filename || 'banner.png'}`;
        await fs.writeFile(path.join(destDir, newName), Buffer.from(fileEntry.data, 'base64'));
        bannerImage = newName;
      }
    }

    await prisma.payroll_cover_page.update({
      where: { id },
      data: {
        banner_image: bannerImage,
        ...update,
      },
    });
    saved = true;
  }

  if (saved) {
    await logPayrollSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
    return {
      success: true,
      message: 'Your details are updated...',
      ...(await loadIndividualSetup(memberId, { ...audit, skipLog: true })),
    };
  }

  return { success: false, message: 'Please try again...' };
}
