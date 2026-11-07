#!/usr/bin/env bash
# ============================================================================
#  04-desplegar-app.sh — app + BD + PM2 + Nginx en la VM AZUL
# ============================================================================
#  Genera un .env de laboratorio (secretos aleatorios), prepara la BD SQLite
#  con datos ficticios, compila Next.js en modo standalone, lo levanta con
#  PM2 en 0.0.0.0:3000 e instala el Nginx del lab.
#
#  Uso:  bash scripts/lab/vps/04-desplegar-app.sh
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
DATA_DIR="${DATA_DIR:-$HOME/infosistel-v2-data}"
DOMAIN="${DOMAIN:-infosistel.lab}"

log()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[AVISO]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] && SUDO="sudo" || SUDO=""

# nvm, si se instaló Node por esa vía
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$APP_DIR"
[ -f package.json ] || die "No encuentro package.json en $APP_DIR."
command -v node >/dev/null || die "Falta Node.js. Ejecuta primero 00-instalar-base.sh."

log "Comprobando versión de Node"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<20||(a===20&&b<9)){console.error("Node >= 20.9 requerido");process.exit(1)}'
echo "Node $(node -v) / npm $(npm -v)"

log "Directorio de datos persistentes: $DATA_DIR"
mkdir -p "$DATA_DIR"/backups "$DATA_DIR"/uploads/{products,servicios,cotizaciones}
chmod 711 "$HOME"
chmod -R 755 "$DATA_DIR"/uploads

log "Preparando .env de laboratorio"
if [ -f .env ] && ! grep -q '^LAB_ENV=1' .env; then
  die "Ya existe un .env sin la marca LAB_ENV=1.
Este script es SOLO para la VM de laboratorio. Si de verdad es una VM de
pruebas, mueve el .env actual y vuelve a ejecutar:
  mv .env .env.bak.\$(date +%s)"
fi

if [ ! -f .env ]; then
  umask 077
  cat > .env <<EOF
# LAB ONLY — generado por scripts/lab/vps/04-desplegar-app.sh
LAB_ENV=1
DATABASE_URL="file:$DATA_DIR/dev.db"
JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')"
ENCRYPTION_KEY="$(openssl rand -hex 32)"
DNI_HMAC_SECRET="$(openssl rand -hex 32)"
LAB_ADMIN_USER="labadmin"
LAB_ADMIN_PASSWORD="$(openssl rand -hex 8)"
PRODUCT_IMAGES_DIR="$DATA_DIR/uploads/products"
SERVICE_PHOTOS_DIR="$DATA_DIR/uploads/servicios"
QUOTATION_PHOTOS_DIR="$DATA_DIR/uploads/cotizaciones"
COTIZACION_PHOTOS_DIR="$DATA_DIR/uploads/cotizaciones"
EOF
  chmod 600 .env
  echo "Generado .env nuevo con secretos aleatorios."
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

# La BD del lab debe ser absoluta: una ruta relativa se resolvería dentro de
# .next/standalone y se perdería en cada build.
export DATABASE_URL="file:$DATA_DIR/dev.db"
if ! grep -q "^DATABASE_URL=\"file:$DATA_DIR/dev.db\"" .env; then
  warn "Ajustando DATABASE_URL a ruta absoluta en .env"
  sed -i '/^DATABASE_URL=/d' .env
  printf 'DATABASE_URL="file:%s/dev.db"\n' "$DATA_DIR" >> .env
fi

if [ -z "${LAB_ADMIN_USER:-}" ] || [ -z "${LAB_ADMIN_PASSWORD:-}" ]; then
  {
    echo "LAB_ADMIN_USER=\"labadmin\""
    echo "LAB_ADMIN_PASSWORD=\"$(openssl rand -hex 8)\""
  } >> .env
  set -a; . ./.env; set +a
fi

log "Preparando base de datos"
DB_PATH="$DATA_DIR/dev.db"
if [ ! -f "$DB_PATH" ]; then
  if [ -f "$APP_DIR/dev.db" ]; then
    cp "$APP_DIR/dev.db" "$DB_PATH"
    echo "Copiada la BD de desarrollo del repo (sin PII real) a $DB_PATH"
  else
    touch "$DB_PATH"
  fi
fi
chmod 600 "$DB_PATH"

log "Instalando dependencias (npm ci)"
npm ci --no-audit --no-fund

log "Generando Prisma Client y sincronizando esquema"
npx prisma generate
# El esquema de v2 tuvo cambios aplicados con db push en el VPS (p. ej.
# Admin.tokenVersion) que no están todos en migraciones versionadas. En una
# BD desechable de laboratorio, db push garantiza que coincida exactamente.
npx prisma db push

log "Sembrando datos ficticios (admin, producto, pedido, reparación)"
npx tsx scripts/lab/vps/sembrar-datos-lab.ts

log "Compilando Next.js (standalone)"
NODE_ENV=production npm run build
[ -f .next/standalone/server.js ] || die "El build no generó .next/standalone/server.js"

log "Levantando la app con PM2"
pm2 delete infosistel-v2 >/dev/null 2>&1 || true
pm2 start ecosystem.config.js --update-env
pm2 save
pm2 list

log "Instalando Nginx del laboratorio"
TPL="$APP_DIR/scripts/lab/vps/nginx-infosistel-lab.conf"
[ -f "$TPL" ] || die "Falta $TPL"
SITE=/etc/nginx/sites-available/infosistel-lab
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__DATA_DIR__|$DATA_DIR|g" "$TPL" | $SUDO tee "$SITE" >/dev/null
$SUDO ln -sf "$SITE" /etc/nginx/sites-enabled/infosistel-lab
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO nginx -t
$SUDO systemctl reload nginx

log "Smoke test local (Nginx -> PM2)"
sleep 2
code="$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" || true)"
echo "GET https://$DOMAIN/ -> HTTP $code"
if [ "$code" != "200" ]; then
  warn "La app no respondió 200. Revisa: pm2 logs infosistel-v2 --lines 40"
fi

cat <<EOF

============================================================
  LABORATORIO LISTO
============================================================
URL panel:  https://$DOMAIN/taller-control/login
Usuario:    $LAB_ADMIN_USER
Contraseña: $LAB_ADMIN_PASSWORD
BD:         $DB_PATH (modo 600)
Datos:      1 producto con costPrice, 1 pedido y 1 reparación ficticios

Para que PM2 arranque solo tras reiniciar la VM:
  pm2 startup
  # ejecuta el comando 'sudo env PATH=...' que imprime y luego:
  pm2 save

Siguiente paso (con la consola de la VM abierta):
  bash scripts/lab/vps/02-ssh-firewall.sh
  bash scripts/lab/vps/03-fail2ban.sh
============================================================
EOF
