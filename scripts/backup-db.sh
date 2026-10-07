#!/bin/bash
set -euo pipefail

# Configuración
DATA_DIR="/home/zarate/infosistel-v2-data"
DB_PATH="$DATA_DIR/dev.db"
BACKUP_DIR="$DATA_DIR/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/dev.db.$TIMESTAMP"

echo "=== Iniciando respaldo automático de la BD ==="
mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "Error: La base de datos $DB_PATH no existe."
  exit 1
fi

# Utilizando .backup de sqlite3 para un volcado seguro (no bloquea la BD activa)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
gzip "$BACKUP_FILE"

echo "Respaldo local creado exitosamente: $BACKUP_FILE.gz"

# Limpieza: Mantener solo los últimos 14 respaldos locales para no llenar el disco
ls -1t "$BACKUP_DIR"/dev.db.*.gz 2>/dev/null | tail -n +15 | xargs -r rm --

# ==============================================================================
# Fase 6+: Replicación a almacenamiento externo (S3 / R2 / Backblaze)
# ==============================================================================
# La brecha V8.1.5/V8.1.6 exige que el respaldo sobreviva a la pérdida total
# del VPS. Configurar credenciales AWS (aws configure) y descomentar:
#
# aws s3 cp "$BACKUP_FILE.gz" "s3://infosistel-backups-bucket/db/$TIMESTAMP.db.gz"
#
# Alternativa con rclone (por ejemplo a Google Drive):
# rclone copy "$BACKUP_FILE.gz" "gdrive:infosistel-backups/db/"

echo "Respaldo programado completado."
