#!/usr/bin/env bash
# Compare the OLD baseline schema (a mysqldump snapshot, e.g. apdchedu_cisapp.sql)
# against the CURRENT live database's schema (read from server/.env's
# DATABASE_URL), and generate a single, production-ready SQL migration script
# capturing what changed since the baseline — new tables, new columns, new
# indexes.
#
# What this script touches:
#   - READS the live database's schema only (information_schema queries +
#     SHOW CREATE TABLE) — never writes to real tables or data.
#   - Loads the OLD baseline schema (DDL only, no data) into the SAME live
#     database as a set of temporary, uniquely-prefixed tables
#     (`bchk_<pid>_<original name>`), used only for comparison, then drops
#     every one of those prefixed tables again when done (even on error, via
#     trap). The app's DB user only has privileges on this one database (no
#     CREATE DATABASE), so a separate scratch database isn't an option —
#     prefixed tables inside the same DB is the alternative that stays
#     within those privileges while still never touching a real table.
#
# What the generated migration script contains:
#   - Safe, additive changes only: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF
#     NOT EXISTS, ADD INDEX/UNIQUE INDEX IF NOT EXISTS — all idempotent, so
#     it's safe to run more than once.
#   - A "REVIEW REQUIRED" section at the bottom listing anything dropped or
#     changed (removed tables/columns/indexes, column type/nullability
#     changes) as comments only — nothing destructive is ever auto-applied.
#     Hand-write and verify those statements yourself before running them.
#
# Usage:
#   scripts/generate-schema-migration.sh [old-dump.sql] [output.sql]
#
# Defaults: old-dump.sql = apdchedu_cisapp.sql (repo root)
#           output.sql   = schema-migration-<UTC timestamp>.sql (repo root)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="$REPO_ROOT/server/.env"
OLD_DUMP="${1:-$REPO_ROOT/apdchedu_cisapp.sql}"
OUT_FILE="${2:-$REPO_ROOT/schema-migration-$(date -u +%Y%m%d-%H%M%S).sql}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — can't read DATABASE_URL." >&2
  exit 1
fi
if [ ! -f "$OLD_DUMP" ]; then
  echo "Baseline dump not found: $OLD_DUMP" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "This script needs 'node' on PATH to parse DATABASE_URL safely." >&2
  exit 1
fi

DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/^DATABASE_URL="?(.*)"?$/\1/' | sed -E 's/"$//')"
if [ -z "$DB_URL" ]; then
  echo "DATABASE_URL not found in $ENV_FILE." >&2
  exit 1
fi

