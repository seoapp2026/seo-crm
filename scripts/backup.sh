#!/usr/bin/env bash
# backup.sh — create a timestamped archive of all SEO CRM SQLite databases.
#
# Usage:
#   scripts/backup.sh [DB_DIR] [BACKUP_DIR]
#
#   DB_DIR      Directory containing the *.db files.
#               Default: $DB_DIR env var, else ./backend relative to this script.
#   BACKUP_DIR  Where the archive (and optional SQL dumps) are written.
#               Default: $BACKUP_DIR env var, else ./backups relative to this script.
#
# Produces:
#   BACKUP_DIR/seo-crm-backup-YYYYMMDD-HHMMSS.tar.gz   (all *.db files)
#   BACKUP_DIR/<name>-YYYYMMDD-HHMMSS.sql              (plain SQL dump per db,
#                                                       only when sqlite3 is installed)
#
# Restore: stop the app, extract the archive into DB_DIR, restart. See
# docs/BACKUP_AND_HANDOFF.md.
#
# Recommended habit: run weekly (and before every deploy) via cron, e.g.
#   0 9 * * 1 /path/to/seo-crm/scripts/backup.sh >> /path/to/seo-crm/backups/backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_DIR="${DB_DIR:-${1:-$REPO_ROOT/backend}}"
BACKUP_DIR="${BACKUP_DIR:-${2:-$REPO_ROOT/backups}}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

if [ ! -d "$DB_DIR" ]; then
    echo "ERROR: DB_DIR not found: $DB_DIR" >&2
    exit 1
fi

shopt -s nullglob
DB_FILES=("$DB_DIR"/*.db)
shopt -u nullglob

if [ ${#DB_FILES[@]} -eq 0 ]; then
    echo "ERROR: no .db files found in $DB_DIR" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

BASENAMES=()
for f in "${DB_FILES[@]}"; do
    BASENAMES+=("$(basename "$f")")
done

ARCHIVE="$BACKUP_DIR/seo-crm-backup-$TIMESTAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$DB_DIR" "${BASENAMES[@]}"
echo "Archive written: $ARCHIVE  (${#BASENAMES[@]} file(s): ${BASENAMES[*]})"

if command -v sqlite3 >/dev/null 2>&1; then
    for f in "${DB_FILES[@]}"; do
        name="$(basename "$f" .db)"
        dump="$BACKUP_DIR/${name}-${TIMESTAMP}.sql"
        sqlite3 "$f" .dump > "$dump"
        echo "SQL dump written: $dump"
    done
else
    echo "NOTE: sqlite3 CLI not found — skipping plain SQL dumps (archive still created)."
fi
