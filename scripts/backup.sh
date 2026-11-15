#!/bin/bash
# =============================================================================
# Campus Connect — PostgreSQL Backup Script (P7-13)
# =============================================================================
# Creates a timestamped pg_dump inside the cc_postgres container.
# The dump is written to the campus_connect_backups Docker volume,
# which persists across container restarts.
#
# Usage:
#   ./scripts/backup.sh                     # auto-timestamped filename
#   ./scripts/backup.sh mybackup.dump       # custom filename
#
# Output: /backups/YYYY-MM-DD_HHMMSS_campus_connect.dump (inside volume)
#         The file is also copied to ./backups/ on the host for convenience.
# =============================================================================
set -e

CONTAINER="${CC_DB_CONTAINER:-cc_postgres}"
DB_NAME="${POSTGRES_DB:-campus_connect}"
DB_USER="${POSTGRES_USER:-cc_user}"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
FILENAME="${1:-${TIMESTAMP}_campus_connect.dump}"

echo "[backup] Campus Connect PostgreSQL Backup"
echo "[backup] Container : $CONTAINER"
echo "[backup] Database  : $DB_NAME"
echo "[backup] File      : $FILENAME"

# Verify container is running
if ! docker inspect "$CONTAINER" > /dev/null 2>&1; then
    echo "[backup] ERROR: Container '$CONTAINER' not found. Is Docker Compose running?"
    exit 1
fi

# Create dump inside the backups volume mounted at /backups
docker exec "$CONTAINER" \
    pg_dump \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --format=custom \
        --compress=9 \
        --no-password \
        --file="/backups/$FILENAME"

echo "[backup] Dump written to volume at /backups/$FILENAME"

# Copy to host ./backups/ for local access
mkdir -p ./backups
docker cp "${CONTAINER}:/backups/${FILENAME}" "./backups/${FILENAME}"
echo "[backup] Copied to host: ./backups/$FILENAME"

# Verify: list file and show size
docker exec "$CONTAINER" ls -lh "/backups/$FILENAME"
echo "[backup] ✅ Backup complete: $FILENAME"

