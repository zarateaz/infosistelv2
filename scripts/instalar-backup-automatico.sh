#!/bin/bash
# scripts/instalar-backup-automatico.sh — SE EJECUTA EN EL VPS una sola vez.
# Programa el respaldo completo todos los días a las 3:00 AM hora Perú (08:00 UTC)
# usando el crontab de tu usuario (no necesita sudo). Es seguro ejecutarlo varias veces.
set -euo pipefail

APP_DIR="/home/zarate/infosistel-v2"
DATA_DIR="/home/zarate/infosistel-v2-data"
NODE_BIN="$(command -v node)"
LINE="0 8 * * * NODE_BIN=$NODE_BIN bash $APP_DIR/scripts/backup-db.sh diario >> $DATA_DIR/backups/backup.log 2>&1 # infosistel-backup"

mkdir -p "$DATA_DIR/backups"
chmod 700 "$DATA_DIR/backups"
( crontab -l 2>/dev/null | grep -v '# infosistel-backup' || true; echo "$LINE" ) | crontab -
chmod 600 "$DATA_DIR"/backups/*.tar.gz 2>/dev/null || true

echo "✅ Respaldo automático instalado (todos los días 3:00 AM Perú):"
crontab -l | grep '# infosistel-backup'
echo ""
echo "Haciendo un primer respaldo ahora para comprobar que funciona..."
NODE_BIN="$NODE_BIN" bash "$APP_DIR/scripts/backup-db.sh" diario
