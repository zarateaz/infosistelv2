# Laboratorio de hardening — simulación real con 2 VMs Kali

> **Repositorio:** `infosistelv2` (la aplicación endurecida) · **Solo para VMs aisladas** · **No ejecutar contra `infosistel.com.pe`**

Este kit monta una **réplica del VPS de producción** sobre dos máquinas Kali y
permite ejecutar, con evidencia real, las pruebas que sustentan el Capítulo IV
y la re-verificación del Capítulo VI del proyecto:

- **VM azul / VPS simulado (`10.10.10.20`)**: Kali + Nginx (TLS, rate limit,
  filtro Anti-SQLi, `server_tokens off`) + Next.js bajo PM2 + SQLite + SSH en
  puerto 2244 + Firewalld + Fail2ban.
- **VM negra / atacante (`10.10.10.10`)**: Kali con nmap, sqlmap, Nikto, Hydra,
  OWASP ZAP, `testssl.sh`, curl y Burp/ZAP para inspección manual.

La topología y las IPs son las mismas del laboratorio de la Actividad N°1
(`infosistelab`), para que ambos trabajos se presenten como un solo entorno
coherente.

```
┌──────────────────────────────┐          ┌──────────────────────────────────┐
│  VM NEGRA — Atacante         │          │  VM AZUL — VPS simulado          │
│  Kali Linux                  │  red     │  Kali Linux                      │
│  10.10.10.10                 │  aislada │  10.10.10.20                     │
│                              │ 10.10.10.0/24                              │
│  nmap · sqlmap · nikto       │◄────────►│  Nginx 443/80 (TLS 1.2/1.3)      │
│  hydra · ZAP · curl          │          │  Next.js 16 + PM2 :3000          │
│  Burp Suite · testssl.sh     │          │  SQLite (PII cifrada)            │
│                              │          │  SSH :2244 · Firewalld · Fail2ban│
└──────────────────────────────┘          └──────────────────────────────────┘
```

---

## 0. Qué demuestra y qué no demuestra este laboratorio

**Sí demuestra** (es exactamente lo que el jurado puede ver en vivo):

| Capa | Control | Cómo se prueba |
|---|---|---|
| Frontend | 5 cabeceras + HSTS + CSP con nonce por request | `curl -I`, dos requests, nonce distinto |
| Frontend | Sin `X-Powered-By`, sin versión de Nginx | `curl -I` |
| Backend | Acceso a `/taller-control` sin sesión → 307 | `curl` |
| Backend | `/api/scanner` sin sesión → 401 | `curl` |
| Backend | JWT manipulado → rechazado | cookie falsa |
| Backend | JWT viejo tras logout → 307/401 (`tokenVersion`) | `vps/06` |
| Backend | Login: 5 intentos / 15 min → 429 | navegador / Burp |
| Backend | Auditoría persistente de eventos (`LOGIN_FAILED`, `LOGIN_SUCCESS`, `CSP_VIOLATION`) | `sqlite3` sobre `AuditLog` (`vps/05`) |
| Backend | Contraseña mínima 12, MFA, roles | UI del panel |
| Backend | Zod rechaza checkout inválido | Burp |
| Backend | Total recalculado en servidor | Burp (precio manipulado ignorado) |
| Datos | `costPrice` nunca sale al público | grep en `/catalogo` y `/tienda` |
| Datos | PII cifrada AES-256-GCM + índice ciego | `sqlite3` en el VPS |
| Datos | BD y `.env` en modo 600 | `stat` |
| Datos | Respaldo + restauración verificada | script + `PRAGMA integrity_check` |
| Red | SSH solo por llave, puerto 2244, root no | `ssh -o PreferredAuthentications=password` |
| Red | Firewalld: 22/3000/3010 cerrados | `nmap` desde la VM negra |
| Red | Fail2ban banea fuerza bruta SSH | Hydra + `fail2ban-client status` |
| Red | Rate limit 300 r/m general y 60 r/m `/api/` → 429 | ráfaga con curl |
| Red | Filtro Anti-SQLi en Nginx → 403 | payloads UNION SELECT |
| Red | TLS 1.0/1.1 rechazados; 1.2/1.3 aceptados | `openssl s_client` |
| Red | Archivos sensibles no expuestos | `/.env`, `/.git`, `dev.db` |

**No demuestra** (y conviene decirlo antes de que lo pregunte el jurado):

- **Certbot/Let's Encrypt**: en el lab se usa un certificado propio; la rotación
  real está documentada con el `certbot-renew.timer` del VPS de producción.
