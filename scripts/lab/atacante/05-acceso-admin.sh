#!/usr/bin/env bash
# ============================================================================
#  05-acceso-admin.sh — ASVS V4.1.1, V4.1.5, V3
# ============================================================================
#  Comprueba que el panel no se puede abrir sin sesión, que las APIs del panel
#  responden 401 y que un JWT manipulado no sirve. Las pruebas de cookie,
#  fuerza bruta y MFA son manuales (se explican al final).
#
#  Uso:  TARGET=https://infosistel.lab bash 05-acceso-admin.sh
# ============================================================================
source "$(dirname "$0")/lib.sh"

section "05 · Control de acceso al panel y APIs"

code="$(req_get "$TARGET/taller-control")"
check_status "GET /taller-control sin sesión -> 307" 307 "$code"
loc="$(hdr_value Location)"
echo "Location: ${loc:-ausente}"
printf '%s' "$loc" | grep -qi '/taller-control/login' && pass "Redirige a /taller-control/login" || fail "No redirige al login"

code="$(req_get "$TARGET/taller-control/productos")"
check_status "GET /taller-control/productos sin sesión -> 307" 307 "$code"

code="$(req_get "$TARGET/taller-control/login")"
check_status "GET /taller-control/login -> 200" 200 "$code"

section "JWT manipulado / cookie inválida (V4.1.5)"
code="$(req_get "$TARGET/taller-control" -H 'Cookie: infosistel_session=aaa.bbb.ccc')"
check_status "Cookie basura -> 307 (falla de forma segura)" 307 "$code"

# JWT con alg:none y role superadmin, sin firma válida.
fake_payload='{"sub":"x","username":"atacante","role":"superadmin","v":0,"exp":9999999999}'
fake_payload_b64="$(printf '%s' "$fake_payload" | base64 -w0 | tr '+/' '-_' | tr -d '=')"
fake_jwt="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${fake_payload_b64}."
code="$(req_get "$TARGET/taller-control/usuarios" -H "Cookie: infosistel_session=$fake_jwt")"
check_status "JWT alg:none con role=superadmin -> 307" 307 "$code"

section "APIs del panel sin sesión (V4.1.1)"
code="$(req_post "$TARGET/api/scanner" '{}')"
check_status "POST /api/scanner sin sesión -> 401" 401 "$code"
code="$(req_post "$TARGET/api/admin-chat" '{}')"
check_status "POST /api/admin-chat sin sesión -> 401" 401 "$code"

section "CSP report (público por diseño)"
code="$(req_post "$TARGET/api/csp-report" '{"csp-report":{"blocked-uri":"inline"}}')"
check_status "POST /api/csp-report -> 204" 204 "$code"

cat <<'EOF'

────────────────────────────────────────────────────────────────────────────
PRUEBAS MANUALES (hazlas en el navegador de la VM negra, con Burp/ZAP)
────────────────────────────────────────────────────────────────────────────

A) Cookie de sesión (V3.2.1 / V3.2.2)
   1. Inicia sesión en /taller-control/login (usuario/contraseña + TOTP si
      está activo).
   2. DevTools → Application → Cookies → infosistel_session.
   3. Debe tener: HttpOnly ✓, Secure ✓, SameSite=Lax ✓, Expires ~8 h.
   4. Copia el JWT y decodifícalo en https://jwt.io: payload con sub,
      username, role, v y exp. La firma HS256 no se puede validar sin la clave.

B) Fuerza bruta al login (V2.2.1)
   1. Cierra sesión.
   2. Fallar 5 veces con contraseña incorrecta.
   3. El 6.º intento debe mostrar «Demasiadas solicitudes» / HTTP 429.
   4. Para repetir: pm2 restart infosistel-v2 en la VM azul (el limitador es
      en memoria).

C) Enumeración por tiempo (Fase 3)
   Mide con Burp Intruder (o con el cronómetro del navegador) el tiempo de
   respuesta para:
     - usuario existente + contraseña incorrecta
     - usuario inexistente + cualquier contraseña
   Deben ser similares: el código ejecuta scryptSync con una sal ficticia
   cuando el usuario no existe (burnPasswordCheckTime).

D) MFA (V4.3.1)
   1. En /taller-control/seguridad activa MFA y escanea el QR con una app
      TOTP (Aegis, Google Authenticator).
   2. Cierra sesión y vuelve a entrar: tras la contraseña debe pedir el
      código de 6 dígitos.
   3. Un código incorrecto no debe crear sesión.

E) Invalidación de sesión (V3.3.1 / V3.3.3)
   1. Copia la cookie actual.
   2. Cambia la contraseña (o usa «cerrar todas las sesiones» si está en la UI).
   3. La cookie vieja debe dejar de servir (tokenVersion cambia y el JWT
      anterior ya no valida).
   Alternativa automatizada y más contundente (en la VM azul):
     bash scripts/lab/vps/06-verificar-invalidacion-sesion.sh
   Emite un JWT válido, incrementa tokenVersion y comprueba que el panel
   responde 307 y las APIs 401 con ese mismo token.
EOF

summary
