#!/usr/bin/env bash
# Safe MariaDB import for the Hostinger VPS deployment (194.238.22.210).
#
# What it does, in order:
#   1. Refuses to import a truncated/incomplete dump (checks for mysqldump's
#      standard end-of-file trailer before touching anything).
#   2. Backs up the CURRENT database first (gzip'd, timestamped).
#   3. Imports the new file.
#   4. If the import fails partway, automatically restores the step-2 backup
#      so the database is never left in a half-old/half-new broken state.
#   5. Re-applies ALL_USER.json (CISADMIN/Adminmd/staff accounts + menu
#      access) — a full-DB import replaces web_account_setup/authentication_tb
#      wholesale, so those need reapplying every time.
#
# Usage (run ON the VPS):
#   ./vps-import-db.sh /path/to/apdchedu_cisapp.sql
#
# Override defaults via env vars if needed:
#   DB_USER=... DB_PASS=... DB_NAME=... ./vps-import-db.sh dump.sql

set -euo pipefail

SQL_FILE="${1:-}"
if [ -z "$SQL_FILE" ]; then
  echo "Usage: $0 <path-to-sql-dump>" >&2
  exit 1
fi
if [ ! -f "$SQL_FILE" ]; then
  echo "File not found: $SQL_FILE" >&2
  exit 1
fi

DB_NAME="${DB_NAME:-apdchedu_cisapp}"
DB_USER="${DB_USER:-apdchedu_cisapp}"
DB_PASS="${DB_PASS:-cisadmin@123}"
BACKUP_DIR="${BACKUP_DIR:-/root/db-backups}"
COMPOSE_DIR="${COMPOSE_DIR:-/docker/cis-modernized}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-cis-modernized-backend-1}"

mkdir -p "$BACKUP_DIR"

echo "== 1/4: Checking '$SQL_FILE' isn't truncated =="
# A complete mysqldump always ends by restoring the session vars it saved at
# the top of the file — if that's missing, the file was cut off mid-write
# (dump process died, disk full, or the transfer didn't finish).
if ! tail -20 "$SQL_FILE" | grep -q "SET TIME_ZONE=@OLD_TIME_ZONE"; then
  echo "REFUSING TO IMPORT — '$SQL_FILE' does not end with the expected" >&2
  echo "mysqldump trailer. This file looks truncated/incomplete. Last 5 lines:" >&2
  tail -5 "$SQL_FILE" >&2
  exit 1
fi
echo "OK — file looks complete."

echo "== 2/4: Backing up the current database =="
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/pre-import-backup-$STAMP.sql.gz"
mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_FILE"
echo "Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

echo "== 3/4: Importing '$SQL_FILE' =="
if mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SQL_FILE"; then
  echo "Import succeeded."
else
  echo "IMPORT FAILED — restoring the backup from step 2..." >&2
  gunzip -c "$BACKUP_FILE" | mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
  echo "Restored to the pre-import state. Database was NOT left half-imported." >&2
  exit 1
fi

echo "== 4/4: Re-applying accounts + menu access (ALL_USER.json) =="
if [ -f "$COMPOSE_DIR/ALL_USER.json" ] && docker ps --format '{{.Names}}' | grep -qx "$BACKEND_CONTAINER"; then
  docker cp "$COMPOSE_DIR/ALL_USER.json" "$BACKEND_CONTAINER:/app/ALL_USER.json"
  docker exec "$BACKEND_CONTAINER" node scripts/import-all-users.js /app/ALL_USER.json
  docker exec "$BACKEND_CONTAINER" rm -f /app/ALL_USER.json
  echo "Accounts re-provisioned."
else
  echo "Skipped — ALL_USER.json or the '$BACKEND_CONTAINER' container wasn't found. Run manually:" >&2
  echo "  docker cp $COMPOSE_DIR/ALL_USER.json $BACKEND_CONTAINER:/app/ALL_USER.json" >&2
  echo "  docker exec $BACKEND_CONTAINER node scripts/import-all-users.js /app/ALL_USER.json" >&2
  echo "  docker exec $BACKEND_CONTAINER rm -f /app/ALL_USER.json" >&2
fi

echo "Done."
