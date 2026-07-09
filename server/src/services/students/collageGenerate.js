import { prisma } from '../../config/prisma.js';
import { runLegacyBridge } from '../legacy/phpBridge.js';

export const COLLAGE_GENERATE_DEFAULTS = {
  row_count: '6',
  column_count: '6',
  photo_margin: '5',
  search_by_a_no: '',
  photo_width: '250',
  photo_height: '240',
  photo_bgcolor: 'FFFFFF',
  name_enable: '1',
  name_size: '14',
  name_height: '25',
  name_color: '333333',
  merge_a_no: '',
  merge_box: '',
  m_width: '510',
  m_height: '500',
  m_bgcolor: 'FF9233',
  m_name_enable: '1',
  m_name_size: '25',
  m_name_height: '30',
  m_name_color: '333333',
  template_id: '',
  m_template_id: '',
};

export async function loadCollageTemplates() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, image_title, image_filename
     FROM colage_image_tb WHERE del=1 ORDER BY id ASC`,
  );
  return rows.map((row) => ({
    value: String(row.id),
    label: row.image_title || row.image_filename || `Template ${row.id}`,
    url: row.image_filename ? `/legacy/files/cage/cimg/${row.image_filename}` : null,
  }));
}

export async function generateCollageImage(memberId, fields) {
  const raw = await runLegacyBridge('colage_generate_bridge.php', {
    memberId,
    fields: { ...fields, Search: 'Search' },
  });
  const result = JSON.parse(raw);
  if (result.error) {
    return { error: result.error };
  }
  return {
    outputUrl: `${result.outputUrl}?v=${Date.now()}`,
    filename: result.filename,
  };
}
