#!/usr/bin/env bash
# ============================================================================
#  03-fail2ban.sh — jail sshd sobre el puerto 2244
# ============================================================================
#  Réplica de la Fase 5: 4 intentos fallidos en 10 minutos = 1 hora de ban.
#  Se usa el backend systemd para no depender de /var/log/auth.log.
#
#  Uso:  bash scripts/lab/vps/03-fail2ban.sh
# ============================================================================
set -euo pipefail

SSH_PORT="${SSH_PORT:-2244}"

log()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] && SUDO="sudo" || SUDO=""

log "Instalando backend systemd para Fail2ban"
$SUDO DEBIAN_FRONTEND=noninteractive apt install -y python3-systemd >/dev/null

log "Escribiendo jail de laboratorio"
$SUDO tee /etc/fail2ban/jail.d/infosistel-lab.local >/dev/null <<EOF
# INFOSISTEL LAB — Fase 5 (réplica). No editar a mano.
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 4
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled  = true
port     = $SSH_PORT
filter   = sshd
backend  = systemd
journalmatch = _SYSTEMD_UNIT=ssh.service + _SYSTEMD_UNIT=sshd.service
EOF

log "Validando y reiniciando Fail2ban"
$SUDO fail2ban-client -t
$SUDO systemctl enable --now fail2ban
$SUDO systemctl restart fail2ban
sleep 2
$SUDO fail2ban-client status
$SUDO fail2ban-client status sshd || true

cat <<EOF

Jail activa en el puerto $SSH_PORT.

Prueba de fuerza bruta DESDE LA VM NEGRA:
  printf '123456\\nadmin\\npassword\\nqwerty\\n' > /tmp/pass.txt
  hydra -l kali -P /tmp/pass.txt -t 4 ssh://10.10.10.20:$SSH_PORT

Tras 4 fallos, la IP 10.10.10.10 queda baneada 1 hora. Verifícalo en la
CONSOLA de la VM azul (por SSH ya no entrarías):
  sudo fail2ban-client status sshd
  sudo iptables -S | grep -i f2b || sudo nft list ruleset | grep -A3 f2b

Para desbanear y seguir con la demo:
  sudo fail2ban-client set sshd unbanip 10.10.10.10
EOF
