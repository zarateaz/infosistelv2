#!/bin/bash
# scripts/descargar-backups.sh — SE EJECUTA EN TU PC (no en el VPS).
#
# Trae a tu PC los respaldos y las fotos del VPS. Es la copia que sobrevive si el
# VPS es hackeado o se pierde. La copia la "jala" tu PC: aunque alguien tome el
# VPS, no puede borrar lo que ya está en tu PC (nunca se borra nada aquí).
#
#   bash scripts/descargar-backups.sh
#
# Automático todos los días a las 10 AM (en tu PC):
#   (crontab -l 2>/dev/null; echo "0 10 * * * bash $HOME/infosistelv2/scripts/descargar-backups.sh >> $HOME/infosistel-backups/descarga.log 2>&1") | crontab -
set -euo pipefail

VPS="${VPS:-zarate@187.127.20.171}"
PORT="${PORT:-2244}"
DEST="${DEST:-$HOME/infosistel-backups}"
REMOTE_DATA="/home/zarate/infosistel-v2-data"

mkdir -p "$DEST/respaldos" "$DEST/fotos"
chmod 700 "$DEST"
echo "=== $(date '+%F %T') Descargando respaldos de INFOSISTEL ==="

# Sin --delete: lo que ya bajó a tu PC se queda aunque lo borren en el VPS.
rsync -az -e "ssh -p $PORT" "$VPS:$REMOTE_DATA/backups/" "$DEST/respaldos/"
rsync -az -e "ssh -p $PORT" "$VPS:$REMOTE_DATA/uploads/" "$DEST/fotos/"

ULTIMO=$(ls -1t "$DEST/respaldos"/infosistel-*.tar.gz 2>/dev/null | head -1 || true)
if [ -z "$ULTIMO" ]; then
  echo "⚠ No hay respaldos nuevos en el VPS. ¿Está instalado el respaldo automático?"
  exit 1
fi
EDAD_H=$(( ( $(date +%s) - $(stat -c %Y "$ULTIMO") ) / 3600 ))
echo "✅ Último respaldo: $(basename "$ULTIMO") (hace ${EDAD_H} h) · $(ls "$DEST/respaldos"/infosistel-*.tar.gz | wc -l) respaldos en tu PC"
[ "$EDAD_H" -le 30 ] || echo "⚠ ATENCIÓN: el último respaldo tiene más de 30 horas. Revisa el cron del VPS."

# En tu PC se guardan hasta 90 respaldos diarios (los pre-restauracion no se tocan).
ls -1t "$DEST/respaldos"/infosistel-*.tar.gz | grep -v -- '-pre-restauracion\.tar\.gz$' | tail -n +91 | xargs -r rm -- || true
