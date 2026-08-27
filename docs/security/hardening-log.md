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

### 12. `frame-src` acotado exclusivamente a Google Maps
- **Qué**: se agregó `frame-src https://www.google.com;` a la CSP (`src/proxy.ts`) para permitir
  el `<iframe>` del mapa de ubicación en la sección de contacto (`ContactCta.tsx`). Sin
  `frame-src`, la directiva cae a `default-src 'self'` y bloquea cualquier iframe externo — el
  mapa no cargaba silenciosamente (sin request de red, sin error visible en consola de la página).
- **Por qué**: mantener el principio de mínimo privilegio de la CSP — en vez de abrir `frame-src`
  a cualquier origen, se permite solo el dominio exacto que sirve el embed de Google Maps.
- **Dónde**: `src/proxy.ts`, `src/components/sections/ContactCta.tsx`.
- **Verificación**: con DevTools abierto, la consola no debe mostrar errores de
  "Refused to frame ... because it violates the following Content Security Policy directive" al
  cargar `/#contacto`.

---

## Fase 3 — Autenticación del panel admin

### 13. Login de admin: scrypt + JWT de sesión + rate limiting + anti-enumeración
- **Qué**: cuenta de administrador única (modelo `Admin`, sin registro público — se crea con
  `npx tsx scripts/create-admin.ts <usuario> <password>`). La contraseña se guarda como
  `salt:hash` con `scrypt` (`node:crypto`, no bcrypt/argon2 — sin dependencia nativa nueva que
  auditar, mismo criterio que la entrada #5). Al autenticar, se firma un JWT de sesión
  (`jose`, HS256, 8h de expiración) guardado en una cookie `httpOnly; sameSite=lax;
  secure` (en producción). Máximo 5 intentos por IP cada 15 minutos
  (`lib/rateLimit.ts`, mismo patrón que chat/pedidos). Si el usuario no existe, se corre
  igual un `scryptSync` sobre una sal fija (`burnPasswordCheckTime`) para que el tiempo de
  respuesta no revele si un usuario es válido (ataque de enumeración por timing).
- **Por qué**: OWASP Top 10 A07:2021 – Identification and Authentication Failures / OWASP ASVS
  V2 (password storage con KDF lenta, no hash rápido) / API4:2023 (rate limiting en login).
- **Dónde**: `src/lib/auth.ts` (hashing, Node runtime), `src/lib/session.ts` (JWT, Edge-safe —
  `jose` en vez de `node:crypto` para poder importarse desde `proxy.ts`), `src/app/admin/login/`,
  `scripts/create-admin.ts`.
- **Verificación**: 6 intentos seguidos con contraseña incorrecta desde la misma IP deben
  bloquear el 6to con un mensaje de espera; medir el tiempo de respuesta con un usuario
  inexistente vs. uno existente con contraseña incorrecta no debe mostrar una diferencia
  perceptible.

### 14. `/admin/*` protegido en el edge, no solo en la página
- **Qué**: `proxy.ts` verifica la cookie de sesión para cualquier ruta bajo `/admin` (excepto
  `/admin/login`) y redirige a `/admin/login` si falta o es inválida/expirada — antes de que la
  petición llegue a renderizar cualquier Server Component. `/admin/page.tsx` vuelve a verificar
  la sesión igual (defensa en profundidad: el chequeo del proxy no debe ser el único lugar que
  decide qué se le muestra a quién).
- **Por qué**: OWASP Top 10 A01:2021 – Broken Access Control. Verificar solo dentro del
  componente de página es frágil — cualquier nueva ruta bajo `/admin` que alguien agregue después
  quedaría desprotegida por defecto si el chequeo no vive en un punto central.
- **Dónde**: `src/proxy.ts`.
- **Verificación**: pedir `/admin` sin cookie de sesión (`curl -I`) debe devolver `307` a
  `/admin/login`; con una cookie de sesión válida, pedir `/admin/login` debe redirigir a `/admin`.

---

## Fase 4 — Cifrado de datos personales

### 15. Teléfono del cliente cifrado en reposo (AES-256-GCM) + índice ciego para búsqueda
- **Qué**: `Order.customerPhone` deja de guardarse en texto plano — `createOrder`
  (`src/app/tienda/actions.ts`) lo cifra con AES-256-GCM (`lib/crypto.ts`, `node:crypto`, sin
  dependencia nueva — mismo criterio que scrypt en la entrada #13) antes de escribirlo. Cada valor
  guarda su propio IV aleatorio y un authTag (GCM detecta manipulación, no solo confidencialidad).
  Como el ciphertext es no-determinista, una búsqueda exacta ("¿este cliente ya pidió antes?") no
  puede comparar contra él directamente — se guarda además `customerPhoneIndex`, un HMAC-SHA256
  del teléfono (solo dígitos) con un secreto separado (`DNI_HMAC_SECRET`), indexado en la tabla,
  que sí permite un lookup exacto sin descifrar ninguna fila.
- **Por qué**: OWASP Top 10 A02:2021 – Cryptographic Failures. Un dump de la base de datos (backup
  filtrado, acceso no autorizado al VPS) no debe exponer directamente el celular real de un
  cliente. El nombre del cliente se deja sin cifrar deliberadamente — no forma parte del alcance
  que ya definía este documento ("DNI/teléfono"), y cifrar más de lo necesario sin un caso de uso
  real solo agrega complejidad.
- **Dónde**: `src/lib/crypto.ts`, `src/lib/sanitize.ts` (`digitsOnly`), `src/app/tienda/actions.ts`,
  `prisma/schema.prisma` (`Order.customerPhone`, `Order.customerPhoneIndex`).
- **Verificación**: `sqlite3 dev.db "SELECT customerPhone FROM \"Order\";"` debe mostrar
  `iv:authTag:ciphertext` en hex, nunca un número de teléfono legible; `decryptPII()` sobre ese
  valor debe devolver el teléfono original exacto; dos formatos distintos del mismo número
  (`"987 654 321"` vs `"987654321"`) deben producir el mismo `customerPhoneIndex`.

### 16. Contenido del panel admin: catálogo y pedidos
- **Qué**: `/admin/productos` (listar/crear/editar/eliminar, con confirmación antes de borrar) y
  `/admin/pedidos` (listado + búsqueda exacta por celular usando `customerPhoneIndex` de la
  Fase 4 — nunca se descifra nada para comparar, solo para mostrar en pantalla). El panel dejó de
  compartir el Navbar/Footer/chat público (`src/components/SiteChrome.tsx`): un panel interno no
  necesita el botón de WhatsApp ni el link "Iniciar sesión" que ya se usó para entrar. Crear o
  editar un producto hace `upsert` de su categoría en la tabla `Category` si es nueva — así
  `/tienda` la recoge sola en sus chips de filtro sin tocar código.
- **Por qué**: cierra el hueco que dejaba la Fase 3 (login funcionando pero sin nada que
  administrar) y le da un uso real al índice ciego construido en la Fase 4.
- **Dónde**: `src/app/admin/(panel)/`, `src/components/SiteChrome.tsx`.
- **Verificación**: crear un producto con una categoría nueva debe hacerla aparecer en los chips
  de `/tienda` sin ningún cambio de código; buscar un pedido por un celular que no existe debe
  devolver 0 resultados sin lanzar error.

### 17. Escáner de inventario: código de barras (USB o cámara) + reconocimiento por foto con IA
- **Qué**: en "Nuevo producto", un campo de código de barras acepta tanto un escáner físico USB
  (HID — escribe dígitos y Enter, sin permisos de navegador) como escritura manual o una **cámara
  en vivo** (`@zxing/browser`, botón "Usar cámara"). Busca primero en la base local
  (`Product.barcode`, columna `@unique`); si ya existe, lleva directo a editar ese producto en vez
  de dejar crear un duplicado — esto es lo que de verdad importa día a día (reabastecer stock). Si
  no existe localmente, intenta una base pública de UPC gratuita (best-effort: timeout de 5s,
  cualquier fallo se trata como "no encontrado", nunca bloquea el flujo). Además, "Reconocer con
  IA" deja subir una foto de la caja/etiqueta y usa Claude (`generateObject`, mismo proveedor que
  el chatbot — sin agregar otra API) para leer marca/modelo/especificaciones y sugerir nombre,
  descripción y categoría (restringida por `zod.enum` a las categorías que ya existen, para no
  inventar una nueva por error de lectura). Esa foto de reconocimiento nunca se sube a disco ni se
  guarda — solo viaja como base64 al modelo y se descarta.
- **Por qué**: cierra el alcance original de la Fase 3 ("catálogo, pedidos, escáner de
  inventario"). El límite real y ya documentado en el proyecto anterior se mantiene: la mayoría
  del inventario (cables genéricos, repuestos B2B) simplemente no tiene ficha en bases públicas de
  UPC — por eso el reconocimiento por foto es la vía que de verdad funciona para ese caso. Rate
  limit de 20 fotos / 5 min por IP en `recognizeProductImage` — cuesta dinero real por llamada
  aunque esté detrás del login admin.
- **Cámara y Permissions-Policy**: la cabecera global ya venía con `camera=()` (entrada #1,
  comentario "revisit when the barcode-scanner admin feature actually needs `camera=(self)`" —
  este es ese momento). En vez de aflojarla para todo el sitio, `next.config.ts` agrega un segundo
  bloque de `headers()` con `source: "/admin/:path*"` que sobreescribe solo ahí con
  `camera=(self)` — el sitio público sigue sin poder pedir cámara nunca.
- **Dónde**: `src/app/admin/(panel)/productos/scan-actions.ts`, `ScannerPanel.tsx`,
  `CameraScanner.tsx`, `prisma/schema.prisma` (`Product.barcode`), `next.config.ts`.
- **Verificación**: escanear un código ya guardado debe llevar a editar ese producto, no a crear
  uno nuevo; intentar guardar dos productos con el mismo código de barras debe rechazar el segundo
  con "Ya existe un producto con ese código de barras"; pedir la cámara desde cualquier página
  fuera de `/admin` debe fallar por política del navegador, nunca solo por falta de hardware.

### 18. Subida real de fotos de producto (reemplaza el campo de ruta manual)
- **Qué**: "Imagen del producto" ahora es un subida de archivo real (PNG/JPEG/WEBP, máx. 8MB) en
  vez de un input de texto con la ruta. `uploadProductImage` (Server Action) reprocesa todo con
  `sharp` — no solo guarda el archivo tal cual: aplica la orientación EXIF y luego la descarta,
  redimensiona a máx. 1200×1200 y reconvierte a WEBP con nombre `randomUUID()`. Ese re-encodeo es
  también la validación de contenido: un archivo renombrado que no sea una imagen real falla ahí,
  antes de tocar disco. Reemplazar o borrar la foto de un producto limpia el archivo anterior
  (`deleteProductImageIfManaged`) — pero solo si el path cae bajo `/img/products/` con el patrón
  exacto de nombre que este código genera, nunca una ruta que alguien haya escrito a mano en una
  fase anterior.
- **Bug real encontrado y corregido en el camino**: Next.js limita el body de un Server Action a
  1MB por defecto. Una foto de ~1.8MB en base64 (+33% de overhead) lo supera con facilidad, y la
  falla — antes de este fix — era **silenciosa**: el campo oculto de la imagen se quedaba con el
  valor viejo, sin ningún mensaje, y guardar el producto conservaba la foto anterior sin avisar.
  Se corrigió en dos frentes: `next.config.ts` sube `experimental.serverActions.bodySizeLimit` a
  `12mb` (cubre el tope de 8MB en crudo más el overhead de base64), y `ImageUploadField` ahora
  envuelve la subida en `try/catch` real — cualquier fallo (éste u otro) muestra un mensaje en vez
  de fallar en silencio. Además, "Guardar" se deshabilita mientras una imagen sigue subiendo, para
  que nunca sea posible guardar con el campo todavía apuntando al valor anterior.
- **Por qué**: la subida por ruta manual asumía que alguien ya había copiado el archivo a
  `/public` a mano — inviable para el uso real del panel. La falla silenciosa del límite de body
  es exactamente el tipo de bug que rompe confianza en un formulario: parece que guardó bien y no
  guardó lo que se esperaba.
- **Dónde**: `src/app/admin/(panel)/productos/upload-actions.ts`, `ImageUploadField.tsx`,
  `next.config.ts`, `.gitignore` (`/public/img/products/` — contenido subido en runtime, no
  código fuente; igual que `dev.db`, necesita vivir fuera del directorio de deploy en el VPS o
  sobrevivir a cada redeploy de alguna otra forma).
- **Verificación**: subir una foto de >1MB en base64 debe completarse sin el error "Body exceeded
  1 MB limit" en consola; reemplazar la foto de un producto debe dejar en disco solo el archivo
  nuevo, nunca ambos.

### 19. Preparación para desplegar en el VPS (sin ejecutar nada remoto)
- **Qué**: `next.config.ts` agrega `output: "standalone"`; `ecosystem.config.js`,
  `scripts/deploy-vps.sh` y `docs/deploy-vps.md` — adaptados del sitio anterior, no copiados tal
  cual. `PRODUCT_IMAGES_DIR` (nueva env var opcional) permite que las fotos subidas vivan fuera de
  `.next/standalone` en producción, igual que ya hacía `dev.db`; el script las enlaza (`ln -s`) al
  build en cada deploy para que sobrevivan a los rebuilds. El runbook prueba todo en un puerto
  aparte (3010) antes de tocar el dominio real, con plan de rollback explícito (el sitio anterior
  se detiene con `pm2 stop`, no se borra).
- **Dos problemas reales encontrados al adaptar la config del sitio anterior** (no eran hipotéticos
  — estaban en el `nginx.conf` que ya corre en producción):
  1. Su rate-limit estricto de login apuntaba a `/api/auth/login` (endpoint REST de ese sitio).
     v2 no tiene esa ruta — el login es un Server Action que hace POST directo a `/admin/login`.
     Sin corregir esto, el intento de fuerza bruta contra el login cae en el límite general
     (120r/min) en vez del estricto (5r/min).
  2. Ese `nginx.conf` también fija `X-Frame-Options`, `Permissions-Policy`, HSTS y una CSP propia
     a nivel de servidor web — v2 ya pone las suyas a nivel de app (`next.config.ts` +
     `src/proxy.ts`, con nonce por request que nginx no puede replicar). Con ambas capas activas,
     un mismo header aparece dos veces con valores distintos (`X-Frame-Options: SAMEORIGIN` de
     nginx contra `DENY` de la app) — comportamiento no garantizado entre navegadores, y una forma
     real de terminar menos protegido que con la app sola. Se quitaron esas líneas de `nginx.conf`
     dejando un comentario explicando por qué, para que nadie las vuelva a agregar sin darse cuenta.
  3. (Bug de build, no de nginx) `PRODUCT_IMAGES_DIR` al ser una ruta dinámica (viene de una env
     var) hacía que Turbopack no pudiera acotar el tracing del output y empaquetara el proyecto
     completo dentro de `.next/standalone` — corregido con comentarios `turbopackIgnore` en los
     tres usos de `fs` que la tocan (`upload-actions.ts`). Verificado: el standalone bajó a ~77MB
     sin la advertencia de build.
- **Por qué**: el dominio real (`infosistel.com.pe`) sirve hoy el sitio anterior — desplegar v2 ahí
  reemplaza ese sitio, no agrega uno nuevo. "Sin margen de error" significa que este cambio se
  prueba en un puerto aparte con datos reales (login, crear producto con foto, un pedido) antes de
  cortar el dominio, con un camino de vuelta atrás de un solo comando.
- **Dónde**: `next.config.ts`, `ecosystem.config.js`, `scripts/deploy-vps.sh`, `nginx.conf`,
  `docs/deploy-vps.md`, `.env.example`.
- **Deliberadamente NO hecho en esta entrada**: nada se ejecutó contra el VPS real ni se tocó DNS,
  nginx en producción, o el proceso PM2 del sitio anterior — todo esto vive en el repo, listo para
  que el usuario lo corra él mismo siguiendo `docs/deploy-vps.md`.

---

## Pendiente (fases siguientes — no implementado aún)
- Campo DNI y su propio cifrado/índice — la Fase 4 hasta ahora solo cubre el teléfono, que era el
  único dato personal que ya existía en el esquema; agregar DNI real cuando el checkout/panel lo
  requiera.
- Herramienta `buscarProductos` para el chatbot, ahora que el catálogo ya existe — para que no
  tenga que derivar cada pregunta de precio/stock a WhatsApp.
- Fotografía real de producto (hoy las tarjetas muestran un ícono de categoría, sin fotos) —
  requiere una vía de subida de imágenes que el panel admin todavía no tiene; hoy el campo
  "ruta de imagen" solo acepta una ruta ya existente en `/public`.
- Hardening de infraestructura a nivel de VPS (SSH, firewall, Nginx/TLS, actualizaciones) — Fase 5,
  la que da nombre a la tesis. Requiere un VPS real desplegado; no aplica en local.
