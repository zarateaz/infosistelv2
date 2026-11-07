#!/usr/bin/env bash
# ============================================================================
#  06-verificar-invalidacion-sesion.sh — se ejecuta EN LA VM AZUL
# ============================================================================
#  Prueba real de V3.3.1 / V3.3.3:
#    1. Emite un JWT válido con el tokenVersion actual del admin.
#    2. Comprueba que abre /taller-control (200).
#    3. Incrementa Admin.tokenVersion en la BD (equivale a un logout).
#    4. El mismo JWT debe dejar de servir (307 al login).
#    5. Las APIs del panel también deben rechazarlo (401).
#
#  Uso:  bash scripts/lab/vps/06-verificar-invalidacion-sesion.sh
# ============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
EVID="${EVID:-$APP_DIR/evidencias/$(date +%Y%m%d-%H%M%S)-sesion}"
mkdir -p "$EVID"

PASS=0; FAIL=0; WARN=0
ok()   { PASS=$((PASS+1)); printf '  \033[1;32mPASS\033[0m  %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[1;31mFAIL\033[0m  %s\n' "$*"; }
warn() { WARN=$((WARN+1)); printf '  \033[1;33mWARN\033[0m  %s\n' "$*"; }
sec()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$APP_DIR" || exit 1
[ -f .env ] || { echo "No existe .env en $APP_DIR"; exit 1; }
set -a; # shellcheck disable=SC1091
. ./.env; set +a

DB_PATH="${DB_PATH:-${DATABASE_URL#file:}}"
[ -f "$DB_PATH" ] || DB_PATH="$HOME/infosistel-v2-data/dev.db"
[ -f "$DB_PATH" ] || { echo "No encuentro la BD en $DB_PATH"; exit 1; }

BASE="${BASE:-https://127.0.0.1}"

sec "0. Contexto"
echo "DB=$DB_PATH"
echo "Base=$BASE"

sec "1. Emitiendo un JWT válido con el tokenVersion actual"
row="$(sqlite3 -separator '|' "$DB_PATH" 'SELECT id, username, role, tokenVersion FROM Admin ORDER BY createdAt LIMIT 1;')"
if [ -z "$row" ]; then
  bad "No hay ningún Admin en la BD; ejecuta el seed"
  exit 1
fi
IFS='|' read -r admin_id admin_user admin_role admin_v <<< "$row"
echo "Admin=$admin_user ($admin_id), tokenVersion=$admin_v"

token="$(npx tsx scripts/lab/vps/generar-jwt.ts "$admin_id" "$admin_user" "$admin_role" "$admin_v" 2>"$EVID/jwt-error.txt")"
if [ -z "$token" ]; then
  bad "No se pudo generar el JWT (ver $EVID/jwt-error.txt)"
  exit 1
fi
echo "$token" > "$EVID/jwt-generado.txt"
ok "JWT emitido (${#token} caracteres)"

sec "2. El JWT válido abre el panel"
before="$(curl -sk -o /dev/null -w '%{http_code}' -H "Cookie: infosistel_session=$token" "$BASE/taller-control" || true)"
echo "GET /taller-control -> HTTP $before"
[ "$before" = "200" ] && ok "El token válido entra al panel" || bad "El token válido no entró (HTTP $before)"

sec "3. Invalidación: incrementar tokenVersion (logout del lado servidor)"
sqlite3 "$DB_PATH" "UPDATE Admin SET tokenVersion = tokenVersion + 1 WHERE id = '$admin_id';"
new_v="$(sqlite3 "$DB_PATH" "SELECT tokenVersion FROM Admin WHERE id = '$admin_id';")"
echo "tokenVersion: $admin_v -> $new_v"

sec "4. El mismo JWT ya no debe servir"
after="$(curl -sk -o /dev/null -w '%{http_code}' -H "Cookie: infosistel_session=$token" "$BASE/taller-control" || true)"
loc="$(curl -skI -H "Cookie: infosistel_session=$token" "$BASE/taller-control" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}' | head -1)"
echo "GET /taller-control -> HTTP $after (Location: ${loc:-N/A})"
if [ "$after" = "307" ] || [ "$after" = "302" ] || [ "$after" = "303" ]; then
  ok "El token viejo fue rechazado y redirige al login"
else
  bad "El token viejo SIGUE sirviendo (HTTP $after) — V3.3.1 no se cumple"
fi

sec "5. APIs del panel con el token viejo"
code="$(curl -sk -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -H "Cookie: infosistel_session=$token" -d '{}' "$BASE/api/admin-chat" || true)"
echo "POST /api/admin-chat -> HTTP $code"
[ "$code" = "401" ] && ok "admin-chat rechaza el token viejo" || bad "admin-chat aceptó el token viejo (HTTP $code)"

code="$(curl -sk -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -H "Cookie: infosistel_session=$token" -d '{}' "$BASE/api/scanner" || true)"
echo "POST /api/scanner -> HTTP $code"
[ "$code" = "401" ] && ok "scanner rechaza el token viejo" || bad "scanner aceptó el token viejo (HTTP $code)"

{
  echo "admin=$admin_user id=$admin_id"
  echo "tokenVersion_antes=$admin_v tokenVersion_despues=$new_v"
  echo "panel_antes=$before panel_despues=$after location=${loc:-N/A}"
  echo "fecha=$(date -Is)"
} > "$EVID/resumen-invalidacion.txt"

sec "RESUMEN"
echo "PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
echo "Evidencias en: $EVID"
echo ""
echo "Nota: el tokenVersion del admin quedó incrementado. Vuelve a iniciar"
echo "sesión en el panel; el login emitirá un token con el valor nuevo."
[ "$FAIL" -eq 0 ] || exit 1
