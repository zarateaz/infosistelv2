#!/usr/bin/env bash
# ============================================================================
#  00-instalar-base.sh — VM AZUL (VPS simulado, 10.10.10.20)
# ============================================================================
#  Instala y deja listos (sin activar Firewalld todavía) los servicios que
#  sostienen la réplica del VPS: Nginx, Node.js, PM2, SSH, Fail2ban,
#  Firewalld, SQLite y herramientas de compilación.
#
#  Uso:  bash scripts/lab/vps/00-instalar-base.sh
# ============================================================================
set -euo pipefail

log()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[AVISO]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] && SUDO="sudo" || SUDO=""
command -v apt >/dev/null || die "Este script asume Debian/Kali (apt)."

log "Actualizando índices de paquetes"
$SUDO apt update

log "Instalando servicios base"
$SUDO DEBIAN_FRONTEND=noninteractive apt install -y \
  nginx openssh-server fail2ban firewalld \
  sqlite3 curl jq openssl ca-certificates \
  build-essential python3 rsyslog

# Kali suele traer ufw; Firewalld y ufw no deben convivir.
if systemctl list-unit-files 2>/dev/null | grep -q '^ufw\.service'; then
  $SUDO systemctl disable --now ufw 2>/dev/null || true
  warn "ufw deshabilitado para usar Firewalld."
fi

log "Verificando Node.js (Next.js 16 exige >= 20.9; se recomienda 22 LTS)"
need_node=1
if command -v node >/dev/null; then
  major="$(node -p 'process.versions.node.split(".")[0]')"
  minor="$(node -p 'process.versions.node.split(".")[1]')"
  if [ "$major" -gt 20 ] || { [ "$major" -eq 20 ] && [ "$minor" -ge 9 ]; }; then
    need_node=0
    echo "Node detectado: $(node -v)"
  else
    warn "Node $(node -v) es demasiado antiguo."
  fi
fi

if [ "$need_node" -eq 1 ]; then
  log "Instalando Node 22 LTS con nvm"
  export NVM_DIR="$HOME/.nvm"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm alias default 22
  nvm use 22
  warn "Abre una terminal nueva (o ejecuta 'source ~/.bashrc') para que nvm quede en el PATH."
fi

log "Instalando PM2"
if ! command -v pm2 >/dev/null; then
  npm install -g pm2 || $SUDO npm install -g pm2
fi
pm2 -v

log "Habilitando Nginx y SSH (sin tocar aún el puerto 22)"
$SUDO systemctl enable --now nginx
$SUDO systemctl enable --now ssh

log "Comprobaciones"
nginx -v 2>&1
ss -tlnp 2>/dev/null | grep -E ':22|:80|:443' || true
node -v
npm -v

cat <<'EOF'

Siguiente paso:
  bash scripts/lab/vps/01-certificado-lab.sh
  bash scripts/lab/vps/04-desplegar-app.sh

IMPORTANTE: NO ejecutes todavía 02-ssh-firewall.sh hasta tener una llave
pública copiada a ~/.ssh/authorized_keys (el script se niega a deshabilitar
la contraseña si no la encuentra).
EOF
