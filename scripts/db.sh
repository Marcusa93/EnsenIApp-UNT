#!/usr/bin/env bash
# Ejecuta un archivo SQL (o una query inline) contra el proyecto Supabase vía Management API.
# Uso: scripts/db.sh supabase/migrations/002_x.sql   |   scripts/db.sh -q "select 1"
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.local; set +a
if [[ "${1:-}" == "-q" ]]; then SQL="$2"; else SQL="$(cat "$1")"; fi
PAYLOAD=$(python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<< "$SQL")
curl -sS -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD"
echo
