# Campus Connect — Backup & Restore Guide (P7-13)

**Last Updated:** 2026-11-15

> [!IMPORTANT]
> Always create a backup before running database migrations, upgrades, or destructive operations. The backup scripts are designed to never touch the development database automatically.
> 
> *Environment Note:* `scripts/backup.sh` and `scripts/restore.sh` have been verified for POSIX shell syntax and LF line endings. Execution requires a host running Docker Engine and the `cc_postgres` container. For local non-Docker development environments, use the direct `pg_dump` command documented in Section 3.

---

## Backup Overview

| Method | Tool | Location | Format |
|--------|------|----------|--------|
| Docker script | `scripts/backup.sh` | `./backups/` (host) + Docker volume | pg_dump custom (-Fc) |
| Manual pg_dump | `docker compose exec` | Anywhere | pg_dump custom or plain SQL |
| Development | `pg_dump` (local) | Anywhere | Any pg_dump format |

---

## 1. Automated Backup (Docker Deployment)

### Create a timestamped backup

```bash
bash scripts/backup.sh
# Output: ./backups/2026-11-15_143022_campus_connect.dump
```

### Create a named backup

```bash
bash scripts/backup.sh before_migration_v2.dump
# Output: ./backups/before_migration_v2.dump
```

### What the script does
1. Runs `pg_dump` inside the `cc_postgres` container using the mounted `/backups` volume.
2. Copies the dump file to `./backups/` on the host.
3. Reports the file size for verification.

### Schedule automated backups (Linux/macOS cron)

```bash
# Edit crontab
crontab -e

# Add: backup every day at 2:00 AM
0 2 * * * cd /path/to/campus-connect && bash scripts/backup.sh >> logs/backup.log 2>&1
```

---

## 2. Manual Backup (Docker)

```bash
# Backup to a file on the host directly
docker compose exec -T db \
    pg_dump \
        --username=cc_user \
        --dbname=campus_connect \
        --format=custom \
        --compress=9 \
    > ./backups/manual_backup.dump

# Verify file size (should be > 0 bytes)
ls -lh ./backups/manual_backup.dump
```

---

## 3. Development Database Backup (without Docker)

```bash
# From development machine with PostgreSQL client installed
pg_dump \
    --host=localhost \
    --port=5432 \
    --username=postgres \
    --dbname=campus_connect \
    --format=custom \
    --compress=9 \
    --file=./backups/dev_backup_$(date +%Y%m%d).dump
```

---

## 4. Restore to a Test Database (Safe)

> [!TIP]
> Always test a restore to a **separate database** before applying to production. This verifies backup integrity without risking live data.

```bash
# Restore to campus_connect_restore (created automatically if it doesn't exist)
RESTORE_DB=campus_connect_restore \
    bash scripts/restore.sh ./backups/2026-11-15_143022_campus_connect.dump

# Verify restored data
docker compose exec db psql -U cc_user -d campus_connect_restore \
    -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM posts;"

# Check Alembic state in restored database
DATABASE_URL="postgresql+psycopg://cc_user:${POSTGRES_PASSWORD}@localhost:5433/campus_connect_restore" \
    docker compose exec backend alembic current
```

---

## 5. Restore to Production Database

> [!CAUTION]
> This drops and recreates the production database. All current data is permanently replaced. Only proceed after creating a fresh backup and verifying the restore dump is valid.

```bash
# Step 1: Create a fresh safety backup
bash scripts/backup.sh pre_restore_safety.dump

# Step 2: Run restore (will prompt for confirmation)
bash scripts/restore.sh ./backups/2026-11-15_143022_campus_connect.dump

# Step 3: Verify table counts
docker compose exec db psql -U cc_user -d campus_connect \
    -c "\dt" \
    -c "SELECT COUNT(*) AS users FROM users;" \
    -c "SELECT COUNT(*) AS posts FROM posts;"

# Step 4: Verify Alembic is at head
docker compose exec backend alembic current
# Expected: 055c082ed165 (head)

# Step 5: Restart backend to reconnect connection pool
docker compose restart backend
```

---

## 6. Manual Restore (pg_restore)

```bash
# Copy dump into container
docker cp ./backups/my_backup.dump cc_postgres:/tmp/my_backup.dump

# Drop and recreate target database
docker compose exec db psql -U cc_user -d postgres \
    -c "DROP DATABASE IF EXISTS campus_connect_restore;" \
    -c "CREATE DATABASE campus_connect_restore OWNER cc_user;"

# Restore
docker compose exec db \
    pg_restore \
        --username=cc_user \
        --dbname=campus_connect_restore \
        --no-owner \
        --role=cc_user \
        /tmp/my_backup.dump

# Clean up
docker compose exec db rm /tmp/my_backup.dump
```

---

## 7. Alembic Rollback Procedure

> [!WARNING]
> Migration rollback requires a backup first. Not all destructive migrations are safely reversible.

```bash
# Step 1: Backup before downgrade
bash scripts/backup.sh pre_downgrade.dump

# Step 2: Check current state
docker compose exec backend alembic current
docker compose exec backend alembic history --verbose

# Step 3: Downgrade one revision
docker compose exec backend alembic downgrade -1

# Step 4: Verify
docker compose exec backend alembic current

# Step 5: If downgrade breaks the application, restore from backup
bash scripts/restore.sh ./backups/pre_downgrade.dump
docker compose exec backend alembic upgrade head
```

---

## 8. Backup Verification Checklist

After creating a backup, verify it is valid:

```bash
# Check file exists and has non-zero size
ls -lh ./backups/

# Verify dump integrity (pg_restore with --list only reads TOC, doesn't apply)
docker cp ./backups/my_backup.dump cc_postgres:/tmp/check.dump
docker compose exec db pg_restore --list /tmp/check.dump | head -20
docker compose exec db rm /tmp/check.dump
```

---

## 9. Backup Retention Policy (Recommended)

| Frequency | Retention |
|-----------|-----------|
| Daily | 7 days |
| Weekly (Sunday) | 4 weeks |
| Monthly (1st) | 6 months |
| Pre-migration | Permanent (labelled) |

```bash
# Clean up backups older than 7 days (Linux/macOS)
find ./backups/ -name "*.dump" -mtime +7 -delete
```

