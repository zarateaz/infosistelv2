#!/bin/bash
# scripts/deploy-vps.sh
#
# Builds and (re)starts INFOSISTEL v2 under PM2. Run this YOURSELF on the
# VPS after `git pull` — nothing in this repo runs it for you, and no
# automated tool (including Claude) executes this against the live server.
#
# Data that must survive every redeploy (the database, uploaded product
# photos) lives OUTSIDE this repo, in DATA_DIR below — never inside .next,
# which this script deletes and rebuilds every run.
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

echo "=== Verificando secretos requeridos ==="
for v in DATABASE_URL JWT_SECRET ENCRYPTION_KEY DNI_HMAC_SECRET; do
  if [ -z "${!v:-}" ]; then
    echo "ERROR: $v no está definido en .env."
    exit 1
  fi
done
if [[ "$DATABASE_URL" != file:/* ]]; then
  echo "ERROR: DATABASE_URL debe ser una ruta absoluta en producción (file:/ruta/completa/dev.db)."
  echo "       Una ruta relativa apuntaría dentro de .next/standalone y se perdería en cada build."
  exit 1
fi

echo "=== Preparando directorio de datos persistentes ==="
mkdir -p "$DATA_DIR/backups" "$DATA_DIR/uploads/products"
DB_PATH="${DATABASE_URL#file:}"
if [ -f "$DB_PATH" ]; then
  STAMP="$(date +%Y%m%d-%H%M%S)"
  cp -a "$DB_PATH" "$DATA_DIR/backups/dev.db.$STAMP"
  echo "Backup de la base de datos: $DATA_DIR/backups/dev.db.$STAMP"
else
  echo "AVISO: $DB_PATH no existe todavía — se creará en el siguiente paso (primera vez)."
fi

echo "=== Instalando dependencias ==="
npm ci

echo "=== Prisma: generar cliente y aplicar migraciones ==="
npx prisma generate
npx prisma migrate deploy

echo "=== Build de producción (si esto falla, NO sigas a PM2) ==="
NODE_ENV=production npm run build

if [ ! -f .next/standalone/server.js ]; then
  echo "ERROR: no existe .next/standalone/server.js — el build no terminó bien."
  exit 1
fi

echo "=== Copiando estáticos al build standalone ==="
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
cp -r public/. .next/standalone/public/

echo "=== Enlazando fotos de producto persistentes ==="
# Overwrites whatever `cp -r public/.` just copied for this folder — the
# repo's own public/img/products is only ever a placeholder in git
# (.gitignore'd locally too), the real content lives in DATA_DIR.
rm -rf .next/standalone/public/img/products
ln -s "$DATA_DIR/uploads/products" .next/standalone/public/img/products

echo "=== PM2 ==="
npx pm2 delete infosistel-v2 2>/dev/null || true
npx pm2 start ecosystem.config.js --update-env
npx pm2 save
npx pm2 list

echo "=== Smoke test ==="
sleep 2
curl -sI http://127.0.0.1:3000 | head -n 5

echo ""
echo "Listo. La base de datos y las fotos siguen en $DATA_DIR — no se tocaron."
echo "Este proceso corre en el puerto 3000 bajo el nombre 'infosistel-v2'."
echo "Nginx sigue intacto — revisa docs/deploy-vps.md antes de apuntarlo aquí."