read -r DB_HOST DB_PORT DB_USER DB_PASS DB_NAME <<PARSED
$(node -e '
  const u = new URL(process.argv[1]);
  console.log([u.hostname, u.port || 3306, u.username, decodeURIComponent(u.password), u.pathname.slice(1)].join(" "));
' "$DB_URL")
PARSED

if [ -z "$DB_NAME" ]; then
  echo "Could not parse DATABASE_URL." >&2
  exit 1
fi

mysql_live() {
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$@"
}

PREFIX="bchk_$$_"
STRIPPED_SCHEMA="$(mktemp)"
PREFIXED_SCHEMA="$(mktemp)"

cleanup() {
  local tables
  tables="$(mysql_live -N -B -e "
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='$DB_NAME' AND table_name LIKE '${PREFIX}%';
  " 2>/dev/null || true)"
  if [ -n "$tables" ]; then
    while IFS= read -r t; do
      [ -z "$t" ] && continue
      mysql_live "$DB_NAME" -e "DROP TABLE IF EXISTS \`$t\`;" 2>/dev/null || true
    done <<< "$tables"
  fi
  rm -f "$STRIPPED_SCHEMA" "$PREFIXED_SCHEMA"
}
trap cleanup EXIT

echo "Live DB:  $DB_NAME @ $DB_HOST:$DB_PORT"
echo "Baseline: $OLD_DUMP"
echo

echo "1/4  Extracting schema-only DDL from the baseline dump (stripping data)..."
awk '
  /^LOCK TABLES/  { skip = 1 }
  /^UNLOCK TABLES;/ { skip = 0; next }
  skip { next }
  /^INSERT INTO/  { next }
  { print }
' "$OLD_DUMP" > "$STRIPPED_SCHEMA"

# Rewrite table names so the baseline schema loads as throwaway
# bchk_<pid>_<name> tables instead of colliding with the real live tables.
sed -E \
  -e "s/^DROP TABLE IF EXISTS \`([^\`]+)\`;/DROP TABLE IF EXISTS \`${PREFIX}\1\`;/" \
  -e "s/^CREATE TABLE \`([^\`]+)\` \(/CREATE TABLE \`${PREFIX}\1\` (/" \
  "$STRIPPED_SCHEMA" > "$PREFIXED_SCHEMA"

echo "2/4  Loading baseline schema as temporary '${PREFIX}*' tables..."
mysql_live "$DB_NAME" < "$PREFIXED_SCHEMA"

echo "3/4  Comparing schemas and generating migration..."
{
  echo "-- Auto-generated schema migration"
  echo "-- Generated: $(date -u +%FT%TZ)"
  echo "-- Baseline:  $OLD_DUMP"
  echo "-- Live DB:   $DB_NAME @ $DB_HOST:$DB_PORT"
  echo "--"
  echo "-- Everything above the REVIEW REQUIRED marker is additive-only"
  echo "-- (CREATE TABLE / ADD COLUMN / ADD INDEX, all IF NOT EXISTS) and safe"
  echo "-- to run against production as-is. Everything below it is a comment-only"
  echo "-- report of removed/changed items -- nothing there is auto-applied;"
  echo "-- review and hand-write those statements before running them."
  echo
  echo "USE \`$DB_NAME\`;"
  echo

  echo "-- ==== New tables ===="
  NEW_TABLES="$(mysql_live -N -B -e "
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='$DB_NAME' AND table_name NOT LIKE '${PREFIX}%'
      AND CONCAT('$PREFIX', table_name) NOT IN (
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='$DB_NAME' AND table_name LIKE '${PREFIX}%'
      );
  ")"
  if [ -n "$NEW_TABLES" ]; then
    while IFS= read -r t; do
      [ -z "$t" ] && continue
      echo "-- New table: $t"
      # -B (batch) mode escapes embedded newlines/tabs in SHOW CREATE TABLE's
      # multi-line field as literal \n/\t -- unescape them back to real
      # whitespace before writing the DDL out.
      mysql_live -N -B -e "SHOW CREATE TABLE \`$DB_NAME\`.\`$t\`;" \
        | cut -f2 \
        | sed 's/\\n/\n/g; s/\\t/\t/g' \
        | sed '1s/^CREATE TABLE/CREATE TABLE IF NOT EXISTS/'
      echo ";"
      echo
    done <<< "$NEW_TABLES"
  fi

  echo "-- ==== New columns on existing tables ===="
  mysql_live -N -B -e "
    SELECT n.table_name, n.column_name, n.column_type,
           IF(n.is_nullable='YES','NULL','NOT NULL'),
           IF(n.column_default IS NULL,'', CONCAT(' DEFAULT ', QUOTE(n.column_default))),
           IF(n.extra<>'', CONCAT(' ', n.extra), '')
    FROM information_schema.columns n
    LEFT JOIN information_schema.columns o
      ON o.table_schema='$DB_NAME' AND o.table_name=CONCAT('$PREFIX', n.table_name) AND o.column_name=n.column_name
    WHERE n.table_schema='$DB_NAME' AND n.table_name NOT LIKE '${PREFIX}%'
      AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='$DB_NAME' AND table_name=CONCAT('$PREFIX', n.table_name)
      )
      AND o.column_name IS NULL
    ORDER BY n.table_name, n.ordinal_position;
  " | while IFS=$'\t' read -r tbl col coltype nullable dflt extra; do
    [ -z "$tbl" ] && continue
    echo "ALTER TABLE \`$tbl\` ADD COLUMN IF NOT EXISTS \`$col\` $coltype $nullable$dflt$extra;"
  done
  echo

  echo "-- ==== New indexes on existing tables ===="
  mysql_live -N -B -e "
    SELECT s.table_name, s.index_name, MIN(s.non_unique),
      GROUP_CONCAT(
        CASE WHEN s.sub_part IS NOT NULL
          THEN CONCAT('\`', s.column_name, '\`(', s.sub_part, ')')
          ELSE CONCAT('\`', s.column_name, '\`')
        END ORDER BY s.seq_in_index SEPARATOR ','
      )
    FROM information_schema.statistics s
    WHERE s.table_schema='$DB_NAME' AND s.table_name NOT LIKE '${PREFIX}%' AND s.index_name<>'PRIMARY'
      AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='$DB_NAME' AND table_name=CONCAT('$PREFIX', s.table_name)
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.statistics b
        WHERE b.table_schema='$DB_NAME' AND b.table_name=CONCAT('$PREFIX', s.table_name) AND b.index_name=s.index_name
      )
    GROUP BY s.table_name, s.index_name;
  " | while IFS=$'\t' read -r tbl idx nonuniq cols; do
    [ -z "$tbl" ] && continue
    if [ "$nonuniq" = "0" ]; then
      echo "ALTER TABLE \`$tbl\` ADD UNIQUE INDEX IF NOT EXISTS \`$idx\` ($cols);"
    else
      echo "ALTER TABLE \`$tbl\` ADD INDEX IF NOT EXISTS \`$idx\` ($cols);"
    fi
  done
  echo

  echo "-- ============================================================"
  echo "-- REVIEW REQUIRED -- comments only, nothing below is auto-applied."
  echo "-- ============================================================"
  echo

  echo "-- Tables in the baseline but missing from the live DB (dropped, or renamed?):"
  mysql_live -N -B -e "
    SELECT SUBSTRING(table_name, LENGTH('$PREFIX')+1) FROM information_schema.tables
    WHERE table_schema='$DB_NAME' AND table_name LIKE '${PREFIX}%'
      AND SUBSTRING(table_name, LENGTH('$PREFIX')+1) NOT IN (
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='$DB_NAME' AND table_name NOT LIKE '${PREFIX}%'
      );
  " | while IFS= read -r t; do
    [ -z "$t" ] && continue
    echo "--   $t"
  done
  echo

  echo "-- Columns removed since the baseline:"
  mysql_live -N -B -e "
    SELECT SUBSTRING(o.table_name, LENGTH('$PREFIX')+1), o.column_name
    FROM information_schema.columns o
    LEFT JOIN information_schema.columns n
      ON n.table_schema='$DB_NAME' AND n.table_name=SUBSTRING(o.table_name, LENGTH('$PREFIX')+1) AND n.column_name=o.column_name
    WHERE o.table_schema='$DB_NAME' AND o.table_name LIKE '${PREFIX}%'
      AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='$DB_NAME' AND table_name=SUBSTRING(o.table_name, LENGTH('$PREFIX')+1)
      )
      AND n.column_name IS NULL;
  " | while IFS=$'\t' read -r tbl col; do
    [ -z "$tbl" ] && continue
    echo "--   $tbl.$col"
  done
  echo

  echo "-- Columns whose type/nullability changed since the baseline:"
  mysql_live -N -B -e "
    SELECT n.table_name, n.column_name, o.column_type, n.column_type, o.is_nullable, n.is_nullable
    FROM information_schema.columns n
    JOIN information_schema.columns o
      ON o.table_schema='$DB_NAME' AND o.table_name=CONCAT('$PREFIX', n.table_name) AND o.column_name=n.column_name
    WHERE n.table_schema='$DB_NAME' AND n.table_name NOT LIKE '${PREFIX}%'
      AND (n.column_type<>o.column_type OR n.is_nullable<>o.is_nullable);
  " | while IFS=$'\t' read -r tbl col oldtype newtype oldnull newnull; do
    [ -z "$tbl" ] && continue
    echo "--   $tbl.$col: was [$oldtype $oldnull] -> now [$newtype $newnull]"
  done
  echo

  echo "-- Indexes removed since the baseline:"
  mysql_live -N -B -e "
    SELECT SUBSTRING(b.table_name, LENGTH('$PREFIX')+1), b.index_name
    FROM information_schema.statistics b
    WHERE b.table_schema='$DB_NAME' AND b.table_name LIKE '${PREFIX}%' AND b.index_name<>'PRIMARY'
      AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='$DB_NAME' AND table_name=SUBSTRING(b.table_name, LENGTH('$PREFIX')+1)
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.statistics s
        WHERE s.table_schema='$DB_NAME' AND s.table_name=SUBSTRING(b.table_name, LENGTH('$PREFIX')+1) AND s.index_name=b.index_name
      )
    GROUP BY b.table_name, b.index_name;
  " | while IFS=$'\t' read -r tbl idx; do
    [ -z "$tbl" ] && continue
    echo "--   $tbl.$idx"
  done

} > "$OUT_FILE"

echo "4/4  Done."
echo
echo "Migration script written to: $OUT_FILE"
echo "Temporary '${PREFIX}*' tables will be dropped automatically on exit."
