#!/usr/bin/env bash
# ============================================================================
#  04-rate-limit-y-filtros.sh — ASVS V2.2.1, V5, V13
# ============================================================================
#  Prueba, desde la VM atacante:
#    - payloads de inyección SQL -> 403 (Nginx / proxy de Next)
#    - User-Agents de sqlmap/Nikto/nmap -> 444 (conexión cerrada)
#    - sqlmap real con --random-agent (el UA cambia, el payload no pasa)
#    - ráfaga de 200 requests -> 429 (general 300 r/m, burst 80)
#    - ráfaga de 100 requests a /api/ -> 429 (60 r/m, burst 20)
#
#  Es la prueba más "ruidosa": déjala para el final y espera 65 s después.
#
#  Uso:  TARGET=https://infosistel.lab bash 04-rate-limit-y-filtros.sh
# ============================================================================
source "$(dirname "$0")/lib.sh"

section "04 · Rate limiting y filtros perimetrales"

# --- Filtro Anti-SQLi -------------------------------------------------------
sqli_case() {
  local label="$1" qs="$2" file="$3"
  local code
  code="$(req_get "$TARGET/catalogo?$qs")"
  cp "$HDR"  "$EVID/04-sqli-$file-headers.txt"
  cp "$BODY" "$EVID/04-sqli-$file-body.txt"
  if [ "$code" = "403" ]; then
    if body_has "Solicitud bloqueada"; then
      pass "$label -> 403 (proxy de Next, ASVS V5)"
    else
      pass "$label -> 403 (Nginx, filtro de query string)"
    fi
  else
    fail "$label -> HTTP ${code:-sin respuesta} (esperado 403)"
  fi
}

section "Payloads de inyección SQL (V5)"
sqli_case "Comilla simple en id"            "id=1%27"                          "comilla"
sqli_case "UNION SELECT con %20"            "id=1%20UNION%20SELECT%201"        "union-20"
sqli_case "UNION SELECT con +"              "id=1+UNION+SELECT+1"              "union-plus"
sqli_case "Comentario SQL --"               "id=1%27--"                        "comentario"
sqli_case "OR 1=1 clásico"                  "q=%27%20OR%20%271%27%3D%271"      "or-1-1"
sqli_case "Time-based SLEEP(5)"             "q=1%20AND%20SLEEP(5)"             "sleep"

section "User-Agents de herramientas (H-03)"
ua_case() {
  local label="$1" ua="$2"
  local code
  code="$(curl -sk --max-time 10 -A "$ua" -o /dev/null -w '%{http_code}' "$TARGET/" 2>/dev/null || true)"
  if [ -z "$code" ] || [ "$code" = "000" ]; then
    pass "$label -> conexión cerrada (444)"
  else
    fail "$label -> HTTP $code (esperado 444 / conexión cerrada)"
  fi
}
ua_case "User-Agent sqlmap" "sqlmap/1.8"
ua_case "User-Agent Nikto"  "Nikto/2.5"
ua_case "User-Agent nmap"   "nmap"
ua_case "User-Agent vacío"  ""

section "sqlmap real con --random-agent"
if command -v sqlmap >/dev/null 2>&1; then
  timeout 180 sqlmap -u "$TARGET/catalogo?buscar=1" -p buscar \
    --batch --level=1 --risk=1 --random-agent --threads=1 \
    --timeout=10 --retries=0 --output-dir="$EVID/sqlmap" \
    > "$EVID/04-sqlmap.txt" 2>&1 || true
  echo "Salida: $EVID/04-sqlmap.txt"
  grep -E "403|Forbidden|not injectable|all tested parameters|blocked" "$EVID/04-sqlmap.txt" | head -10 || true
  pass "sqlmap ejecutado (revisar que todos los payloads fueron bloqueados)"
else
  skip "sqlmap no instalado"
fi

section "Métodos HTTP no permitidos"
for m in TRACE PUT OPTIONS; do
  code="$(curl -sk --max-time 10 -X "$m" -o /dev/null -w '%{http_code}' "$TARGET/" 2>/dev/null || true)"
  if [ "$code" = "405" ]; then
    pass "$m -> 405"
  else
    fail "$m -> HTTP ${code:-sin respuesta} (esperado 405)"
  fi
done

# --- Rate limiting ----------------------------------------------------------
burst() {
  local base="$1" n="$2" out="$3" i
  : > "$out"
  for i in $(seq 1 "$n"); do
    ( "${CURL[@]}" -o /dev/null -w '%{http_code}\n' "${base}?rl=${i}-${RANDOM}" >> "$out" 2>/dev/null ) &
    if (( i % 40 == 0 )); then wait; fi
  done
  wait
}

section "Rate limit general (300 r/m, burst 80)"
burst "$TARGET/" 200 "$EVID/04-rl-general.txt"
gen_total=$(wc -l < "$EVID/04-rl-general.txt" | tr -d ' ')
gen_429=$(grep -c '^429$' "$EVID/04-rl-general.txt" || true)
gen_200=$(grep -c '^200$' "$EVID/04-rl-general.txt" || true)
echo "requests=$gen_total  200=$gen_200  429=$gen_429"
if [ "$gen_429" -gt 0 ]; then
  pass "La ráfaga general recibe 429 ($gen_429 de $gen_total)"
else
  fail "No hubo 429 en la ráfaga general"
fi

section "Rate limit /api/ (60 r/m, burst 20)"
burst "$TARGET/api/chat" 100 "$EVID/04-rl-api.txt"
api_total=$(wc -l < "$EVID/04-rl-api.txt" | tr -d ' ')
api_429=$(grep -c '^429$' "$EVID/04-rl-api.txt" || true)
echo "requests=$api_total  429=$api_429"
if [ "$api_429" -gt 0 ]; then
  pass "La ráfaga a /api/ recibe 429 ($api_429 de $api_total)"
else
  fail "No hubo 429 en la ráfaga a /api/"
fi

{
  echo "general: total=$gen_total 200=$gen_200 429=$gen_429"
  echo "api:     total=$api_total 429=$api_429"
  echo "fecha:   $(date -Is)"
} > "$EVID/04-rate-limit.txt"

if [ "${WAIT_RL:-1}" != "0" ]; then
  info "Esperando 65 s para que Nginx reinicie la ventana de rate limit..."
  sleep 65
fi

summary
