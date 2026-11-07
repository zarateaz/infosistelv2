#!/usr/bin/env bash
# ============================================================================
#  05-verificar-pii-y-respaldo.sh — se ejecuta EN LA VM AZUL
# ============================================================================
#  Verifica, con la BD real del laboratorio:
#    - PII cifrada (AES-256-GCM) y sin texto plano
#    - índice ciego HMAC-SHA256 de 64 hex
#    - .env y dev.db en modo 600 (mínimo privilegio)
#    - respaldo + restauración con PRAGMA integrity_check
#    - npm audit y paquetes actualizables
#
#  Uso:  bash scripts/lab/vps/05-verificar-pii-y-respaldo.sh
# ============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
DATA_DIR="${DATA_DIR:-$HOME/infosistel-v2-data}"
EVID="${EVID:-$APP_DIR/evidencias/$(date +%Y%m%d-%H%M%S)-vps}"
mkdir -p "$EVID"

PASS=0; FAIL=0; WARN=0
ok()   { PASS=$((PASS+1)); printf '  \033[1;32mPASS\033[0m  %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[1;31mFAIL\033[0m  %s\n' "$*"; }
warn() { WARN=$((WARN+1)); printf '  \033[1;33mWARN\033[0m  %s\n' "$*"; }
sec()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

cd "$APP_DIR" || exit 1
[ -f .env ] || { echo "No existe .env en $APP_DIR"; exit 1; }
if [ -z "${DATABASE_URL:-}" ]; then
  set -a; # shellcheck disable=SC1091
  . ./.env; set +a
fi

DB_PATH="${DATABASE_URL#file:}"
[ -f "$DB_PATH" ] || DB_PATH="$DATA_DIR/dev.db"
[ -f "$DB_PATH" ] || { echo "No encuentro la BD en $DB_PATH"; exit 1; }

sec "0. Contexto"
echo "APP_DIR=$APP_DIR"
echo "DB=$DB_PATH"
echo "Evidencias=$EVID"

sec "1. Cifrado de PII en reposo (V8.3.7)"
orders=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "Order";')
repairs=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM Repair;')
echo "Pedidos=$orders  Reparaciones=$repairs"
[ "$orders" -gt 0 ] || warn "No hay pedidos: ejecuta el seed o crea uno desde la web."
[ "$repairs" -gt 0 ] || warn "No hay reparaciones: ejecuta el seed."

echo ""
echo "--- Order.customerPhone (debe ser iv:tag:cipher) ---"
sqlite3 -header -column "$DB_PATH" \
  "SELECT substr(customerPhone,1,40) || '...' AS customerPhone, customerPhoneIndex FROM \"Order\" LIMIT 3;" \
  | tee "$EVID/pii-orders.txt"

echo ""
echo "--- Repair.dniEncrypted (debe ser iv:tag:cipher) ---"
sqlite3 -header -column "$DB_PATH" \
  "SELECT code, substr(dniEncrypted,1,40) || '...' AS dniEncrypted, dniIndex FROM Repair LIMIT 3;" \
  | tee "$EVID/pii-repairs.txt"

plain_orders=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM \"Order\" WHERE customerPhone NOT GLOB '*:*:*';")
plain_repairs=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Repair WHERE dniEncrypted NOT GLOB '*:*:*';")
[ "$plain_orders" -eq 0 ] && ok "Ningún teléfono en texto plano en Order" || bad "$plain_orders teléfono(s) en texto plano en Order"
[ "$plain_repairs" -eq 0 ] && ok "Ningún DNI en texto plano en Repair" || bad "$plain_repairs DNI(s) en texto plano en Repair"

bad_idx=$(sqlite3 "$DB_PATH" 'SELECT (SELECT COUNT(*) FROM "Order" WHERE length(customerPhoneIndex)!=64) + (SELECT COUNT(*) FROM Repair WHERE length(dniIndex)!=64);')
[ "$bad_idx" -eq 0 ] && ok "Índices ciegos HMAC-SHA256 con 64 hex" || bad "$bad_idx índice(s) con longitud distinta de 64"

# Prueba de que el cifrado es real: el texto plano no aparece en el archivo.
if grep -a -q '987654321' "$DB_PATH"; then
  bad "El teléfono ficticio aparece en texto plano dentro del archivo SQLite"
else
  ok "El teléfono ficticio no aparece en claro dentro de dev.db"
fi
if grep -a -q '12345678' "$DB_PATH"; then
  bad "El DNI ficticio aparece en texto plano dentro del archivo SQLite"
else
  ok "El DNI ficticio no aparece en claro dentro de dev.db"
fi

sec "2. Mínimo privilegio en archivos (V14.2.2 / Fase 5)"
perm_env=$(stat -c '%a' .env)
perm_db=$(stat -c '%a' "$DB_PATH")
echo ".env=$perm_env  dev.db=$perm_db"
[ "$perm_env" = "600" ] && ok ".env en modo 600" || bad ".env en modo $perm_env (esperado 600)"
[ "$perm_db" = "600" ] && ok "dev.db en modo 600" || bad "dev.db en modo $perm_db (esperado 600)"