- **`arch-audit`**: es específico de Arch Linux. En Kali el equivalente es
  `debsecan` / `apt list --upgradable`. El control es el mismo; la herramienta
  cambia porque cambia la distro.
- **Producción real**: el laboratorio es una **réplica controlada**. Las
  evidencias del VPS real (Hostinger/Arch, 2026-09-08 y 2026-10-20) siguen
  siendo las del Capítulo IV; este lab sirve para que el jurado **vea funcionar**
  los mismos controles sin tocar producción. No mezclar ambas evidencias ni
  afirmar que el lab *es* el VPS.
- **PII real**: la base del lab se siembra con datos ficticios
  (`987654321`, DNI `12345678`). No copies la BD de producción.

> **Regla de oro para la exposición:** primero muestra la evidencia de
> producción (captura del VPS real), y después reproduce el control en vivo en
> el lab. Así el jurado ve que no es un teatro: el control existe en los dos
> lados.

---

## 1. Preparar las dos VMs

1. Dos VMs Kali actualizadas (`sudo apt update && sudo apt full-upgrade`).
2. **Adaptador 1:** NAT (solo para instalar paquetes).
   **Adaptador 2:** red interna/host-only `10.10.10.0/24`.
3. IPs estáticas:
   - VM negra: `10.10.10.10/24`
   - VM azul: `10.10.10.20/24`
4. **Snapshot de la VM azul antes de cada demo** (Fail2ban, Hydra y los
   escaneos modifican estado).
5. Recursos recomendados: 2 vCPU / 4 GB RAM para la VM azul, 2 vCPU / 2 GB para
   la negra.

Comprueba conectividad:

```bash
# Desde la VM negra
ping -c 2 10.10.10.20
```

En **ambas** VMs agrega el dominio del laboratorio:

```bash
echo "10.10.10.20 infosistel.lab www.infosistel.lab" | sudo tee -a /etc/hosts
```

---

## 2. Montar el VPS simulado (VM azul, `10.10.10.20`)

### 2.1 Clonar el repositorio

```bash
sudo apt update
sudo apt install -y git curl openssl sqlite3
git clone git@github.com:zarateaz/infosistelv2.git ~/infosistelv2
cd ~/infosistelv2
```

> Si el repo es privado y no quieres configurar llaves en la VM, puedes copiar
> el proyecto desde tu equipo con `rsync -av --exclude node_modules --exclude .next --exclude .env infosistelv2/ kali@10.10.10.20:~/infosistelv2/`.

### 2.2 Orden de ejecución (importante)

```bash
cd ~/infosistelv2

# 1) Paquetes base (nginx, node, pm2, fail2ban, firewalld, sqlite3)
bash scripts/lab/vps/00-instalar-base.sh

# 2) Certificado TLS para infosistel.lab (autofirmado con CA propia)
bash scripts/lab/vps/01-certificado-lab.sh

# 3) App: .env, BD, Prisma, build, PM2
bash scripts/lab/vps/04-desplegar-app.sh

# 4) Nginx con el dominio del lab (el script 04 lo instala y recarga)
#    Verifica: sudo nginx -t && systemctl status nginx

# 5) SSH en 2244 + Firewalld (hazlo con la consola de la VM abierta)
bash scripts/lab/vps/02-ssh-firewall.sh

# 6) Fail2ban sobre el puerto 2244
bash scripts/lab/vps/03-fail2ban.sh
```

> **Antes del paso 5**, desde la VM negra copia tu llave pública a la VM azul
> (todavía por el puerto 22):
>
> ```bash
> ssh-keygen -t ed25519 -C "lab-atacante"   # si aún no tienes llave
> ssh-copy-id kali@10.10.10.20
> ```
>
> Si el usuario no es `kali`, cámbialo en todos los comandos. El script 02 se
> niega a deshabilitar la contraseña si `~/.ssh/authorized_keys` está vacío.

Al terminar, las credenciales del panel quedan en `~/infosistelv2/.env`
(generadas al azar) y el script 04 las imprime una vez:

```
URL:        https://infosistel.lab/taller-control/login
Usuario:    labadmin
Contraseña: <la que imprimió el script>
```

> **Ojo:** `04-desplegar-app.sh` vuelve a sembrar el admin de laboratorio y
> deja `totpEnabled=false`. Si ya activaste MFA para la demo, no vuelvas a
> ejecutar 04 (o vuelve a activarlo después).

### 2.3 Comprobación rápida en la VM azul

