# Registro de hardening — INFOSISTEL v2

Este documento registra cada medida de seguridad aplicada al construir el sitio, en el orden en
que se implementó. Está pensado para usarse directamente como evidencia en la tesis
*"Aseguramiento de la Infraestructura Web en Entorno VPS mediante Guías de Hardening NIST y OWASP
para la Empresa INFOSISTEL"*.

Cada entrada indica: **qué** se hizo, **por qué** (referencia OWASP/NIST cuando aplica), **dónde**
vive en el código, y **cómo verificarlo**.

---

## Fase 0 — Línea base

### 1. Cabeceras de seguridad HTTP
- **Qué**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (cámara/micrófono/
  geolocalización desactivados por defecto), `Strict-Transport-Security` (HSTS, 2 años +
  subdominios + preload).
- **Por qué**: OWASP Secure Headers Project / OWASP Top 10 (A05:2021 – Security Misconfiguration).
  Reduce superficie de clickjacking, MIME-sniffing, filtración de referrer y fuerza HTTPS.
- **Dónde**: `next.config.ts` → `headers()`.
- **Verificación**: `curl -sI http://localhost:3000` debe mostrar las 5 cabeceras.

### 2. Content-Security-Policy estricta basada en nonce
- **Qué**: CSP con `script-src 'self' 'nonce-<random>' 'strict-dynamic'` (sin `'unsafe-inline'` en
  producción), `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `upgrade-insecure-requests`. Nonce nuevo y criptográficamente aleatorio
  (`crypto.randomUUID()`) en cada request.
- **Por qué**: OWASP Top 10 A03:2021 – Injection / XSS. Un script inyectado (reflejado o
  almacenado) no puede ejecutarse porque no conoce el nonce del request en curso.
- **Trade-off documentado**: exige renderizado dinámico en todo el sitio (Next.js no puede generar
  páginas estáticas con un nonce fijo en build time — el nonce cambia por request). Se acepta el
  costo de rendimiento porque el objetivo de esta tesis es la seguridad, y el sitio no depende de
  caché CDN de página completa.
- **Dónde**: `src/proxy.ts` (reemplaza a `middleware.ts`, deprecado en Next.js 16).
- **Verificación**: la cabecera `content-security-policy` en la respuesta debe traer un
  `nonce-...` distinto en cada request; no debe contener `'unsafe-inline'` fuera de `NODE_ENV=development`.

### 3. Validación de variables de entorno al arranque (fail-fast)
- **Qué**: esquema `zod` que valida `DATABASE_URL` (y las variables que se irán sumando en fases
  siguientes) antes de que la aplicación sirva una sola request. Si falta o es inválida, la app no
  arranca.
- **Por qué**: NIST SP 800-53 CM-6 (configuración segura por defecto) — un despliegue con
  configuración incompleta debe fallar ruidosamente, no arrancar en un estado parcialmente
  inseguro.
- **Dónde**: `src/lib/env.ts`.
- **Verificación**: borrar `DATABASE_URL` de `.env` y confirmar que `npm run dev` no levanta.

### 4. Cliente de base de datos centralizado, sin motor embebido con permisos amplios
- **Qué**: un único singleton (`src/lib/prisma.ts`) que instancia Prisma Client vía driver adapter
  (`@prisma/adapter-better-sqlite3`), evitando múltiples conexiones abiertas en desarrollo
  (hot-reload) y centralizando el único punto de acceso a datos.
- **Por qué**: reduce superficie de error — toda consulta pasa por un solo módulo auditable, en vez
  de que cada ruta abra su propia conexión.
- **Dónde**: `src/lib/prisma.ts`.

### 5. Gestión de dependencias — vulnerabilidad corregida antes del primer commit
- **Qué**: `@prisma/config@7.10.0` fijaba `deepmerge-ts@7.1.5`, con una vulnerabilidad de
  denegación de servicio por agotamiento de pila (stack exhaustion) al fusionar objetos recursivos
  (GHSA-ggr8-5vv4-36mx). Se corrigió con un `overrides` en `package.json` forzando
  `deepmerge-ts@^8.0.2` (versión que soluciona el problema), verificado con `npm audit` (0
  vulnerabilidades) y confirmando que `prisma generate`/`prisma --version` siguen funcionando.
- **Por qué**: OWASP Top 10 A06:2021 – Vulnerable and Outdated Components / NIST SP 800-53 SI-2.
- **Dónde**: `package.json` → `overrides`.
- **Verificación**: `npm audit` → "found 0 vulnerabilities".

### 6. `.gitignore` correcto desde el commit inicial
- **Qué**: `.env*`, `*.db` y variantes (`-journal`, `-wal`, `-shm`), `node_modules`, `.next`
  excluidos del control de versiones.
- **Por qué**: OWASP Top 10 A02:2021 – Cryptographic Failures / evita filtrar secretos o datos
  reales de clientes en el historial de git.
- **Dónde**: `.gitignore`.

### 7. `X-Powered-By` eliminado
- **Qué**: `poweredByHeader: false` en `next.config.ts`.
- **Por qué**: reduce fingerprinting trivial del framework/versión para un atacante en
  reconocimiento (defensa en profundidad, no es una vulnerabilidad por sí sola).
- **Dónde**: `next.config.ts`.

### 8. Rate limiting en el endpoint del chatbot (`/api/chat`)
- **Qué**: máximo 20 mensajes por IP cada 5 minutos (`lib/rateLimit.ts`, mismo patrón in-memory
  namespaced que se usará luego en login/pedidos). Además: si falta `ANTHROPIC_API_KEY` el
  endpoint responde 503 en vez de fallar de forma confusa, y el historial de conversación enviado
  al modelo se recorta a los últimos 20 mensajes.
- **Por qué**: OWASP API Security Top 10 — API4:2023 (Unrestricted Resource Consumption). Cada
  mensaje al chatbot cuesta dinero real (API de Anthropic); sin límite, un script puede vaciar la
  cuenta del negocio con requests automatizados. El recorte del historial también acota el tamaño
  de cada request (mitigación adicional de costo/abuso).
- **Dónde**: `src/lib/rateLimit.ts`, `src/app/api/chat/route.ts`.
- **Verificación**: enviar 21 requests seguidos desde el mismo origen al endpoint debe devolver
  `429` con cabecera `Retry-After` en el request 21.

---

## Fase 2 — Tienda online

### 9. Precio de pedidos recalculado 100% en el servidor
- **Qué**: `createOrder` (Server Action, `src/app/tienda/actions.ts`) ignora cualquier precio o
  total que el navegador envíe. Por cada línea del carrito busca el producto por `id` en la base
  de datos y usa su `price`/`salePrice` reales; el total del pedido es la suma de esos valores, no
  algo calculado en el cliente.
- **Por qué**: OWASP Top 10 A04:2021 – Insecure Design (confiar en datos de negocio enviados por
  el cliente). Sin esto, cualquiera podría editar el JSON del request y pagar S/. 1 por una laptop.
- **Dónde**: `src/app/tienda/actions.ts` → `createOrder`.
- **Verificación**: interceptar el request de checkout y modificar el precio/total enviado —
  el pedido guardado en la base de datos debe reflejar igual el precio real del catálogo.

### 10. Sanitización de datos de checkout + rate limiting de pedidos
- **Qué**: nombre y teléfono del cliente se sanitizan (`lib/sanitize.ts`) antes de guardarse;
  máximo 20 pedidos por IP cada 10 minutos (mismo `lib/rateLimit.ts` del chatbot); máximo 50 ítems
  por pedido.
- **Por qué**: evita XSS almacenado vía nombre de cliente y evita que un script cree pedidos
  falsos en bucle (que además le llegarían por WhatsApp al negocio).
- **Dónde**: `src/lib/sanitize.ts`, `src/app/tienda/actions.ts`.

### 11. `costPrice` (precio de costo) nunca sale del servidor
- **Qué**: `getProducts()` usa `select` explícito en Prisma, sin incluir `costPrice` — un campo
  que solo tiene sentido para el futuro panel admin (Fase 3), nunca para un visitante de la tienda.
- **Por qué**: OWASP Top 10 A01:2021 – Broken Access Control / exceso de exposición de datos. Un
  visitante no debe poder ver el margen de ganancia del negocio inspeccionando la respuesta de red.
- **Dónde**: `src/app/tienda/actions.ts` → `getProducts`.
- **Verificación**: inspeccionar la respuesta de `getProducts()` en las herramientas de red del
  navegador — no debe aparecer `costPrice` en ningún producto.

---

## Pendiente (fases siguientes — no implementado aún)
- Autenticación del panel admin (JWT, hash de contraseñas, rate limiting) — Fase 3.
- Cifrado de datos personales (DNI/teléfono) e índice de búsqueda ciego — Fase 4.
- Herramienta `buscarProductos` para el chatbot, ahora que el catálogo ya existe — para que no
  tenga que derivar cada pregunta de precio/stock a WhatsApp.
- Fotografía real de producto (hoy las tarjetas muestran un ícono de categoría, sin fotos) — se
  resuelve junto con el panel admin en la Fase 3.
- Hardening de infraestructura a nivel de VPS (SSH, firewall, Nginx/TLS, actualizaciones) — Fase 5,
  la que da nombre a la tesis. Requiere un VPS real desplegado; no aplica en local.
