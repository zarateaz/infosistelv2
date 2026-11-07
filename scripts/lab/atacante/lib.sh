#!/usr/bin/env bash
# ============================================================================
#  lib.sh — helpers comunes de las pruebas del atacante
#  Se hace `source`, no se ejecuta directamente.
# ============================================================================
set -uo pipefail

TARGET="${TARGET:-https://infosistel.lab}"
VPS_IP="${VPS_IP:-10.10.10.20}"
DOMAIN="${DOMAIN:-infosistel.lab}"
STAMP="${STAMP:-$(date +%Y%m%d-%H%M%S)}"
EVID="${EVID:-$PWD/evidencias/$STAMP}"
mkdir -p "$EVID"

CURL=(curl -sk --max-time 20 --connect-timeout 5)
BODY="$EVID/.body"
HDR="$EVID/.hdr"

PASS=0; FAIL=0; SKIP=0

if [ -t 1 ]; then
  C_OK=$'\033[1;32m'; C_BAD=$'\033[1;31m'; C_WARN=$'\033[1;33m'; C_INFO=$'\033[1;36m'; C_OFF=$'\033[0m'
else
  C_OK=""; C_BAD=""; C_WARN=""; C_INFO=""; C_OFF=""
fi

section() { printf '\n%s══ %s ══%s\n' "$C_INFO" "$*" "$C_OFF"; }
info()    { printf '  %s\n' "$*"; }
pass()    { PASS=$((PASS+1)); printf '  %sPASS%s  %s\n' "$C_OK" "$C_OFF" "$*"; }
fail()    { FAIL=$((FAIL+1)); printf '  %sFAIL%s  %s\n' "$C_BAD" "$C_OFF" "$*"; }
skip()    { SKIP=$((SKIP+1)); printf '  %sSKIP%s  %s\n' "$C_WARN" "$C_OFF" "$*"; }

# --- HTTP -------------------------------------------------------------------
req_get() {
  local url="$1"; shift
  : > "$HDR"; : > "$BODY"
  "${CURL[@]}" -D "$HDR" -o "$BODY" -w '%{http_code}' "$url" "$@" 2>/dev/null || true
}

req_post() {
  local url="$1" data="$2"; shift 2
  : > "$HDR"; : > "$BODY"
  "${CURL[@]}" -X POST -H 'Content-Type: application/json' -d "$data" \
    -D "$HDR" -o "$BODY" -w '%{http_code}' "$url" "$@" 2>/dev/null || true
}

hdr()       { grep -i "^$1:" "$HDR" 2>/dev/null | tr -d '\r' | head -1; }
hdr_value() { hdr "$1" | sed 's/^[^:]*:[[:space:]]*//'; }
body_has()  { grep -qi -- "$1" "$BODY" 2>/dev/null; }
body_count(){ grep -oi -- "$1" "$BODY" 2>/dev/null | wc -l | tr -d ' '; }

check_status() {
  local name="$1" exp="$2" got="$3"
  if [ "$got" = "$exp" ]; then pass "$name (HTTP $got)"; else fail "$name (HTTP ${got:-sin respuesta}, esperado $exp)"; fi
}

check_status_any() {
  local name="$1" exp="$2" got="$3"
  case " $exp " in
    *" $got "*) pass "$name (HTTP $got)" ;;
    *) fail "$name (HTTP ${got:-sin respuesta}, esperado uno de: $exp)" ;;
  esac
}

check_hdr() {
  local name="$1" header="$2" regex="$3" v
  v="$(hdr_value "$header")"
  if [ -n "$v" ] && printf '%s' "$v" | grep -Eqi -- "$regex"; then
    pass "$name"
  else
    fail "$name (cabecera $header: '${v:-ausente}')"
  fi
}

check_no_hdr() {
  local name="$1" header="$2" v
  v="$(hdr_value "$header")"
  if [ -z "$v" ]; then pass "$name"; else fail "$name (cabecera $header presente: '$v')"; fi
}

# --- Resumen ----------------------------------------------------------------
summary() {
  local file="$EVID/resumen-$(basename "$0" .sh).txt"
  {
    echo "Prueba: $(basename "$0")"
    echo "Fecha:  $(date -Is)"
    echo "Target: $TARGET ($VPS_IP)"
    echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  } > "$file"
  printf '\n%s── Resumen %s: PASS=%d FAIL=%d SKIP=%d ──%s\n' \
    "$C_INFO" "$(basename "$0")" "$PASS" "$FAIL" "$SKIP" "$C_OFF"
  echo "Evidencia: $EVID"
  [ "$FAIL" -eq 0 ]
}