```bash
curl -skI https://infosistel.lab/ | head -20
pm2 list
sudo nginx -t
sudo firewall-cmd --list-all
sudo fail2ban-client status sshd
```

---

## 3. Montar la VM atacante (VM negra, `10.10.10.10`)

```bash
bash scripts/lab/atacante/00-instalar-herramientas.sh
```

El script instala `nmap`, `nikto`, `sqlmap`, `hydra`, `whatweb`, `zaproxy`,
`testssl.sh`, `jq`, `curl`, `openssl` y deja el dominio en `/etc/hosts`.

Para que `curl` y el navegador confíen en el certificado del lab, copia la CA
que generó el script 01 y instálala:

```bash
scp -P 2244 kali@10.10.10.20:/etc/nginx/ssl/infosistel-lab-ca.crt /tmp/
sudo cp /tmp/infosistel-lab-ca.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

Con eso, `curl https://infosistel.lab/` funciona sin `-k` y el navegador no
muestra la pantalla de advertencia (HSTS + certificado no confiable es una mala
combinación para una demo).

---

## 4. Ejecutar las pruebas

Todas las pruebas guardan evidencia en `./evidencias/<fecha-hora>/`.

### 4.1 Todo automático

```bash
cd ~/infosistelv2
TARGET=https://infosistel.lab VPS_IP=10.10.10.20 \
  bash scripts/lab/atacante/correr-todo.sh
```

### 4.2 Prueba por prueba (recomendado para la exposición)

| # | Script | Qué muestra | ASVS / control |
|---|---|---|---|
| 01 | `01-huella-y-cabeceras.sh` | HSTS, CSP con nonce distinto, `nosniff`, `DENY`, sin `X-Powered-By` | V14.3.3, V14.4.3–V14.4.7 |
| 02 | `02-tls.sh` | TLS 1.0/1.1 rechazados, 1.2/1.3 aceptados, SAN | V9.1.1, V9.1.3 |
| 03 | `03-puertos.sh` | 22/3000/3010 cerrados; 80/443/2244 abiertos | NIST SP 800-123 / Fase 5 |
| 04 | `04-rate-limit-y-filtros.sh` | 429 por ráfaga, 403 Anti-SQLi, 444 a sqlmap/Nikto | V2.2.1, V5, V13 |
| 05 | `05-acceso-admin.sh` | 307 sin sesión, 401 en API, JWT falso rechazado | V4.1.1, V4.1.5 |
| 06 | `06-datos-minimo-privilegio.sh` | `costPrice` ausente en el HTML público | V4.1.3 |
| 07 | `07-exposicion-archivos.sh` | `.env`, `.git`, `dev.db` no descargables; métodos raros | V14.2.2, V4.3.2 |
| 08 | `08-zap-baseline.sh` | Escaneo pasivo OWASP ZAP + reporte HTML | V14 / evidencia |

Cada script imprime `PASS` / `FAIL` / `SKIP` y deja los archivos crudos
(cabeceras, cuerpos, salidas de nmap/openssl) en la carpeta de evidencias.

### 4.3 Verificaciones que se ejecutan **en la VM azul**

```bash
bash scripts/lab/vps/05-verificar-pii-y-respaldo.sh
bash scripts/lab/vps/06-verificar-invalidacion-sesion.sh
```

Revisa y deja evidencia de:

- `Order.customerPhone` y `Repair.dniEncrypted` son ciphertext `iv:tag:cipher`.
- No queda ningún teléfono/DNI en texto plano.
- `.env` y `dev.db` están en modo `600` y no los puede leer `www-data`.
- Respaldo `.backup` + `PRAGMA integrity_check` + conteo de filas.
- `npm audit` (dependencias) y paquetes actualizables del sistema.
- `AuditLog` con `LOGIN_FAILED` / `LOGIN_RATELIMIT` / `CSP_VIOLATION` (V7.1.3).
- Un JWT emitido antes del logout deja de abrir el panel (307) y las APIs
  responden 401 (V3.3.1 / V3.3.3).

---

## 5. Pruebas manuales con Burp Suite (las que más impresionan)

Estas no se pueden automatizar bien porque Next.js usa **Server Actions**
(POST con cabecera `Next-Action` y cuerpo JSON). Burp las intercepta sin
problema. Configura el navegador de la VM negra con proxy `127.0.0.1:8080`.

### 5.1 Manipulación de precio en el checkout (V4.1.3 / V5)

