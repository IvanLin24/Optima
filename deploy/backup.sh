#!/bin/bash
# AI: только обслуживание Optima. WEB proxy НЕ ТРОГАТЬ; сохранять /telegram/web/ и include прокси в Nginx. См. AGENTS.md.
set -euo pipefail
umask 077
cd /opt/procurement/current
mkdir -p /var/backups/procurement
chmod 700 /var/backups/procurement
target="/var/backups/procurement/pg-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
test ! -e "$target"
docker compose -p procurement -f compose.yaml -f deploy/compose.host.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$target.partial"
mv "$target.partial" "$target"
gzip -t "$target"
echo "Database backup completed."
