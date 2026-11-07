#!/usr/bin/env bash
# ============================================================================
#  02-ssh-firewall.sh — SSH endurecido (2244, solo llave) + Firewalld
# ============================================================================
#  Réplica de la Fase 5: PermitRootLogin no, PasswordAuthentication no,
#  MaxAuthTries 4, puerto 2244, y Firewalld dejando solo 80/443/2244.
#
#  REQUISITO: ~/.ssh/authorized_keys del usuario debe tener al menos una
#  llave pública ANTES de ejecutar esto. Si no, el script aborta.
#
#  Uso:  bash scripts/lab/vps/02-ssh-firewall.sh
# ============================================================================
set -euo pipefail

SSH_PORT="${SSH_PORT:-2244}"
TARGET_USER="${SUDO_USER:-${USER}}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
DROPIN="/etc/ssh/sshd_config.d/99-infosistel-lab.conf"

log()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[AVISO]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] && SUDO="sudo" || SUDO=""

log "Comprobando llave pública de $TARGET_USER"
if [ ! -s "$TARGET_HOME/.ssh/authorized_keys" ]; then
  die "No existe $TARGET_HOME/.ssh/authorized_keys (o está vacío).
Desde la VM negra ejecuta primero:
  ssh-keygen -t ed25519
  ssh-copy-id $TARGET_USER@10.10.10.20
y vuelve a correr este script."
fi
echo "OK: $(wc -l < "$TARGET_HOME/.ssh/authorized_keys") llave(s) autorizada(s)."

log "Escribiendo drop-in de SSH"
$SUDO mkdir -p /etc/ssh/sshd_config.d
$SUDO tee "$DROPIN" >/dev/null <<EOF
# INFOSISTEL LAB — Fase 5 (réplica). No editar a mano.
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
MaxAuthTries 4
LoginGraceTime 20
X11Forwarding no
EOF

# Debian/Kali ya incluye sshd_config.d al inicio de sshd_config. Si no,
# lo agregamos para que el drop-in tenga efecto.
if ! grep -Eq '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d/\*\.conf' /etc/ssh/sshd_config; then
  warn "Agregando Include de sshd_config.d al inicio de sshd_config"
  $SUDO cp -a /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak.$(date +%s)"
  $SUDO sed -i '1i Include /etc/ssh/sshd_config.d/*.conf' /etc/ssh/sshd_config
fi

# Si el archivo principal fija Port 22 explícitamente, sshd escucharía en
# ambos puertos. Lo comentamos (con respaldo) para que solo quede 2244.
if grep -Eq '^[[:space:]]*Port[[:space:]]+22[[:space:]]*$' /etc/ssh/sshd_config; then
  warn "Comentando 'Port 22' del sshd_config principal"
  $SUDO cp -a /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak.$(date +%s)"
  $SUDO sed -i -E 's/^[[:space:]]*Port[[:space:]]+22[[:space:]]*$/# Port 22 deshabilitado por lab (Fase 5)/' /etc/ssh/sshd_config
fi

log "Validando configuración"
$SUDO sshd -t
$SUDO systemctl restart ssh
sleep 1
echo "Puertos que escucha sshd:"
$SUDO sshd -T | grep -i '^port ' || true
ss -tlnp 2>/dev/null | grep -E ":${SSH_PORT}|:22 " || true

log "Configurando Firewalld (80, 443, $SSH_PORT; sin 3000/3010)"
$SUDO systemctl enable --now firewalld
$SUDO firewall-cmd --permanent --zone=public --add-port="${SSH_PORT}/tcp" >/dev/null
$SUDO firewall-cmd --permanent --zone=public --add-service=http   >/dev/null
$SUDO firewall-cmd --permanent --zone=public --add-service=https  >/dev/null
$SUDO firewall-cmd --permanent --zone=public --remove-service=ssh >/dev/null 2>&1 || true
$SUDO firewall-cmd --reload >/dev/null
$SUDO firewall-cmd --list-all

cat <<EOF

Listo. La sesión SSH actual NO se corta, pero las nuevas conexiones deben usar:
  ssh -p $SSH_PORT $TARGET_USER@10.10.10.20

Prueba desde la VM negra:
  ssh -p $SSH_PORT $TARGET_USER@10.10.10.20            # debe entrar
  ssh -o PreferredAuthentications=password -p $SSH_PORT $TARGET_USER@10.10.10.20
                                                        # debe rechazar
  nmap -Pn -p 22,80,443,$SSH_PORT,3000,3010 10.10.10.20 # 22/3000/3010 cerrados

Si algo sale mal, abre la CONSOLA de la VM (no SSH) y ejecuta:
  sudo systemctl stop firewalld
  sudo sed -i 's/^Port $SSH_PORT/#Port $SSH_PORT/' $DROPIN
  sudo systemctl restart ssh
EOF
