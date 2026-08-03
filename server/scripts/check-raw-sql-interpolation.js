#!/usr/bin/env node
// Guards against new unescaped SQL injection sinks landing in $queryRawUnsafe /
// $executeRawUnsafe template literals (VAPT Finding 5 — see docs/vapt-report-*.md).
//
// This is a heuristic, not a prover: it flags any `${...}` interpolation inside a raw
// SQL call whose expression references req/fields/params/query/body/payload directly,
// since that's the shape an unescaped user-controlled value takes. It does NOT
// understand data flow, so a value that was safely escaped a few lines earlier via a
// locally-shadowed object (a common, correct pattern in this codebase — see
// studentHostelSetup.js) still matches and has to be triaged by a human once.
//
// Usage:
//   node scripts/check-raw-sql-interpolation.js            # fail on any NEW finding
//   node scripts/check-raw-sql-interpolation.js --update    # accept current findings into the baseline
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', 'src');
const BASELINE_PATH = path.join(__dirname, 'raw-sql-interpolation-baseline.json');

// Matches `${req.foo}`, `${fields.bar.baz}`, `${payload.x}` etc — a request-shaped
// value interpolated directly, with no escapeSql()/Number()/parseId()/Boolean()
// wrapper on that same expression.
const RISKY_PATTERN = /\$\{(req|fields|params|query|body|payload)\.[a-zA-Z0-9_.]+\}/g;
const SAFE_WRAPPERS = /\b(escapeSql|escapeHtml|Number|parseId|parseOptionalId|Boolean|Math\.|Date\.|String\()/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function findRiskyLines(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('RawUnsafe(')) return [];
  const lines = text.split('\n');
  const hits = [];
  lines.forEach((line, idx) => {
    if (!RISKY_PATTERN.test(line)) {
      RISKY_PATTERN.lastIndex = 0;
      return;
    }
    RISKY_PATTERN.lastIndex = 0;
    if (SAFE_WRAPPERS.test(line)) return; // heuristic: likely pre-escaped on this line
    hits.push({ file: path.relative(process.cwd(), file), line: idx + 1, text: line.trim() });
  });
  return hits;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  const list = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  return new Set(list.map((h) => `${h.file}:${h.line}`));
}

function main() {
  const update = process.argv.includes('--update');
  const files = walk(SRC_DIR);
  const findings = files.flatMap(findRiskyLines);

  if (update) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(findings, null, 2) + '\n');
    console.log(`Baseline updated: ${findings.length} findings accepted at ${BASELINE_PATH}`);
    return;
  }

  const baseline = loadBaseline();
  const newFindings = findings.filter((h) => !baseline.has(`${h.file}:${h.line}`));

  if (!newFindings.length) {
    console.log(`OK — no new raw-SQL interpolation findings (${findings.length} baseline entries, all pre-existing).`);
    return;
  }

  console.error(`Found ${newFindings.length} new request-value interpolation(s) in raw SQL — verify each is wrapped in escapeSql()/Number()/parseId() before merging:\n`);
  for (const hit of newFindings) {
    console.error(`  ${hit.file}:${hit.line}\n    ${hit.text}\n`);
  }
  console.error('If reviewed and confirmed safe (e.g. already escaped via a shadowed variable), run:');
  console.error('  npm run check:sql -- --update');
  process.exitCode = 1;
}

main();
