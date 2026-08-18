#!/usr/bin/env bash
# Import a MySQL/MariaDB dump into the dev-only `mariadb` docker-compose service
# (see docker-compose.yml — port 3003, container database `apdchedu_cisapp`).
#
# This targets ONLY the containerized dev database. It never touches the host
# MariaDB the live legacy PHP app uses.
#
# Usage:
#   scripts/import-db.sh apdchedu_cisapp.sql
#   scripts/import-db.sh /path/to/other-dump.sql
#   scripts/import-db.sh apdchedu_cisapp.sql --yes   # skip confirmation prompt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

SQL_FILE="${1:-}"
AUTO_YES="${2:-}"

if [ -z "$SQL_FILE" ]; then
  echo "Usage: $0 <path-to-sql-file> [--yes]" >&2
  exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
  echo "File not found: $SQL_FILE" >&2
  exit 1
fi

DB_NAME="apdchedu_cisapp"
DB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:-cis_dev_root}"

if ! docker compose ps --status running mariadb --format '{{.Name}}' 2>/dev/null | grep -q .; then
  echo "The 'mariadb' service isn't running. Start it first:" >&2
  echo "  docker compose up -d mariadb" >&2
  exit 1
fi

FILE_SIZE_HUMAN="$(du -h "$SQL_FILE" | cut -f1)"

if [ "$AUTO_YES" != "--yes" ]; then
  echo "This will import '$SQL_FILE' ($FILE_SIZE_HUMAN) into the docker mariadb"
  echo "container's '$DB_NAME' database (port 3003). The dump's own DROP TABLE"
  echo "statements mean matching tables will be replaced."
  read -r -p "Continue? [y/N] " REPLY
  case "$REPLY" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

echo "Importing $SQL_FILE ($FILE_SIZE_HUMAN) into mariadb:$DB_NAME ..."
START_TS=$(date +%s)

if command -v pv >/dev/null 2>&1; then
  pv "$SQL_FILE" | docker compose exec -T mariadb sh -c "exec mysql -uroot -p'$DB_ROOT_PASSWORD' '$DB_NAME'"
else
  echo "(tip: install 'pv' for a progress bar on large imports)"
  docker compose exec -T mariadb sh -c "exec mysql -uroot -p'$DB_ROOT_PASSWORD' '$DB_NAME'" < "$SQL_FILE"
fi

ELAPSED=$(( $(date +%s) - START_TS ))
echo "Done in ${ELAPSED}s."
