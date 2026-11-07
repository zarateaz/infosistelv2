#!/usr/bin/env bash
# ============================================================================
#  02-tls.sh — ASVS V9.1.1 / V9.1.3
# ============================================================================
#  Comprueba que el servidor rechaza TLS 1.0/1.1 y acepta 1.2/1.3, revisa el
#  certificado y, si está instalado, ejecuta testssl.sh como evidencia extra.
#
#  Uso:  VPS_IP=10.10.10.20 DOMAIN=infosistel.lab bash 02-tls.sh
# ============================================================================
source "$(dirname "$0")/lib.sh"

section "02 · TLS: protocolos, certificado y HSTS"

tls_try() {
  local flag="$1"
  timeout 12 openssl s_client -connect "$VPS_IP:443" -servername "$DOMAIN" "$flag" \
    </dev/null 2>/dev/null | grep -q 'Protocol *: *TLSv'
}

if tls_try -tls1; then
  fail "TLS 1.0 ACEPTADO (debería estar deshabilitado)"
else
  pass "TLS 1.0 rechazado"
fi

if tls_try -tls1_1; then
  fail "TLS 1.1 ACEPTADO (debería estar deshabilitado)"
else
  pass "TLS 1.1 rechazado"
fi

if tls_try -tls1_2; then
  pass "TLS 1.2 aceptado"
else
  fail "TLS 1.2 rechazado (no debería)"
fi

if tls_try -tls1_3; then
  pass "TLS 1.3 aceptado"
else
  fail "TLS 1.3 rechazado (no debería)"
fi

section "Certificado del servidor"
{
  echo | openssl s_client -connect "$VPS_IP:443" -servername "$DOMAIN" 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
} | tee "$EVID/02-certificado.txt"

if grep -qi "DNS:$DOMAIN" "$EVID/02-certificado.txt"; then
  pass "El certificado incluye SAN para $DOMAIN"
else
  fail "El certificado no incluye SAN para $DOMAIN"
fi

section "HSTS"
req_get "$TARGET/" >/dev/null
check_hdr "HSTS presente en HTTPS" "strict-transport-security" "max-age=63072000"

section "testssl.sh (opcional)"
if command -v testssl.sh >/dev/null 2>&1; then
  testssl.sh --quiet --color 0 --protocols --headers "$TARGET" \
    > "$EVID/02-testssl.txt" 2>&1 || true
  echo "Reporte: $EVID/02-testssl.txt"
  grep -E "TLS 1|TLSv1|SSLv|HSTS" "$EVID/02-testssl.txt" | head -20 || true
  pass "testssl.sh ejecutado (revisar reporte)"
else
  skip "testssl.sh no instalado (sudo apt install testssl.sh)"
fi

summary