1. En `https://infosistel.lab/cotizacion`, agrega un producto y abre el carrito.
2. En Burp, activa *Intercept*.
3. Completa nombre, celular `987654321` y pulsa **Realizar pedido**.
4. Burp captura un `POST /cotizacion` (o `/tienda`) con:
   ```json
   [{"customerName":"...","customerPhone":"987654321",
     "items":[{"productId":"cm...","quantity":1}]}]
   ```
5. **Modifica el cuerpo** y agrega campos que el cliente no debería poder fijar:
   ```json
   [{"customerName":"...","customerPhone":"987654321",
     "total":1,"items":[{"productId":"cm...","quantity":1,"price":1,"unitPrice":1}]}]
   ```
6. *Forward*. La app **ignora** `total`, `price` y `unitPrice` (Zod los
   descarta y el servidor relee el precio de SQLite). En
   `/taller-control/pedidos` el total real aparece intacto.
7. Evidencia: captura del request modificado + captura del pedido con el total
   real + `sqlite3` mostrando `Order.total`.

### 5.2 Validación Zod (V5)

En el mismo request cambia:

- `"customerPhone":"123"` → error «Celular inválido (9 dígitos…)».
- `"items":[{"productId":"...","quantity":0}]` → error de cantidad.
- `"items":[]` → «El carrito está vacío».

La solicitud se rechaza **antes** de tocar la base de datos.

### 5.3 Cookie de sesión y JWT (V3)

1. Inicia sesión en `/taller-control/login` (usuario/contraseña + TOTP si está
   activo).
2. DevTools → Application → Cookies: `infosistel_session` debe tener
   `HttpOnly`, `Secure`, `SameSite=Lax`.
3. Copia el JWT, decodifica el payload en <https://jwt.io> y cambia
   `"role":"admin"` por `"role":"superadmin"` **sin volver a firmar**.
4. Reemplaza la cookie y recarga `/taller-control/usuarios`: el proxy rechaza
   la firma y redirige al login (307).

### 5.4 Fuerza bruta al login (V2.2.1)

1. Cierra sesión.
2. Intenta 5 veces con contraseña incorrecta.
3. El **sexto** intento responde con el mensaje de «Demasiadas solicitudes» /
   HTTP 429 (límite de aplicación: 5 intentos / 15 min / IP).
4. Espera o reinicia el proceso (`pm2 restart infosistel-v2`) para limpiar el
   limitador en memoria antes de la siguiente prueba.
5. En la VM azul, comprueba el registro persistente (V7.1.3):
   ```bash
   sqlite3 "$DATABASE_URL" \
     'SELECT action, username, ipAddress, createdAt FROM AuditLog ORDER BY createdAt DESC LIMIT 10;'
   ```
   Deben aparecer `LOGIN_FAILED` y `LOGIN_RATELIMIT` con la IP `10.10.10.10`.

> En v2 el límite de login vive en `actions.ts` (`checkRateLimit`), no en
> Nginx. Si el jurado pregunta por la diferencia con el Capítulo III, explica
> que se movió a la aplicación para que también funcione si alguien llega
> directo a Node, y que Nginx conserva el límite global y el de `/api/`.

### 5.5 Enumeración por tiempo (V2.1.1 / Fase 3)

Con Burp Intruder o `curl` sobre la Server Action, mide el tiempo de respuesta
para un usuario existente con contraseña incorrecta y para un usuario
inexistente. Deben ser **similares**, porque el código ejecuta `scryptSync`
con una sal ficticia cuando el usuario no existe (`burnPasswordCheckTime`).

---

## 6. Guion de exposición (20–25 min)

1. **Contexto (2 min):** problema, 31 requisitos ASVS, 58,1 % de cumplimiento
   inicial. Muestra la Tabla 5 del Capítulo III.
2. **Arquitectura (2 min):** diagrama de las dos VMs, aclara que es réplica del
   VPS y que la evidencia de producción está en el Capítulo IV.
3. **Cabeceras y TLS (3 min):** `01` y `02`. Muestra el nonce cambiando entre
   dos requests y el fallo de TLS 1.0.
4. **Red (3 min):** `03` (nmap) + Hydra/Fail2ban. Este es el bloque que más
   impacto tiene: «el puerto 3000 no existe para el atacante».
5. **Aplicación (4 min):** `05` (sin sesión), `06` (`costPrice`), Burp de precio
   manipulado y Zod.
6. **Datos (3 min):** `vps/05`: ciphertext, índice ciego, permisos 600,
   restauración del respaldo.
7. **Rate limit y SQLi (3 min):** `04`: ráfaga → 429, `UNION SELECT` → 403,
   sqlmap/Nikto → 444.
