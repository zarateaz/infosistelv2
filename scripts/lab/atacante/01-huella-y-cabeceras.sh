#!/usr/bin/env bash
# ============================================================================
#  01-huella-y-cabeceras.sh — ASVS V14.3.3, V14.4.3–V14.4.7
# ============================================================================
#  Comprueba las 5 cabeceras, HSTS, CSP con nonce por request y que no se
#  exponga el framework ni la versión de Nginx.
#
#  Uso:  TARGET=https://infosistel.lab bash 01-huella-y-cabeceras.sh
# ============================================================================
source "$(dirname "$0")/lib.sh"

section "01 · Huella y cabeceras HTTP"

code="$(req_get "$TARGET/")"
check_status "GET / responde 200" 200 "$code"
cp "$HDR" "$EVID/01-headers-home.txt"
cp "$BODY" "$EVID/01-body-home.html"

section "Cabeceras de seguridad (V14.4)"
check_hdr "HSTS presente y con max-age de 2 años" "strict-transport-security" "max-age=63072000"
check_hdr "HSTS incluye subdominios y preload"     "strict-transport-security" "includeSubDomains.*preload"
check_hdr "X-Content-Type-Options: nosniff"        "x-content-type-options" "nosniff"
check_hdr "X-Frame-Options: DENY"                  "x-frame-options" "^DENY$"
check_hdr "Referrer-Policy adecuada"               "referrer-policy" "strict-origin-when-cross-origin"
check_hdr "Permissions-Policy sin cámara por defecto" "permissions-policy" "camera=\(\)"

section "Huella del servidor (V14.3.3)"
check_no_hdr "Sin X-Powered-By" "x-powered-by"
server="$(hdr_value Server)"
if [ -n "$server" ]; then
  if printf '%s' "$server" | grep -Eq '[0-9]+\.[0-9]+'; then
    fail "Server expone versión: '$server'"
  else
    pass "Server sin número de versión: '$server'"
  fi
else
  pass "Sin cabecera Server"
fi

section "Content-Security-Policy (V14.4.3)"
csp="$(hdr_value content-security-policy)"
if [ -n "$csp" ]; then
  pass "CSP presente"
  printf '%s\n' "$csp" > "$EVID/01-csp.txt"
else
  fail "CSP ausente"
fi

script_src="$(printf '%s' "$csp" | sed -n 's/.*script-src\([^;]*\).*/\1/p')"
if printf '%s' "$script_src" | grep -qi "unsafe-inline"; then
  fail "script-src contiene 'unsafe-inline'"
else
  pass "script-src NO contiene 'unsafe-inline'"
fi
printf '%s' "$script_src" | grep -qi "strict-dynamic" && pass "script-src usa 'strict-dynamic'" || fail "script-src sin 'strict-dynamic'"
printf '%s' "$csp" | grep -qi "object-src 'none'"        && pass "object-src 'none'"        || fail "object-src distinto de 'none'"
printf '%s' "$csp" | grep -qi "frame-ancestors 'none'"  && pass "frame-ancestors 'none'"  || fail "frame-ancestors distinto de 'none'"
printf '%s' "$csp" | grep -qi "base-uri 'self'"         && pass "base-uri 'self'"         || fail "base-uri distinto de 'self'"

section "Nonce distinto en cada request"
n1="$(printf '%s' "$csp" | grep -o 'nonce-[A-Za-z0-9+/=]*' | head -1)"
req_get "$TARGET/" >/dev/null
n2="$(hdr_value content-security-policy | grep -o 'nonce-[A-Za-z0-9+/=]*' | head -1)"
echo "nonce 1: $n1"
echo "nonce 2: $n2"
if [ -n "$n1" ] && [ -n "$n2" ] && [ "$n1" != "$n2" ]; then
  pass "El nonce cambia entre requests"
else
  fail "El nonce no cambia (o falta)"
fi

section "HSTS también en respuestas de error"
code="$(req_get "$TARGET/ruta-que-no-existe-$RANDOM")"
check_status_any "404 controlado" "404 403 200" "$code"
check_hdr "HSTS en respuesta de error" "strict-transport-security" "max-age=63072000"

section "Redirección HTTP → HTTPS (V9.1.1)"
code="$(req_get "http://$DOMAIN/")"
check_status_any "HTTP redirige" "301 302 308" "$code"
loc="$(hdr_value Location)"
echo "Location: ${loc:-ausente}"
printf '%s' "$loc" | grep -qi '^https://' && pass "Location apunta a HTTPS" || fail "Location no apunta a HTTPS"

summary
