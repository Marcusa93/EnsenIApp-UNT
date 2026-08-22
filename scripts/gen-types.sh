#!/usr/bin/env bash
# Regenera src/lib/types/database.ts desde el esquema real de Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.local; set +a
curl -sS "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/types/typescript?included_schemas=public" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["types"])' > src/lib/types/database.ts
echo "✓ src/lib/types/database.ts regenerado"