8. **Cierre (2 min):** ZAP baseline, tabla antes/después, limitaciones
   honestas (V8.1.5/V8.1.6 sigue Parcial por el respaldo externo).

Orden sugerido de ventanas: VM azul con `htop`/`pm2 logs` a un lado, VM negra
con la terminal grande. Ten el snapshot listo para revertir.

---

## 7. Preguntas probables del jurado (y respuestas cortas)

**«¿Por qué Kali como servidor si producción es Arch?»**
Porque los controles demostrados (Nginx, TLS, cabeceras, rate limit, Fail2ban,
Firewalld, SSH, la app) son independientes de la distro. Lo que sí cambia es la
herramienta de parcheo (`arch-audit` vs `debsecan`), y eso se dice en la
sección 0. La evidencia del VPS real es Arch.

**«El bloqueo por User-Agent es trivial de evadir.»**
Correcto, y no se presenta como frontera de seguridad. Es reducción de ruido.
La defensa real es el filtro de payloads en Nginx + consultas parametrizadas de
Prisma. Demuéstralo con `sqlmap --random-agent`: el UA cambia, pero los
payloads siguen bloqueados por el filtro.

**«¿Por qué 403 en unos casos y 444 en otros?»**
403 es una decisión de aplicación/regla (payload SQLi). 444 es Nginx cerrando
la conexión sin responder a herramientas de escaneo conocidas: menos coste y
menos información para el atacante.

**«¿No falsea positivos el filtro Anti-SQLi?»**
Sí: cualquier `'` en el query string devuelve 403 (por ejemplo una búsqueda con
apóstrofo). Es un trade-off deliberado y documentado; la alternativa sería
analizar el AST de cada consulta, fuera del alcance de este proyecto.

**«¿Por qué el respaldo sigue en “Parcial”?»**
Porque vive en el mismo VPS, no tiene programación independiente del despliegue
y no se había probado una restauración completa. Este lab **sí** prueba la
restauración, pero la brecha de destino externo (S3/R2) sigue abierta y se
reporta como recomendación en el Capítulo VIII.

**«¿Esto es el VPS real?»**
No. Es una réplica controlada para demostrar los controles en vivo. Las
evidencias de producción (Hostinger/Arch, 2026-09-08 y 2026-10-20) están en el
Capítulo IV. Mezclarlas sería deshonesto y el jurado lo notaría.

**«¿Por qué no usaron un WAF?»**
Porque el objetivo era hardening verificable con herramientas de código abierto
y sin coste recurrente; un WAF añade una dependencia operativa que la empresa
no puede sostener. Nginx + la app cubren los controles del alcance ASVS.

---

## 8. Limitaciones y cuidados

- **No ejecutes el ransomware simulado ni los escaneos del repo `infosistelab`
  contra esta VM** salvo que quieras demostrar el “antes”: son laboratorios
  distintos. Este kit solo prueba la versión endurecida.
- Los escaneos de rate limit dejan la IP de la VM negra bloqueada unos minutos.
  El script 04 espera 65 s al final si lo ejecutas suelto; el orquestador
  `correr-todo.sh` lo omite porque 04 es la última prueba del recorrido.
- Hydra contra SSH deja la IP baneada por Fail2ban. Para desbanear:
  ```bash
  # En la VM azul
  sudo fail2ban-client set sshd unbanip 10.10.10.10
  ```
- Si cambias el dominio, actualiza `/etc/hosts` en ambas VMs, el
  `server_name` de Nginx y el certificado.
- Guarda la autorización del docente/empresa junto con las evidencias. En Perú
  siguen aplicando la Ley N° 29733 y la Ley N° 30096.

---

## 9. Estructura del kit

```
scripts/lab/
├── README.md                        ← este documento
├── vps/
│   ├── 00-instalar-base.sh          ← nginx, node, pm2, fail2ban, firewalld
│   ├── 01-certificado-lab.sh        ← CA + certificado para infosistel.lab
│   ├── 02-ssh-firewall.sh           ← SSH 2244, llave, Firewalld
│   ├── 03-fail2ban.sh               ← jail sshd sobre 2244
│   ├── 04-desplegar-app.sh          ← .env, BD, Prisma, build, PM2, nginx
│   ├── 05-verificar-pii-y-respaldo.sh
│   ├── 06-verificar-invalidacion-sesion.sh
│   ├── generar-jwt.ts               ← emite un JWT con el tokenVersion actual
│   ├── nginx-infosistel-lab.conf    ← Nginx adaptado al lab
│   └── sembrar-datos-lab.ts         ← admin + producto + pedido + reparación
└── atacante/
    ├── 00-instalar-herramientas.sh
    ├── lib.sh                       ← helpers y contadores PASS/FAIL
    ├── correr-todo.sh               ← orquestador
    ├── 01-huella-y-cabeceras.sh
    ├── 02-tls.sh
    ├── 03-puertos.sh
    ├── 04-rate-limit-y-filtros.sh
    ├── 05-acceso-admin.sh
    ├── 06-datos-minimo-privilegio.sh
    ├── 07-exposicion-archivos.sh
    └── 08-zap-baseline.sh
```

