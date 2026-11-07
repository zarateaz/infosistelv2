#!/usr/bin/env bash
# ============================================================================
#  03-puertos.sh — Fase 5: superficie de red (NIST SP 800-123)
# ============================================================================
#  Desde la VM atacante: 22 cerrado, 3000/3010 cerrados, 80/443/2244 abiertos.
#  Además intenta llegar directo a Node para demostrar que Firewalld lo impide.
#
#  Uso:  VPS_IP=10.10.10.20 bash 03-puertos.sh
# ============================================================================
source "$(dirname "$0")/lib.sh"

section "03 · Superficie de red (nmap)"

if ! command -v nmap >/dev/null 2>&1; then
  skip "nmap no instalado (sudo apt install nmap)"
  summary; exit $?
fi

nmap -Pn -sT -p 22,80,443,2244,3000,3010 --reason "$VPS_IP" \
  -oN "$EVID/03-nmap.txt" | tee "$EVID/03-nmap-stdout.txt"

port_state() {
  local p="$1"
  awk -v p="$p/tcp" '$1==p {print $2}' "$EVID/03-nmap.txt" | head -1
}

state_80="$(port_state 80)"
state_443="$(port_state 443)"
state_2244="$(port_state 2244)"
state_22="$(port_state 22)"
state_3000="$(port_state 3000)"
state_3010="$(port_state 3010)"

echo ""
echo "80=$state_80  443=$state_443  2244=$state_2244  22=$state_22  3000=$state_3000  3010=$state_3010"

[ "$state_80" = "open" ]   && pass "80/tcp abierto (redirige a HTTPS)" || fail "80/tcp en estado '$state_80'"
[ "$state_443" = "open" ]  && pass "443/tcp abierto (Nginx TLS)"       || fail "443/tcp en estado '$state_443'"
[ "$state_2244" = "open" ] && pass "2244/tcp abierto (SSH del lab)"    || fail "2244/tcp en estado '$state_2244'"

case "$state_22" in
  open) fail "22/tcp ABIERTO (SSH debería estar en 2244)" ;;
  *)    pass "22/tcp no accesible ($state_22)" ;;
esac

case "$state_3000" in
  open) fail "3000/tcp ABIERTO (Node expuesto)" ;;
  *)    pass "3000/tcp no accesible ($state_3000)" ;;
esac

case "$state_3010" in
  open) fail "3010/tcp ABIERTO (Node expuesto)" ;;
  *)    pass "3010/tcp no accesible ($state_3010)" ;;
esac

section "Acceso directo a Node (defensa en profundidad)"
if curl -s --max-time 8 -o /dev/null "http://$VPS_IP:3000/" 2>/dev/null; then
  fail "Node responde directo en :3000 — Firewalld no está filtrando"
else
  pass "Node no responde directo en :3000 (Firewalld)"
fi

if curl -s --max-time 8 -o /dev/null "http://$VPS_IP:3010/" 2>/dev/null; then
  fail "Node responde directo en :3010"
else
  pass "Node no responde directo en :3010"
fi

section "Servicio SSH en 2244"
if command -v nc >/dev/null 2>&1; then
  banner="$(timeout 5 nc -w 3 "$VPS_IP" 2244 </dev/null 2>/dev/null | head -1 || true)"
  if printf '%s' "$banner" | grep -qi '^SSH-'; then
    pass "Banner SSH en 2244: ${banner:0:40}..."
  else
    fail "No se obtuvo banner SSH en 2244"
  fi
else
  skip "nc no instalado; se omite el banner SSH"
fi

summary
