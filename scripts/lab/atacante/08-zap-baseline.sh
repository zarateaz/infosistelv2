#!/usr/bin/env bash
# ============================================================================
#  08-zap-baseline.sh — escaneo pasivo OWASP ZAP
# ============================================================================
#  Ejecuta el baseline scan (pasivo) y guarda el reporte HTML/JSON como
#  evidencia. No hace ataques activos: complementa a los scripts 01–07.
#
#  Uso:  TARGET=https://infosistel.lab bash 08-zap-baseline.sh
# ============================================================================
source "$(dirname "$0")/lib.sh"

section "08 · OWASP ZAP baseline scan (pasivo)"

if command -v zap-baseline.py >/dev/null 2>&1; then
  ZAP="zap-baseline.py"
elif [ -x /usr/share/zaproxy/zap-baseline.py ]; then
  ZAP="/usr/share/zaproxy/zap-baseline.py"
elif command -v zaproxy >/dev/null 2>&1; then
  ZAP=""
  skip "zaproxy está instalado pero no se encontró zap-baseline.py"
else
  ZAP=""
  skip "ZAP no instalado (sudo apt install zaproxy)"
fi

if [ -n "${ZAP:-}" ]; then
  info "Ejecutando $ZAP contra $TARGET (puede tardar 2–5 min)..."
  # -I: no devolver exit 2 solo por warnings (guardamos el reporte igual).
  "$ZAP" -t "$TARGET" \
    -r "$EVID/08-zap-report.html" \
    -J "$EVID/08-zap-report.json" \
    -w "$EVID/08-zap-warnings.md" \
    -I > "$EVID/08-zap-stdout.txt" 2>&1 || true

  if [ -s "$EVID/08-zap-report.html" ]; then
    pass "Reporte HTML generado: $EVID/08-zap-report.html"
  else
    fail "No se generó el reporte HTML (ver 08-zap-stdout.txt)"
  fi

  if [ -s "$EVID/08-zap-report.json" ]; then
    pass "Reporte JSON generado"
    if command -v jq >/dev/null 2>&1; then
      jq -r '.site[0].alerts[]? | "\(.riskdesc) — \(.name)"' "$EVID/08-zap-report.json" \
        | sort | uniq -c | sort -nr | head -20 | tee "$EVID/08-zap-resumen.txt" || true
    fi
  fi
fi

cat <<'EOF'

Lectura del reporte para la exposición:
  - Un baseline de ZAP no "aprueba" ni "desaprueba": lista hallazgos pasivos.
  - Lo importante es comparar antes/después y explicar cada alerta:
      * cabeceras faltantes -> ya cubiertas por 01
      * cookies sin flags   -> ya cubiertas por 05 (manual)
      * información divulgada -> ya cubierta por 07
  - Adjunta el HTML como anexo de evidencia del Capítulo VI.
EOF

summary
