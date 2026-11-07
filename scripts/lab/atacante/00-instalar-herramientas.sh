#!/usr/bin/env bash
# ============================================================================
#  00-instalar-herramientas.sh — VM NEGRA (atacante, 10.10.10.10)
# ============================================================================
#  Instala nmap, nikto, sqlmap, hydra, whatweb, ZAP y testssl.sh; agrega el
#  dominio del lab a /etc/hosts e intenta instalar la CA del servidor para
#  que curl y el navegador no protesten por el certificado.
#
#  Uso:  bash scripts/lab/atacante/00-instalar-herramientas.sh
# ============================================================================
set -euo pipefail

VPS_IP="${VPS_IP:-10.10.10.20}"
DOMAIN="${DOMAIN:-infosistel.lab}"
LAB_USER="${LAB_USER:-kali}"

log()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[AVISO]\033[0m %s\n' "$*"; }

[ "$(id -u)" -ne 0 ] && SUDO="sudo" || SUDO=""

log "Actualizando índices"
$SUDO apt update

log "Instalando herramientas"
$SUDO DEBIAN_FRONTEND=noninteractive apt install -y \
  nmap nikto sqlmap hydra whatweb zaproxy testssl.sh \
  jq curl openssl netcat-openbsd ca-certificates

log "Agregando $DOMAIN a /etc/hosts"
if ! grep -q "[[:space:]]$DOMAIN" /etc/hosts; then
  echo "$VPS_IP $DOMAIN www.$DOMAIN" | $SUDO tee -a /etc/hosts >/dev/null
  echo "Agregado: $VPS_IP $DOMAIN www.$DOMAIN"
else
  echo "Ya existe una entrada para $DOMAIN (revísala si la IP cambió)."
fi

log "Instalando la CA del laboratorio (si se puede copiar)"
if scp -P 2244 -o StrictHostKeyChecking=accept-new \
     "$LAB_USER@$VPS_IP:/etc/nginx/ssl/infosistel-lab-ca.crt" /tmp/infosistel-lab-ca.crt 2>/dev/null; then
  $SUDO cp /tmp/infosistel-lab-ca.crt /usr/local/share/ca-certificates/
  $SUDO update-ca-certificates
  echo "CA instalada: curl ya no necesita -k."
else
  warn "No se pudo copiar la CA (¿SSH en 2244 y llave configurada?)."
  cat <<EOF
Puedes hacerlo a mano:
  scp -P 2244 $LAB_USER@$VPS_IP:/etc/nginx/ssl/infosistel-lab-ca.crt /tmp/
  sudo cp /tmp/infosistel-lab-ca.crt /usr/local/share/ca-certificates/
  sudo update-ca-certificates
Mientras tanto, los scripts usan 'curl -k'.
EOF
fi

log "Comprobando herramientas"
for t in nmap nikto sqlmap hydra whatweb zap-baseline.py testssl.sh jq curl openssl nc; do
  if command -v "$t" >/dev/null 2>&1; then
    printf '  OK   %s\n' "$t"
  else
    printf '  FALTA %s\n' "$t"
  fi
done

log "Conectividad con el VPS simulado"
curl -sk -o /dev/null -w "https://$DOMAIN/ -> HTTP %{http_code}\n" "https://$DOMAIN/" || true
ssh -p 2244 -o BatchMode=yes -o ConnectTimeout=5 "$LAB_USER@$VPS_IP" 'echo SSH OK' 2>/dev/null || \
  warn "SSH en 2244 aún no responde (normal si no has ejecutado 02-ssh-firewall.sh en la VM azul)."

cat <<'EOF'

Listo. Para ejecutar las pruebas necesitas este repositorio también en la
VM negra (o al menos la carpeta scripts/lab/atacante). Si clonaste el repo:

  cd ~/infosistelv2
  TARGET=https://infosistel.lab VPS_IP=10.10.10.20 \
    bash scripts/lab/atacante/correr-todo.sh
EOF
