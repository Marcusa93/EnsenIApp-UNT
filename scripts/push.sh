#!/usr/bin/env bash
# Push al repo Marcusa93/EnsenIApp-UNT usando la cuenta gh "Marcusa93" (dueña del repo)
# sin cambiar la cuenta activa global de gh. Uso: scripts/push.sh [rama]
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
TOKEN="$(gh auth token --user Marcusa93)"
AUTH="$(printf 'x-access-token:%s' "$TOKEN" | base64)"
git -c http.extraheader="Authorization: Basic ${AUTH}" push -u origin "$BRANCH"
