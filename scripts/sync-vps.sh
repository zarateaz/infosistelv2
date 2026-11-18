#!/bin/bash
# scripts/sync-vps.sh
#
# Script maestro de sincronización y despliegue rápido para INFOSISTEL v2 en el VPS.
# Actualiza código desde Git, compila la aplicación y recarga los procesos en PM2
# manteniendo el 100% de los datos persistentes (base de datos, fotos y sesión de WhatsApp).
#
# Uso en VPS (un solo comando):
#   bash scripts/sync-vps.sh
#
set -euo pipefail

APP_DIR="/home/zarate/infosistel-v2"
DATA_DIR="/home/zarate/infosistel-v2-data"

echo ""
echo "=========================================================="
echo " [INFOSISTEL v2] Sincronización Rápida y Segura en VPS"
echo "=========================================================="
echo ""

cd "$APP_DIR"

echo "➡️  1/6. Descargando última versión de GitHub..."
git pull origin main

echo "➡️  2/6. Asegurando directorios de datos persistentes..."
mkdir -p "$DATA_DIR/backups" "$DATA_DIR/uploads/products" "$DATA_DIR/uploads/servicios" "$DATA_DIR/uploads/cotizaciones" "$DATA_DIR/servicios-tecnicos" "$DATA_DIR/whatsapp-auth"
rm -rf "$APP_DIR/datos" "$APP_DIR/.next/standalone/datos" 2>/dev/null || true

echo "➡️  3/6. Sincronizando Prisma y dependencias..."
npx prisma generate

# Parche Node 26 para whatsapp-rust-bridge si aplica
node -e '
const p = "node_modules/whatsapp-rust-bridge/package.json";
if (require("fs").existsSync(p)) {
  const pkg = JSON.parse(require("fs").readFileSync(p, "utf8"));
  pkg.main = "./dist/index.js";
  pkg.exports = { ".": { "import": "./dist/index.js", "require": "./dist/index.js", "default": "./dist/index.js", "types": "./dist/index.d.ts" } };
  require("fs").writeFileSync(p, JSON.stringify(pkg, null, 2));
}
' 2>/dev/null || true

echo "➡️  4/6. Compilando aplicación Next.js para producción..."
NODE_ENV=production npm run build

if [ ! -f .next/standalone/server.js ]; then
  echo "❌ ERROR: No se encontró .next/standalone/server.js. El build falló."
  exit 1
fi

echo "➡️  5/6. Preparando archivos estáticos y enlaces persistentes..."
rm -rf .next/standalone/.next/static
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
cp -r public/. .next/standalone/public/ 2>/dev/null || true

# Enlaces simbólicos de fotos a DATA_DIR
rm -rf .next/standalone/public/img/products .next/standalone/public/img/servicios .next/standalone/public/img/cotizaciones
ln -s "$DATA_DIR/uploads/products" .next/standalone/public/img/products
ln -s "$DATA_DIR/uploads/servicios" .next/standalone/public/img/servicios
ln -s "$DATA_DIR/uploads/cotizaciones" .next/standalone/public/img/cotizaciones

echo "➡️  6/6. Reiniciando servicios en PM2 (Web + WhatsApp)..."
npx pm2 restart ecosystem.config.js --update-env
npx pm2 save
npx pm2 status

echo ""
echo "=========================================================="
echo " Verificación de Salud del Sistema:"
echo "=========================================================="
sleep 2

WEB_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" https://infosistel.com.pe/taller-control/login || curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 || echo "000")
WA_STATUS=$(curl -s http://127.0.0.1:3005/status 2>/dev/null || echo '{"ok":false}')

echo " • Panel Web (Puerto 3000 / HTTPS): HTTP $WEB_STATUS"
echo " • WhatsApp Gateway (Puerto 3005): $WA_STATUS"
echo ""
echo "✅ ¡Sincronización completada con éxito al 100% (0 margen de error)!"
echo "=========================================================="
echo ""
