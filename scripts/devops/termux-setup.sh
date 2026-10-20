#!/usr/bin/env bash
# scripts/devops/termux-setup.sh
#
# Configura Termux (o Arch Linux en Termux) en tu celular Android
# para enviar prompts y desplegar en producción con un solo comando:
#   ship "tu idea o ajuste aquí"
#
set -euo pipefail

echo "=================================================="
echo "📱 INFOSISTEL v2 - Configuración DevOps para Celular"
echo "=================================================="
echo ""

# 1. Detectar gestor de paquetes (Termux nativo vs Arch proot)
if command -v pacman >/dev/null 2>&1; then
  PKG_MGR="pacman"
  echo "✔ Detectado entorno: Arch Linux (pacman)"
elif command -v pkg >/dev/null 2>&1; then
  PKG_MGR="pkg"
  echo "✔ Detectado entorno: Termux nativo (pkg)"
else
  echo "⚠ No se detectó pkg ni pacman. Asegúrate de estar en Termux."
  PKG_MGR="generic"
fi

# 2. Instalar openssh si no existe
if ! command -v ssh >/dev/null 2>&1; then
  echo "Instalando OpenSSH..."
  if [ "$PKG_MGR" = "pacman" ]; then
    sudo pacman -Sy --noconfirm openssh
  elif [ "$PKG_MGR" = "pkg" ]; then
    pkg update -y && pkg install -y openssh
  fi
fi

# 3. Generar clave SSH si no existe
mkdir -p ~/.ssh
chmod 700 ~/.ssh
if [ ! -f ~/.ssh/id_ed25519 ]; then
  echo "Generando clave SSH en tu celular..."
  ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
  echo "✔ Clave SSH creada."
fi

# 4. Solicitar datos de conexión del VPS
echo ""
echo "Ingresa los datos de tu VPS (o presiona ENTER para los valores por defecto):"
read -r -p "Usuario VPS [zarate]: " VPS_USER_INPUT
VPS_USER="${VPS_USER_INPUT:-zarate}"

read -r -p "IP o Dominio de tu VPS: " VPS_HOST_INPUT
while [ -z "$VPS_HOST_INPUT" ]; do
  echo "El host o IP del VPS es requerido."
  read -r -p "IP o Dominio de tu VPS: " VPS_HOST_INPUT
done
VPS_HOST="$VPS_HOST_INPUT"

read -r -p "Puerto SSH [22]: " VPS_PORT_INPUT
VPS_PORT="${VPS_PORT_INPUT:-22}"

read -r -p "Ruta del proyecto en VPS [/home/zarate/infosistel-v2]: " VPS_PATH_INPUT
VPS_PATH="${VPS_PATH_INPUT:-/home/zarate/infosistel-v2}"

# 5. Copiar clave pública al VPS (ssh-copy-id)
echo ""
echo "Copiando clave SSH al VPS para no tener que escribir contraseña nunca más..."
ssh-copy-id -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" || true

# 6. Crear comando alias global 'ship'
RC_FILE="$HOME/.bashrc"
if [ -f "$HOME/.zshrc" ]; then
  RC_FILE="$HOME/.zshrc"
fi

# Remover definición previa si existe
sed -i '/# INFOSISTEL_SHIP_START/,/# INFOSISTEL_SHIP_END/d' "$RC_FILE" 2>/dev/null || true

cat << 'EOF' >> "$RC_FILE"
# INFOSISTEL_SHIP_START
function ship() {
  if [ -z "$1" ]; then
    echo "Uso: ship \"mi idea o ajuste\""
    return 1
  fi
  local PROMPT_ESCAPED
  PROMPT_ESCAPED=$(printf '%q' "$*")
  ssh -t -p __VPS_PORT__ __VPS_USER__@__VPS_HOST__ "cd __VPS_PATH__ && npx tsx scripts/devops/ship.ts $PROMPT_ESCAPED"
}
# INFOSISTEL_SHIP_END
EOF

sed -i "s|__VPS_PORT__|$VPS_PORT|g" "$RC_FILE"
sed -i "s|__VPS_USER__|$VPS_USER|g" "$RC_FILE"
sed -i "s|__VPS_HOST__|$VPS_HOST|g" "$RC_FILE"
sed -i "s|__VPS_PATH__|$VPS_PATH|g" "$RC_FILE"

echo ""
echo "=================================================="
echo "🎉 ¡CONFIGURACIÓN COMPLETADA CON ÉXITO!"
echo "=================================================="
echo ""
echo "Para activar el comando en tu sesión actual, ejecuta:"
echo "  source $RC_FILE"
echo ""
echo "Desde ahora, en tu celular solo tienes que escribir:"
echo "  ship \"agrega tal cambio en la tienda\""
echo "=================================================="
