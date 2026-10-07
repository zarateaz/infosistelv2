#!/bin/bash
# scripts/deploy-docker.sh
#
# Builds and (re)starts INFOSISTEL v2 using Docker Compose.
# Run this on the VPS after `git pull`.
#
set -euo pipefail

APP_DIR="/home/zarate/infosistel-v2"
DATA_DIR="/home/zarate/infosistel-v2-data"
cd "$APP_DIR"

echo "=== Cargando .env ==="
if [ ! -f .env ]; then
  echo "ERROR: no existe .env en $APP_DIR. Copia .env.example y complétalo primero."
  exit 1
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

echo "=== Preparando directorio de datos persistentes ==="
mkdir -p "$DATA_DIR/backups" "$DATA_DIR/uploads/products" "$DATA_DIR/uploads/servicios"
DB_PATH="${DATABASE_URL#file:}"
if [ -f "$DB_PATH" ]; then
  # Sigue haciendo el backup de seguridad pre-despliegue por si acaso
  STAMP="$(date +%Y%m%d-%H%M%S)"
  cp -a "$DB_PATH" "$DATA_DIR/backups/dev.db.deploy.$STAMP"
  echo "Backup pre-despliegue guardado."
fi

echo "=== Construyendo y levantando contenedor Docker ==="
# Docker build reconstruye Next.js y genera los binarios para su entorno aislado (Debian)
docker compose up -d --build

echo "=== Eliminando dependencias sueltas si aún existían ==="
# Opcionalmente, puedes eliminar los servicios PM2 anteriores si vienes de la versión vieja
npx pm2 delete infosistel-v2 2>/dev/null || true
npx pm2 save 2>/dev/null || true

echo "=== Smoke test ==="
sleep 5
curl -sI http://127.0.0.1:3000 | head -n 5

echo ""
echo "Listo. El contenedor Docker 'infosistel-v2' está corriendo en el puerto 3000."
echo "La base de datos y estáticos en $DATA_DIR fueron montados exitosamente."