---

## 10. Correcciones de código aplicadas por este kit

Antes de la exposición se corrigieron dos huecos reales de V3.3.1/V3.3.3 que
la re-auditoría del Capítulo VI no había cubierto (el mecanismo `tokenVersion`
existía, pero no se aplicaba a todas las lecturas):

1. `src/app/taller-control/(panel)/layout.tsx` ahora usa `requireSession()`
   en vez de verificar solo la firma del JWT. Así, un token copiado antes de
   un logout deja de abrir **cualquier** página del panel (307 al login).
2. `src/app/api/admin-chat/route.ts` ahora compara `Admin.tokenVersion`
   contra el claim `v` del JWT y responde 401 si no coincide. Antes, un token
   revocado todavía podía usar el chatbot y sus herramientas de escritura.
3. `scripts/create-admin.ts` ya no tiene credenciales hardcodeadas: exige
   usuario y contraseña por argumento, rechaza contraseñas de menos de 12
   caracteres, conserva el estado de MFA al actualizar y incrementa
   `tokenVersion` para invalidar sesiones previas (V2.1.1 / V2.5.4).

Además, `scripts/backup-db.sh` ahora acepta `DATA_DIR` (con la ruta de
producción como valor por defecto), para que el mismo script de respaldo
funcione en el laboratorio; `vps/05` lo ejecuta de verdad, no una copia
artesanal.

La prueba `scripts/lab/vps/06-verificar-invalidacion-sesion.sh` demuestra
las tres correcciones de seguridad de punta a punta (la tercera, con un admin
nuevo).

## 11. Hallazgos a corregir antes de la exposición

Detectados al preparar este kit y que el jurado podría encontrar leyendo el
repositorio:

1. **El filtro SQLi de `src/proxy.ts` no cubre espacios codificados como `+`.**
   La regla `union\s+select` no coincide con `union+select` (que es como el
   navegador envía los espacios en el query string). En producción lo tapa
   Nginx, que sí inspecciona el `$query_string` crudo, pero conviene corregirlo
   en la app: `union[\s+]+select` y normalizar `+` → espacio.
2. **La regla de Nginx `location ~ /\.(env|git|sh|sql|log)$` solo bloquea si el
   URI termina en `.git`**, no `/.git/config`. Hoy Next devuelve 404, así que no
   hay fuga, pero la regla debería ser `location ~ /\.(?!well-known)`.
3. **`npm audit` ya no reporta 0 vulnerabilidades.** Al preparar este kit
   (2026-11-07) el árbol actual reporta **9 avisos: 1 moderado, 6 altos y 2
   críticos** (`zod < 4.6.6`, `undici`, `source-map-js`). La tesis afirma
   «0 vulnerabilidades» con fecha 2026-09-08; los avisos son posteriores, pero
   el jurado puede ejecutar `npm audit` y verlos. Antes de la demo:
   - ejecuta `npm audit fix` (sin `--force`) y vuelve a correr `npm run build`
     + las pruebas;
   - si alguna actualización rompe algo, documenta el riesgo residual y la
     fecha, en vez de ocultarlo. La frase «0 vulnerabilidades al 2026-09-08»
     debe ir acompañada de la fecha, no presentada como un estado eterno.
4. **La whitelist de métodos vive solo en Nginx.** `PUT /`, `DELETE /` y
   `TRACE /` llegan a Next si se accede directo a `:3000` (Firewalld lo impide,
   pero es una sola capa). Añadir en `src/proxy.ts` un rechazo temprano de
   métodos distintos de GET/HEAD para páginas públicas sería defensa en
   profundidad; no es bloqueante para la demo porque el puerto 3000 está
   filtrado.

> Corregir estos puntos antes de la exposición es más valioso que añadir
> una prueba nueva: el jurado suele leer el código tanto como mira la terminal.
