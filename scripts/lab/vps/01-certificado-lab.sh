#!/usr/bin/env bash
# ============================================================================
#  01-certificado-lab.sh — CA y certificado TLS para infosistel.lab
# ============================================================================
#  Genera una CA local y un certificado de servidor con SAN para
#  infosistel.lab / www.infosistel.lab. No usa Let's Encrypt a propósito:
#  el lab es aislado y el dominio no existe en Internet. La rotación real
#  con certbot se muestra con la evidencia del VPS de producción.
#
#  Uso:  bash scripts/lab/vps/01-certificado-lab.sh
# ============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-infosistel.lab}"
SSL_DIR="${SSL_DIR:-/etc/nginx/ssl}"

log()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] && SUDO="sudo" || SUDO=""
command -v openssl >/dev/null || die "Falta openssl."

log "Creando $SSL_DIR"
$SUDO mkdir -p "$SSL_DIR"
$SUDO chmod 700 "$SSL_DIR"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log "Generando CA local (10 años)"
$SUDO openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout "$SSL_DIR/infosistel-lab-ca.key" \
  -out    "$SSL_DIR/infosistel-lab-ca.crt" \
  -days 3650 -sha256 \
  -subj "/C=PE/O=INFOSISTEL LAB/CN=INFOSISTEL Lab CA"

log "Generando llave y CSR del servidor"
$SUDO openssl req -newkey rsa:2048 -nodes \
  -keyout "$SSL_DIR/$DOMAIN.key" \
  -out    "$WORK/$DOMAIN.csr" \
  -subj "/C=PE/O=INFOSISTEL LAB/CN=$DOMAIN"

cat > "$WORK/san.cnf" <<EOF
subjectAltName = DNS:$DOMAIN, DNS:www.$DOMAIN, IP:10.10.10.20, IP:127.0.0.1
extendedKeyUsage = serverAuth
keyUsage = digitalSignature, keyEncipherment
basicConstraints = CA:FALSE
EOF

log "Firmando el certificado con la CA (825 días)"
$SUDO openssl x509 -req \
  -in "$WORK/$DOMAIN.csr" \
  -CA "$SSL_DIR/infosistel-lab-ca.crt" \
  -CAkey "$SSL_DIR/infosistel-lab-ca.key" \
  -CAcreateserial -CAserial "$WORK/ca.srl" \
  -out "$SSL_DIR/$DOMAIN.crt" \
  -days 825 -sha256 \
  -extfile "$WORK/san.cnf"

log "Construyendo fullchain y ajustando permisos"
$SUDO sh -c "cat '$SSL_DIR/$DOMAIN.crt' '$SSL_DIR/infosistel-lab-ca.crt' > '$SSL_DIR/$DOMAIN.fullchain.pem'"
$SUDO chmod 600 "$SSL_DIR"/*.key
$SUDO chmod 644 "$SSL_DIR"/*.crt "$SSL_DIR"/*.fullchain.pem

log "Verificando"
$SUDO openssl x509 -in "$SSL_DIR/$DOMAIN.crt" -noout -subject -issuer -dates -ext subjectAltName

cat <<EOF

Certificado listo:
  Servidor: $SSL_DIR/$DOMAIN.fullchain.pem
  Llave:    $SSL_DIR/$DOMAIN.key
  CA:       $SSL_DIR/infosistel-lab-ca.crt

Para que la VM atacante y los navegadores confíen en él:
  # En la VM negra
  scp -P 2244 $(whoami)@10.10.10.20:$SSL_DIR/infosistel-lab-ca.crt /tmp/
  sudo cp /tmp/infosistel-lab-ca.crt /usr/local/share/ca-certificates/
  sudo update-ca-certificates

Sin ese paso, usa 'curl -k' y acepta la advertencia del navegador.
EOF
