#!/bin/bash
# =============================================================================
# Campus Connect — PostgreSQL Restore Script (P7-13)
# =============================================================================
# Restores a pg_dump file into a running PostgreSQL container.
# By default restores to the SAME database (campus_connect).
# Use RESTORE_DB env var to target a SEPARATE database (safe for testing).
#
# Usage:
#   ./scripts/restore.sh ./backups/2026-11-15_123456_campus_connect.dump
#   RESTORE_DB=campus_connect_restore ./scripts/restore.sh ./backups/file.dump
#
# Safety:
#   - Never resets the development database automatically.
#   - Prompts for confirmation before overwriting the production database.
#   - Supports restoring to an isolated test database (RESTORE_DB variable).
# =============================================================================
set -e

CONTAINER="${CC_DB_CONTAINER:-cc_postgres}"
DB_USER="${POSTGRES_USER:-cc_user}"
TARGET_DB="${RESTORE_DB:-${POSTGRES_DB:-campus_connect}}"
DUMP_FILE="$1"

if [ -z "$DUMP_FILE" ]; then
    echo "[restore] ERROR: No dump file specified."
    echo "[restore] Usage: $0 <path/to/dump_file.dump>"
    exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
    echo "[restore] ERROR: File not found: $DUMP_FILE"
    exit 1
fi

echo "[restore] Campus Connect PostgreSQL Restore"
echo "[restore] Container  : $CONTAINER"
echo "[restore] Target DB  : $TARGET_DB"
echo "[restore] Dump file  : $DUMP_FILE"

# Safety confirmation when restoring to production database
if [ "$TARGET_DB" = "${POSTGRES_DB:-campus_connect}" ]; then
    echo ""
    echo "⚠️  WARNING: You are about to restore into the PRODUCTION database: $TARGET_DB"
    echo "   This will DROP and recreate all tables. Existing data will be LOST."
    echo "   To restore safely into a test database: RESTORE_DB=test_db $0 $DUMP_FILE"
    echo ""
    read -r -p "Type 'yes' to confirm restore into $TARGET_DB: " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "[restore] Restore cancelled."
        exit 0
    fi
fi

# Verify container is running
if ! docker inspect "$CONTAINER" > /dev/null 2>&1; then
    echo "[restore] ERROR: Container '$CONTAINER' not found. Is Docker Compose running?"
    exit 1
fi

BASENAME=$(basename "$DUMP_FILE")

# Copy dump file into the container
echo "[restore] Copying dump file into container..."
docker cp "$DUMP_FILE" "${CONTAINER}:/tmp/${BASENAME}"

# Drop and recreate the target database (requires superuser; postgres:16 default user has this)
echo "[restore] Recreating target database: $TARGET_DB ..."
docker exec "$CONTAINER" psql \
    --username="$DB_USER" \
    --dbname="postgres" \
    --command="DROP DATABASE IF EXISTS \"${TARGET_DB}\";"
docker exec "$CONTAINER" psql \
    --username="$DB_USER" \
    --dbname="postgres" \
    --command="CREATE DATABASE \"${TARGET_DB}\" OWNER \"${DB_USER}\";"

# Run pg_restore
echo "[restore] Running pg_restore..."
docker exec "$CONTAINER" \
    pg_restore \
        --username="$DB_USER" \
        --dbname="$TARGET_DB" \
        --no-owner \
        --role="$DB_USER" \
        --exit-on-error \
        "/tmp/${BASENAME}"

# Verify: count tables
TABLE_COUNT=$(docker exec "$CONTAINER" psql \
    --username="$DB_USER" \
    --dbname="$TARGET_DB" \
    --tuples-only \
    --command="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
echo "[restore] Tables restored: $(echo $TABLE_COUNT | tr -d ' ')"

# Clean up temp file from container
docker exec "$CONTAINER" rm -f "/tmp/${BASENAME}"

echo "[restore] ✅ Restore complete: $TARGET_DB"
echo "[restore] Run Alembic to verify head: docker compose exec backend alembic current"

