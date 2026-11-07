#!/usr/bin/env bash
# ============================================================================
#  06-datos-minimo-privilegio.sh — ASVS V4.1.3
# ============================================================================
#  Verifica que costPrice (margen de ganancia) no salga en el HTML público
#  ni en el payload RSC de Next.js. La manipulación de precio y la validación
#  Zod se hacen con Burp (instrucciones al final).
#
#  Uso:  TARGET=https://infosistel.lab bash 06-datos-minimo-privilegio.sh
# ============================================================================
source "$(dirname "$0")/lib.sh"

section "06 · Mínimo privilegio en datos (V4.1.3)"

check_page() {
  local path="$1" name="$2" file="$3"
  local code
  code="$(req_get "$TARGET$path")"
  check_status "$name responde 200" 200 "$code"
  cp "$BODY" "$EVID/06-$file.html"
  local n
  n="$(body_count 'costPrice["\\]')"
  echo "  ocurrencias de la clave 'costPrice' en $path: $n"
  if [ "$n" -eq 0 ]; then
    pass "$name no expone costPrice"
  else
    fail "$name EXPONE costPrice ($n ocurrencias)"
  fi
}

check_page "/catalogo" "Catálogo público"     "catalogo"
check_page "/tienda"   "Tienda pública"       "tienda"
check_page "/p/9001"   "Ficha de producto"    "producto-9001"

section "El producto del lab sí está presente (control positivo)"
req_get "$TARGET/catalogo" >/dev/null
if body_has "Mouse Inalámbrico (Lab)"; then
  pass "El producto de laboratorio aparece en el catálogo (la prueba es real)"
else
  skip "No se encontró el producto del lab; ejecuta el seed en la VM azul"
fi
if body_has "price"; then
  pass "El precio público sí se muestra (no se ocultó de más)"
else
  skip "No se encontró la clave price en el HTML (revisar renderizado)"
fi

section "Ruta de API de productos (versión vieja)"
code="$(req_get "$TARGET/api/products")"
check_status_any "/api/products no existe en v2" "404 405" "$code"

cat <<'EOF'

────────────────────────────────────────────────────────────────────────────
MANIPULACIÓN DE PRECIO Y VALIDACIÓN ZOD (Burp Suite, VM negra)
────────────────────────────────────────────────────────────────────────────

1. Proxy del navegador -> 127.0.0.1:8080 (Burp), Intercept ON.
2. Abre https://infosistel.lab/cotizacion, agrega el producto del lab y
   completa el checkout con celular 987654321.
3. Burp captura un POST con cabecera Next-Action y cuerpo JSON parecido a:
   [{"customerName":"...","customerPhone":"987654321",
     "items":[{"productId":"cm...","quantity":1}]}]
4. Modifícalo para inyectar precio/total del lado cliente:
   [{"customerName":"...","customerPhone":"987654321","total":1,
     "items":[{"productId":"cm...","quantity":1,"price":1,"unitPrice":1}]}]
5. Forward. El servidor ignora total/price/unitPrice (Zod los descarta y
   relee el precio de SQLite). Comprueba en /taller-control/pedidos y con:
     sqlite3 "$DATABASE_URL" 'SELECT id,total FROM "Order" ORDER BY createdAt DESC LIMIT 1;'
   El total debe ser el real (50.00 con el producto del lab), no 1.

6. Validación Zod:
   - customerPhone "123"  -> «Celular inválido (9 dígitos...)».
   - quantity 0           -> error de cantidad positiva.
   - items []             -> «El carrito está vacío».
   - 51 ítems             -> error de máximo 50.
   La petición se rechaza antes de tocar la base de datos.

7. Evidencias para la tesis:
   - captura del request modificado en Burp,
   - captura del pedido con el total real,
   - salida de sqlite3 con Order.total,
   - captura del error Zod para el celular inválido.
EOF

summary
