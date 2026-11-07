#!/usr/bin/env bash
# ============================================================================
#  correr-todo.sh — orquestador de pruebas desde la VM NEGRA
# ============================================================================
#  Ejecuta 01→08 (deja 04 al final porque satura el rate limit) y genera un
#  consolidado en evidencias/<fecha>/ con un RESUMEN.md.
#
#  Uso:
#    TARGET=https://infosistel.lab VPS_IP=10.10.10.20 \
#      bash scripts/lab/atacante/correr-todo.sh
#
#  Variables:
#    WAIT_RL=1   espera 65 s tras la prueba de rate limit (por defecto 0 aquí,
#                porque es la última prueba del recorrido)
# ============================================================================
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP="${STAMP:-$(date +%Y%m%d-%H%M%S)}"
EVID="${EVID:-$PWD/evidencias/$STAMP}"
mkdir -p "$EVID"
export STAMP EVID

LOG="$EVID/consolidado.log"
RESUMEN="$EVID/RESUMEN.md"
: > "$LOG"

echo "Target:       ${TARGET:-https://infosistel.lab}"
echo "VPS:          ${VPS_IP:-10.10.10.20}"
echo "Evidencias:   $EVID"
echo ""

# 04 al final: sus ráfagas dejan la IP limitada unos minutos.
ORDEN=(01 02 03 05 06 07 08 04)
rc=0

printf '# Resumen de pruebas — %s\n\n' "$STAMP" > "$RESUMEN"
printf 'Target: `%s` · VPS: `%s`\n\n' "${TARGET:-https://infosistel.lab}" "${VPS_IP:-10.10.10.20}" >> "$RESUMEN"
printf '| # | Prueba | PASS | FAIL | SKIP |\n|---|---|---:|---:|---:|\n' >> "$RESUMEN"

for n in "${ORDEN[@]}"; do
  f="$(ls "$DIR"/${n}-*.sh 2>/dev/null | head -1)"
  if [ -z "$f" ] || [ ! -f "$f" ]; then
    echo "  (falta el script $n)" | tee -a "$LOG"
    continue
  fi
  echo "" | tee -a "$LOG"
  echo "############################################################" | tee -a "$LOG"
  echo "#  $n — $(basename "$f")" | tee -a "$LOG"
  echo "############################################################" | tee -a "$LOG"

  if [ "$n" = "04" ]; then export WAIT_RL="${WAIT_RL:-0}"; fi
  bash "$f" > "$EVID/run-$n.log" 2>&1
  est=$?
  cat "$EVID/run-$n.log" | tee -a "$LOG"

  line="$(grep -o 'PASS=[0-9]* FAIL=[0-9]* SKIP=[0-9]*' "$EVID/run-$n.log" | tail -1)"
  p="$(printf '%s' "$line" | sed -n 's/.*PASS=\([0-9]*\).*/\1/p')"
  fa="$(printf '%s' "$line" | sed -n 's/.*FAIL=\([0-9]*\).*/\1/p')"
  sk="$(printf '%s' "$line" | sed -n 's/.*SKIP=\([0-9]*\).*/\1/p')"
  printf '| %s | `%s` | %s | %s | %s |\n' "$n" "$(basename "$f")" "${p:-?}" "${fa:-?}" "${sk:-?}" >> "$RESUMEN"

  [ "$est" -eq 0 ] || rc=1
done

{
  echo ""
  echo "Generado: $(date -Is)"
  echo ""
  echo "Archivos de evidencia:"
  ls -1 "$EVID" | sed 's/^/- /'
} >> "$RESUMEN"

echo ""
echo "============================================================"
if [ "$rc" -eq 0 ]; then
  echo "  RESULTADO GLOBAL: todas las pruebas pasaron"
else
  echo "  RESULTADO GLOBAL: hay pruebas con FAIL (revisar $LOG)"
fi
echo "  Consolidado: $LOG"
echo "  Resumen:     $RESUMEN"
echo "============================================================"

exit "$rc"
