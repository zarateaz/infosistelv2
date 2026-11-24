#!/bin/bash
# scripts/backup-db.sh — Respaldo COMPLETO de INFOSISTEL v2.
#
# Guarda en un solo archivo .tar.gz (permisos 600, solo tu usuario puede leerlo):
#   - db/dev.db              → base de datos (copia en caliente segura + verificación de integridad)
#   - servicios-tecnicos/    → datos de Servicios Técnicos (JSON)
#   - env/.env               → claves (JWT, ENCRYPTION_KEY...). SIN ESTO NO SE PUEDEN LEER
#                              LOS DATOS CIFRADOS AL RESTAURAR. Trátalo como una contraseña.
# Las FOTOS (uploads/) no van aquí: pesan mucho; se copian a tu PC con
# scripts/descargar-backups.sh (copia incremental).
#
# Uso:
#   bash scripts/backup-db.sh                # respaldo diario (rota: se guardan los últimos 30)
#   bash scripts/backup-db.sh pre-deploy     # etiqueta libre (también rota, últimos 30 en total)
#   bash scripts/backup-db.sh pre-restauracion  # NO rota: nunca se borra solo
set -euo pipefail

APP_DIR="${APP_DIR:-/home/zarate/infosistel-v2}"
DATA_DIR="${DATA_DIR:-/home/zarate/infosistel-v2-data}"
BACKUP_DIR="$DATA_DIR/backups"
KEEP="${KEEP:-30}"
LABEL="${1:-diario}"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
[ -n "$NODE_BIN" ] || { echo "❌ No se encontró node (define NODE_BIN)"; exit 1; }

# Ubicación real de la BD: la que usa la app (DATABASE_URL en .env), si existe.
DB_PATH="$DATA_DIR/dev.db"
if [ -f "$APP_DIR/.env" ]; then
  URL=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'" || true)
  case "$URL" in
    file:/*) DB_PATH="${URL#file:}" ;;
  esac
fi
[ -f "$DB_PATH" ] || { echo "❌ No existe la base de datos: $DB_PATH"; exit 1; }

STAMP="$(TZ=America/Lima date +%Y%m%d-%H%M%S)"
NAME="infosistel-$STAMP-$LABEL"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
umask 077
mkdir -p "$BACKUP_DIR" "$WORK/$NAME/db" "$WORK/$NAME/env"

echo "=== Respaldo INFOSISTEL ($LABEL) — $STAMP ==="

# 1) BD: copia en caliente (no detiene la web) + integrity_check sobre la copia.
cd "$APP_DIR"
"$NODE_BIN" -e '
const Database = require("better-sqlite3");
const [src, dst] = process.argv.slice(1);
const db = new Database(src, { readonly: true, fileMustExist: true });
db.backup(dst).then(() => {
  db.close();
  const copy = new Database(dst, { readonly: true });
  const res = copy.pragma("integrity_check", { simple: true });
  const n = copy.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = ?").get("table").n;
  copy.close();
  if (res !== "ok") { console.error("❌ La copia no pasó integrity_check:", res); process.exit(2); }
  console.log("   BD copiada y verificada (" + n + " tablas)");
}).catch((e) => { console.error("❌ Error copiando la BD:", e.message); process.exit(1); });
' "$DB_PATH" "$WORK/$NAME/db/dev.db"

# 2) Servicios Técnicos (JSON) — sin su carpeta interna de respaldos para no duplicar.
if [ -d "$DATA_DIR/servicios-tecnicos" ]; then
  mkdir -p "$WORK/$NAME/servicios-tecnicos"
  (cd "$DATA_DIR/servicios-tecnicos" && find . -maxdepth 1 -type f -exec cp -p {} "$WORK/$NAME/servicios-tecnicos/" \;)
  echo "   Servicios Técnicos copiados"
fi

# 3) .env (claves)
if [ -f "$APP_DIR/.env" ]; then
  cp -p "$APP_DIR/.env" "$WORK/$NAME/env/.env"
  echo "   .env copiado"
fi

cat > "$WORK/$NAME/LEEME.txt" <<EOF
Respaldo INFOSISTEL v2 — $STAMP ($LABEL)
BD original: $DB_PATH
Restaurar:   bash scripts/restaurar-backup.sh <este-archivo.tar.gz>
EOF

OUT="$BACKUP_DIR/$NAME.tar.gz"
tar -czf "$OUT.tmp" -C "$WORK" "$NAME"
tar -tzf "$OUT.tmp" > /dev/null   # verifica que el archivo se puede leer
mv "$OUT.tmp" "$OUT"
chmod 600 "$OUT"
echo "✅ Respaldo listo: $OUT ($(du -h "$OUT" | cut -f1))"

# Rotación: conservar los últimos $KEEP (los "pre-restauracion" nunca se borran solos).
ls -1t "$BACKUP_DIR"/infosistel-*.tar.gz 2>/dev/null | grep -v -- '-pre-restauracion\.tar\.gz$' | tail -n +$((KEEP + 1)) | xargs -r rm -- || true
# Formato antiguo (dev.db.*.gz): conservar solo los 5 más recientes.
ls -1t "$BACKUP_DIR"/dev.db.* 2>/dev/null | tail -n +6 | xargs -r rm -- || true
exit 0