if id www-data >/dev/null 2>&1; then
  if sudo -n true 2>/dev/null; then
    if sudo -n -u www-data test -r "$DB_PATH" 2>/dev/null; then
      bad "El usuario www-data PUEDE leer la BD"
    else
      ok "El usuario www-data NO puede leer la BD"
    fi
  else
    warn "sudo sin contraseña no disponible; se valida por modo/dueno del archivo"
    if [ "$perm_db" = "600" ]; then
      ok "dev.db en 600: solo su dueno puede leerlo"
    else
      bad "dev.db en $perm_db: otros usuarios podrian leerlo"
    fi
  fi
else
  warn "No existe www-data; se omite la prueba de lectura"
fi

sec "3. Respaldo y restauración (V8.1.5 / V8.1.6)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Se prueba el script real de respaldo (scripts/backup-db.sh), no solo un
# .backup ad-hoc. DATA_DIR se pasa para que funcione con el usuario del lab.
BACKUP_OK=0
if [ -x scripts/backup-db.sh ]; then
  if DATA_DIR="$DATA_DIR" bash scripts/backup-db.sh > "$EVID/backup-script.txt" 2>&1; then
    ok "scripts/backup-db.sh ejecutado correctamente"
    BACKUP_OK=1
  else
    warn "scripts/backup-db.sh falló; se usa .backup directo (ver $EVID/backup-script.txt)"
  fi
fi

if [ "$BACKUP_OK" -eq 1 ]; then
  latest="$(ls -1t "$DATA_DIR"/backups/dev.db.*.gz 2>/dev/null | head -1)"
  if [ -n "$latest" ] && gunzip -t "$latest" 2>/dev/null; then
    ok "Respaldo comprimido válido: $(basename "$latest")"
    gunzip -c "$latest" > "$TMP/restore.db"
  else
    bad "No se encontró un .gz válido en $DATA_DIR/backups"
    BACKUP_OK=0
  fi
fi

if [ "$BACKUP_OK" -eq 0 ]; then
  if sqlite3 "$DB_PATH" ".backup '$TMP/restore.db'" 2>"$EVID/backup-error.txt"; then
    ok "Respaldo .backup directo generado (fallback)"
    BACKUP_OK=1
  else
    bad "No se pudo generar ningún respaldo (ver $EVID/backup-error.txt)"
  fi
fi

if [ "$BACKUP_OK" -eq 1 ]; then
  integrity="$(sqlite3 "$TMP/restore.db" 'PRAGMA integrity_check;')"
  echo "PRAGMA integrity_check -> $integrity"
  [ "$integrity" = "ok" ] && ok "Restauración íntegra" || bad "integrity_check: $integrity"
  src_orders=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM "Order";')
  dst_orders=$(sqlite3 "$TMP/restore.db" 'SELECT COUNT(*) FROM "Order";')
  [ "$src_orders" = "$dst_orders" ] && ok "Mismo número de pedidos ($src_orders)" || bad "Pedidos origen=$src_orders destino=$dst_orders"
  src_products=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM Product;')
  dst_products=$(sqlite3 "$TMP/restore.db" 'SELECT COUNT(*) FROM Product;')
  [ "$src_products" = "$dst_products" ] && ok "Mismo número de productos ($src_products)" || bad "Productos origen=$src_products destino=$dst_products"
fi

sec "4. Dependencias (V14.2.1)"
if npm audit --omit=dev --audit-level=high >"$EVID/npm-audit.txt" 2>&1; then
  ok "npm audit sin vulnerabilidades altas/críticas"
else
  warn "npm audit reportó hallazgos: revisa $EVID/npm-audit.txt"
fi
grep -E 'found [0-9]+ vulnerabilities|vulnerabilities found' "$EVID/npm-audit.txt" | tail -2 || true

sec "5. Actualizaciones del sistema (equivalente a arch-audit en Kali)"
upgradable=$(apt list --upgradable 2>/dev/null | grep -c '^' || true)
echo "Paquetes actualizables (incluye encabezado): $upgradable"
apt list --upgradable 2>/dev/null | sed -n '1,15p' | tee "$EVID/apt-upgradable.txt"
if command -v debsecan >/dev/null; then
  debsecan --format detail 2>/dev/null | head -30 | tee "$EVID/debsecan.txt"
else
  warn "debsecan no está instalado (opcional: sudo apt install debsecan)"
fi

sec "6. Registro persistente de eventos de seguridad (V7.1.3 / V8.3.5)"
audit_count=$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM AuditLog;' 2>/dev/null || echo 0)
echo "Eventos en AuditLog: $audit_count"
sqlite3 -header -column "$DB_PATH" \
  'SELECT action, username, ipAddress, createdAt FROM AuditLog ORDER BY createdAt DESC LIMIT 10;' \
  2>/dev/null | tee "$EVID/auditlog.txt"
if [ "${audit_count:-0}" -gt 0 ]; then
  ok "Hay eventos persistentes en AuditLog"
  sqlite3 "$DB_PATH" 'SELECT DISTINCT action FROM AuditLog;' | tr '\n' ' '
  echo ""
else
  warn "AuditLog vacío: genera un LOGIN_FAILED desde la web y vuelve a ejecutar esta sección"
fi

sec "RESUMEN"
echo "PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
echo "Evidencias en: $EVID"
[ "$FAIL" -eq 0 ] || exit 1
