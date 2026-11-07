#!/usr/bin/env bash
# ============================================================================
#  07-exposicion-archivos.sh — ASVS V14.2.2 / V4.3.2
# ============================================================================
#  Intenta descargar archivos que nunca deberían servirse y comprueba que no
#  haya listado de directorios ni métodos peligrosos.
#
#  Uso:  TARGET=https://infosistel.lab bash 07-exposicion-archivos.sh
# ============================================================================
source "$(dirname "$0")/lib.sh"

section "07 · Exposición de archivos y metadatos"

paths=(
  "/.env"
  "/.env.local"
  "/.env.production"
  "/.git/config"
  "/.git/HEAD"
  "/dev.db"
  "/prisma/dev.db"
  "/backups/"
  "/package.json"
  "/package-lock.json"
  "/prisma/schema.prisma"
  "/server.js"
  "/.next/BUILD_ID"
)

for p in "${paths[@]}"; do
  code="$(req_get "$TARGET$p")"
  if [ "$code" = "200" ]; then
    fail "$p devuelve 200 (archivo expuesto)"
    cp "$BODY" "$EVID/07-LEAK-$(echo "$p" | tr '/.' '__').txt"
  elif [ "$code" = "403" ] || [ "$code" = "404" ] || [ "$code" = "400" ]; then
    pass "$p -> HTTP $code"
  else
    # 307/308 a login también es aceptable (no expone contenido).
    case "$code" in
      301|302|307|308) pass "$p -> HTTP $code (redirige, no expone)" ;;
      *) fail "$p -> HTTP ${code:-sin respuesta}" ;;
    esac
  fi
done

section "Listado de directorios"
for d in "/img/products/" "/uploads/" "/backups/"; do
  code="$(req_get "$TARGET$d")"
  if body_has "Index of /"; then
    fail "$d muestra listado de directorios"
  else
    pass "$d sin listado (HTTP $code)"
  fi
done

section "Métodos HTTP peligrosos"
# DELETE/PATCH se permiten a propósito para la API admin (Nginx no puede
# distinguir por ruta sin duplicar bloques); la autorización real la hace la
# app. Aquí probamos los que NUNCA deben aceptarse en el sitio público.
for m in TRACE PUT CONNECT; do
  code="$(curl -sk --max-time 10 -X "$m" -o /dev/null -w '%{http_code}' "$TARGET/" 2>/dev/null || true)"
  if [ "$code" = "405" ] || [ "$code" = "400" ] || [ "$code" = "000" ]; then
    pass "$m -> HTTP ${code:-cerrada} (no permitido)"
  else
    fail "$m -> HTTP $code (revisar whitelist)"
  fi
done

section "Cabeceras que delatan tecnología"
req_get "$TARGET/" >/dev/null
for h in "X-Powered-By" "X-AspNet-Version" "X-Generator" "Server"; do
  v="$(hdr_value "$h")"
  if [ -z "$v" ]; then
    pass "$h ausente"
  elif printf '%s' "$v" | grep -Eq '[0-9]+\.[0-9]+'; then
    fail "$h expone versión: '$v'"
  else
    pass "$h sin versión: '$v'"
  fi
done

summary
