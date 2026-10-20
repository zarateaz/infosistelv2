#!/usr/bin/env bash
# scripts/devops/ship.sh
# Shortcut runner for INFOSISTEL v2 DevOps Agent
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

if [ $# -eq 0 ]; then
  echo "Uso: ./scripts/devops/ship.sh \"tu prompt o idea aquí\""
  exit 1
fi

npx tsx scripts/devops/ship.ts "$@"
