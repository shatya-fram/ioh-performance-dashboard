#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Export database from Manus (current environment) to a SQL dump
# Run this in the Manus sandbox BEFORE migrating to Hetzner
# Usage: bash deploy/export-db.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set. Run inside the Manus sandbox."
  exit 1
fi

# Parse DATABASE_URL: mysql://user:pass@host:port/dbname
DB_URL="${DATABASE_URL}"
DB_USER=$(echo "$DB_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|mysql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|mysql://[^@]+@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|mysql://[^/]+/([^?]+).*|\1|')

DUMP_FILE="deploy/ioh_dashboard_$(date +%Y%m%d_%H%M%S).sql"

echo "Exporting database: $DB_NAME from $DB_HOST:$DB_PORT"
echo "Output: $DUMP_FILE"

mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p"$DB_PASS" \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  "$DB_NAME" > "$DUMP_FILE"

echo "✅ Export complete: $DUMP_FILE ($(du -sh "$DUMP_FILE" | cut -f1))"
echo ""
echo "To import on Hetzner:"
echo "  1. Copy the dump: scp $DUMP_FILE root@YOUR_HETZNER_IP:/opt/ioh-dashboard/deploy/"
echo "  2. On Hetzner: docker compose exec -T db mysql -u ioh_user -p\$MYSQL_PASSWORD ioh_dashboard < deploy/$(basename $DUMP_FILE)"
