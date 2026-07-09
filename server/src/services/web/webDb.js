import { prisma } from '../../config/prisma.js';

let pagesReady = false;
let photosReady = false;
let researchReady = false;
let eventsReady = false;

export async function ensureWebPagesTable() {
  if (pagesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS web_pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page_type VARCHAR(50) NOT NULL,
      page_title VARCHAR(255) NOT NULL DEFAULT '',
      page_order INT NOT NULL DEFAULT 0,
      page_link VARCHAR(255) NOT NULL DEFAULT '',
      page_content LONGTEXT,
      post_now DATE NULL,
      page_enable INT NOT NULL DEFAULT 1,
      created_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_ip VARCHAR(15) NOT NULL DEFAULT '',
      created_by VARCHAR(70) NOT NULL DEFAULT '',
      updated_dt TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
      updated_ip VARCHAR(15) NOT NULL DEFAULT '',
      updated_by VARCHAR(70) NOT NULL DEFAULT '',
      del INT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  pagesReady = true;
}

export async function ensureWebPhotosTables() {
  if (photosReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS web_photos_gallery (
      id INT AUTO_INCREMENT PRIMARY KEY,
      n_date DATE NULL,
      title VARCHAR(500) NOT NULL DEFAULT '',
      description LONGTEXT,
      attachment VARCHAR(500) NOT NULL DEFAULT '',
      web_view INT NOT NULL DEFAULT 1,
      created_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_ip VARCHAR(15) NOT NULL DEFAULT '',
      created_by VARCHAR(70) NOT NULL DEFAULT '',
      updated_dt TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
      updated_ip VARCHAR(15) NOT NULL DEFAULT '',
      updated_by VARCHAR(70) NOT NULL DEFAULT '',
      del INT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS web_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      photos_from VARCHAR(50) NOT NULL DEFAULT 'gallery',
      ref_id INT NOT NULL DEFAULT 0,
      title VARCHAR(500) NOT NULL DEFAULT '',
      p_date DATE NULL,
      photo_order INT NOT NULL DEFAULT 0,
      attachment VARCHAR(500) NOT NULL DEFAULT '',
      c_attachment VARCHAR(500) NOT NULL DEFAULT '',
      created_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_ip VARCHAR(15) NOT NULL DEFAULT '',
      created_by VARCHAR(70) NOT NULL DEFAULT '',
      updated_dt TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
      updated_ip VARCHAR(15) NOT NULL DEFAULT '',
      updated_by VARCHAR(70) NOT NULL DEFAULT '',
      del INT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  photosReady = true;
}

export async function ensureResearchTables() {
  if (researchReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS research_program (
      id INT AUTO_INCREMENT PRIMARY KEY,
      research_data VARCHAR(500) NOT NULL DEFAULT '',
      registration_close DATE NULL,
      from_date DATE NULL,
      description LONGTEXT,
      attachment VARCHAR(500) NOT NULL DEFAULT '',
      venue VARCHAR(500) NOT NULL DEFAULT '',
      web_view INT NOT NULL DEFAULT 1,
      prog_time VARCHAR(255) NOT NULL DEFAULT '',
      research_topic VARCHAR(500) NOT NULL DEFAULT '',
      presenter_dr_name VARCHAR(255) NOT NULL DEFAULT '',
      presenter_dr_desig VARCHAR(255) NOT NULL DEFAULT '',
      presenter_dr_dept VARCHAR(255) NOT NULL DEFAULT '',
      presenter_dr_college VARCHAR(255) NOT NULL DEFAULT '',
      presenter_dr_city VARCHAR(255) NOT NULL DEFAULT '',
      target_link VARCHAR(500) NOT NULL DEFAULT '',
      region VARCHAR(255) NOT NULL DEFAULT '',
      member_view INT NOT NULL DEFAULT 0,
      event_status VARCHAR(50) NOT NULL DEFAULT '',
      event_types VARCHAR(500) NOT NULL DEFAULT '',
      created_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_ip VARCHAR(15) NOT NULL DEFAULT '',
      created_by VARCHAR(70) NOT NULL DEFAULT '',
      updated_dt TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
      updated_ip VARCHAR(15) NOT NULL DEFAULT '',
      updated_by VARCHAR(70) NOT NULL DEFAULT '',
      del INT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS research_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ref_id INT NOT NULL DEFAULT 0,
      photo_order INT NOT NULL DEFAULT 0,
      attachment VARCHAR(500) NOT NULL DEFAULT '',
      created_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_ip VARCHAR(15) NOT NULL DEFAULT '',
      created_by VARCHAR(70) NOT NULL DEFAULT '',
      updated_dt TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
      updated_ip VARCHAR(15) NOT NULL DEFAULT '',
      updated_by VARCHAR(70) NOT NULL DEFAULT '',
      del INT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  researchReady = true;
}

export async function ensureWebEventsTables() {
  if (eventsReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS web_event_type (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL DEFAULT '',
      created_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_ip VARCHAR(15) NOT NULL DEFAULT '',
      created_by VARCHAR(70) NOT NULL DEFAULT '',
      updated_dt TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
      updated_ip VARCHAR(15) NOT NULL DEFAULT '',
      updated_by VARCHAR(70) NOT NULL DEFAULT '',
      del INT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS web_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(500) NOT NULL DEFAULT '',
      title VARCHAR(500) NOT NULL DEFAULT '',
      from_date DATETIME NULL,
      to_date DATETIME NULL,
      description LONGTEXT,
      attachment VARCHAR(500) NOT NULL DEFAULT '',
      venue VARCHAR(500) NOT NULL DEFAULT '',
      tags VARCHAR(500) NOT NULL DEFAULT '',
      web_view INT NOT NULL DEFAULT 1,
      event_status INT NOT NULL DEFAULT 1,
      created_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_ip VARCHAR(15) NOT NULL DEFAULT '',
      created_by VARCHAR(70) NOT NULL DEFAULT '',
      updated_dt TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00',
      updated_ip VARCHAR(15) NOT NULL DEFAULT '',
      updated_by VARCHAR(70) NOT NULL DEFAULT '',
      del INT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  eventsReady = true;
}

export async function listWebEventTypes() {
  await ensureWebEventsTables();
  return prisma.$queryRawUnsafe(`
    SELECT id, title FROM web_event_type WHERE del = 1 ORDER BY title ASC
  `);
}

export async function listWebPages(pageType) {
  await ensureWebPagesTable();
  return prisma.$queryRaw`
    SELECT id, page_type, page_title, page_order, page_link, page_content, post_now, page_enable
    FROM web_pages
    WHERE del = 1 AND page_type = ${pageType}
    ORDER BY page_order ASC, id ASC
  `;
}

export async function getWebPage(id) {
  await ensureWebPagesTable();
  const rows = await prisma.$queryRaw`
    SELECT id, page_type, page_title, page_order, page_link, page_content, post_now, page_enable
    FROM web_pages WHERE del = 1 AND id = ${Number(id)} LIMIT 1
  `;
  return rows[0] || null;
}
