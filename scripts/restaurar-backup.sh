#!/bin/bash
# scripts/restaurar-backup.sh — Restaura un respaldo hecho con scripts/backup-db.sh.
#
#   bash scripts/restaurar-backup.sh                 # lista los respaldos disponibles
#   bash scripts/restaurar-backup.sh <archivo.tar.gz>             # restaura BD + Servicios Técnicos
#   bash scripts/restaurar-backup.sh <archivo.tar.gz> --con-env   # además restaura el .env
#
# Antes de tocar nada guarda el estado ACTUAL como "pre-restauracion" (nunca se borra solo),
# así una restauración equivocada siempre se puede deshacer.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/zarate/infosistel-v2}"
DATA_DIR="${DATA_DIR:-/home/zarate/infosistel-v2-data}"
BACKUP_DIR="$DATA_DIR/backups"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"

if [ $# -lt 1 ]; then
  echo "Respaldos disponibles (más reciente primero):"
  ls -1th "$BACKUP_DIR"/infosistel-*.tar.gz 2>/dev/null | while read -r f; do
    echo "  $(du -h "$f" | cut -f1)	$f"
  done || true
  echo ""
  echo "Uso: bash scripts/restaurar-backup.sh <archivo.tar.gz> [--con-env]"
  exit 0
fi

FILE="$1"
WITH_ENV="${2:-}"
[ -f "$FILE" ] || { echo "❌ No existe: $FILE"; exit 1; }

DB_PATH="$DATA_DIR/dev.db"
if [ -f "$APP_DIR/.env" ]; then
  URL=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'" || true)
  case "$URL" in file:/*) DB_PATH="${URL#file:}" ;; esac
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
umask 077
tar -xzf "$FILE" -C "$WORK"
SRC="$(find "$WORK" -mindepth 1 -maxdepth 1 -type d | head -1)"
[ -f "$SRC/db/dev.db" ] || { echo "❌ El respaldo no contiene db/dev.db"; exit 1; }

# Verificar la copia ANTES de detener nada.
cd "$APP_DIR"
"$NODE_BIN" -e '
const Database = require("better-sqlite3");
const db = new Database(process.argv[1], { readonly: true });
const r = db.pragma("integrity_check", { simple: true });
if (r !== "ok") { console.error("❌ El respaldo está dañado:", r); process.exit(2); }
console.log("   Respaldo verificado (integrity_check = ok)");
' "$SRC/db/dev.db"

echo ""
echo "Vas a restaurar: $(basename "$FILE")"
echo "  → BD:                  $DB_PATH"
echo "  → Servicios Técnicos:  $DATA_DIR/servicios-tecnicos"
[ "$WITH_ENV" = "--con-env" ] && echo "  → .env:                $APP_DIR/.env"
echo "Todo lo registrado DESPUÉS de ese respaldo se perderá (queda guardado en un respaldo pre-restauracion)."
read -r -p "Escribe RESTAURAR para continuar: " OK
[ "$OK" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

echo "➡️  1/4 Guardando el estado actual (pre-restauracion)..."
bash "$APP_DIR/scripts/backup-db.sh" pre-restauracion

echo "➡️  2/4 Deteniendo la web y WhatsApp..."
npx pm2 stop infosistel-v2 infosistel-whatsapp >/dev/null

echo "➡️  3/4 Restaurando archivos..."
rm -f "$DB_PATH-wal" "$DB_PATH-shm" "$DB_PATH-journal"
cp "$SRC/db/dev.db" "$DB_PATH.restaurando"
mv "$DB_PATH.restaurando" "$DB_PATH"
if [ -d "$SRC/servicios-tecnicos" ]; then
  mkdir -p "$DATA_DIR/servicios-tecnicos"
  cp -p "$SRC/servicios-tecnicos/"* "$DATA_DIR/servicios-tecnicos/" 2>/dev/null || true
fi
if [ "$WITH_ENV" = "--con-env" ] && [ -f "$SRC/env/.env" ]; then
  cp -p "$SRC/env/.env" "$APP_DIR/.env"
  echo "   .env restaurado"
fi

echo "➡️  4/4 Reiniciando servicios..."
npx pm2 start ecosystem.config.js --update-env >/dev/null
npx pm2 save >/dev/null
sleep 3
echo "   Web: HTTP $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000 || echo 000)"
echo ""
echo "✅ Restauración completa. Si algo no cuadra, puedes volver atrás con el respaldo '-pre-restauracion' recién creado."
