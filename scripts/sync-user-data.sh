#!/usr/bin/env bash
# Export the CURRENT data (not schema) for the "accounts + access/auth"
# table set from the LIVE database (server/.env's DATABASE_URL) into a SQL
# file, ready to import into the docker dev mariadb container so the dev
# environment logs in with real, current accounts/permissions.
#
# Tables covered:
#   web_account_setup              -- login accounts
#   access_tb                      -- login day/time/device restrictions
#   authentication_tb               -- per-user menu grants
#   dept_authentication             -- department/committee scoping (dept-auth, committee-access)
#   dept_auth                       -- department scoping, v1 (dept-auth-v1)
#   dashboard_access                -- per-user dashboard widget visibility
#   role_tb / role_menu_tb / user_role_tb -- Role Manager / Assign Roles
#   admin_staff_authentication_tb   -- staff self-service portal menu grants
#
# What this script does:
#   1. READS this data from the live DB only (mysqldump --no-create-info,
#      i.e. data rows only, no DDL) — never writes to the live DB.
#   2. Writes a single .sql file that first DELETEs existing rows in each of
#      these tables, then re-inserts the live rows — a full replace per
#      table, not a merge. Wrapped in a transaction.
#
# This does NOT touch the docker container by itself — pass the output
# through the existing import script:
#   scripts/sync-user-data.sh
#   scripts/import-db.sh user-data-sync-<timestamp>.sql --yes
#
# Usage:
#   scripts/sync-user-data.sh [output.sql]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="$REPO_ROOT/server/.env"
OUT_FILE="${1:-$REPO_ROOT/user-data-sync-$(date -u +%Y%m%d-%H%M%S).sql}"

TABLES=(
  web_account_setup
  access_tb
  authentication_tb
  dept_authentication
  dept_auth
  dashboard_access
  role_tb
  role_menu_tb
  user_role_tb
  admin_staff_authentication_tb
)

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — can't read DATABASE_URL." >&2
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

echo "Live DB: $DB_NAME @ $DB_HOST:$DB_PORT"
echo "Tables:  ${TABLES[*]}"
echo

echo "1/2  Verifying all tables exist on the live DB..."
DUMP_TABLES=()
MISSING=()
for t in "${TABLES[@]}"; do
  EXISTS="$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -N -B -e "
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='$DB_NAME' AND table_name='$t';
  ")"
  if [ "$EXISTS" = "0" ]; then
    MISSING+=("$t")
  else
    DUMP_TABLES+=("$t")
  fi
done
if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "Missing on live DB, skipping: ${MISSING[*]}" >&2
fi
if [ "${#DUMP_TABLES[@]}" -eq 0 ]; then
  echo "None of the requested tables exist on the live DB — nothing to export." >&2
  exit 1
fi

echo "2/2  Exporting data-only dump..."
{
  echo "-- User/access data sync from live DB"
  echo "-- Generated: $(date -u +%FT%TZ)"
  echo "-- Source:    $DB_NAME @ $DB_HOST:$DB_PORT"
  echo "-- Tables:    ${TABLES[*]}"
  echo "--"
  echo "-- Full replace per table (DELETE then re-INSERT from the live"
  echo "-- snapshot), not a merge. Import with:"
  echo "--   scripts/import-db.sh $(basename "$OUT_FILE") --yes"
  echo
  echo "SET FOREIGN_KEY_CHECKS=0;"
  echo "START TRANSACTION;"
  echo
  for t in "${DUMP_TABLES[@]}"; do
    echo "DELETE FROM \`$t\`;"
  done
  echo

  mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
    --no-create-info --complete-insert --skip-add-locks \
    --skip-comments --skip-set-charset --skip-triggers \
    --single-transaction \
    "$DB_NAME" "${DUMP_TABLES[@]}"

  echo
  echo "COMMIT;"
  echo "SET FOREIGN_KEY_CHECKS=1;"
} > "$OUT_FILE"

ROW_COUNT="$(grep -c '^INSERT INTO' "$OUT_FILE" || true)"
echo
echo "Data export written to: $OUT_FILE"
echo "($ROW_COUNT INSERT statement(s) — some tables may batch multiple rows per statement)"
echo
echo "Next step — import into the docker dev database:"
echo "  ./scripts/import-db.sh $(basename "$OUT_FILE") --yes"
