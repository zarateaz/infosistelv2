# Desplegar INFOSISTEL v2 en el VPS

Este documento es para que **tú** lo sigas manualmente en tu propia sesión SSH — nada de esto se
ejecuta automáticamente, ni por Claude ni por ningún proceso del repo. Sigue el patrón que ya
usabas: comandos para copiar y pegar, revisando cada paso.

**Contexto importante**: el dominio `infosistel.com.pe` hoy sirve el sitio anterior (el proyecto
en `/home/zarate/infosistel`). Desplegar v2 en el mismo dominio significa **reemplazar** ese sitio
por este, no agregar uno al lado. Por eso el plan de abajo prueba todo en un puerto aparte antes
de tocar el dominio real — cero margen de error significa no cortar directo a producción sin
haberlo visto funcionar primero.

## 0. Antes de empezar

- Repo de v2 subido a GitHub y clonado en el VPS (o copiado por `rsync`/`scp`) en
  `/home/zarate/infosistel-v2`.
- Node.js y PM2 ya deben estar instalados (el VPS ya los tiene — sirvió el sitio anterior).
- Un directorio de datos persistente, **fuera** del repo, que sobrevive a cada `git pull` y cada
  build:
  ```bash
  mkdir -p /home/zarate/infosistel-v2-data/backups
  mkdir -p /home/zarate/infosistel-v2-data/uploads/products
  ```

## 1. Configurar `.env`

```bash
cd /home/zarate/infosistel-v2
cp .env.example .env
nano .env   # o el editor que prefieras
```

Completa:

```bash
DATABASE_URL="file:/home/zarate/infosistel-v2-data/dev.db"
PRODUCT_IMAGES_DIR="/home/zarate/infosistel-v2-data/uploads/products"
JWT_SECRET="$(openssl rand -base64 64)"
ENCRYPTION_KEY="$(openssl rand -hex 32)"
DNI_HMAC_SECRET="$(openssl rand -hex 32)"
ANTHROPIC_API_KEY="..."   # console.anthropic.com — habilita "Reconocer con IA" en el escáner
DEEPSEEK_API_KEY="..."    # platform.deepseek.com/api_keys — habilita el chatbot público
```

**Nunca cambies `DNI_HMAC_SECRET` una vez que haya pedidos reales guardados** — invalida el índice
de búsqueda por teléfono de todos los pedidos existentes (ver `docs/security/hardening-log.md`,
entrada #15).

```bash
chmod 600 .env
```

## 2. Decide qué catálogo va a mostrar el sitio el día 1

`scripts/deploy-vps.sh` **no siembra ningún producto** — `prisma migrate deploy` solo crea las
tablas, nunca ejecuta seeds. La base de datos en el VPS arranca completamente vacía (sin
productos, sin categorías); `/tienda` lo maneja bien ("Sin resultados", sin errores).

`prisma/seed.ts` sí existe en el repo, pero son **16 productos de demostración** (RAM Kingston,
mouse Logitech, etc.) con precios y stock inventados para probar el catálogo durante el
desarrollo — **nunca lo corras contra la base de datos de producción** (`npx prisma db seed`)
a menos que quieras que esos precios y ese stock falsos sean lo primero que vea un cliente real.

Dos caminos razonables:
- **Arrancar vacío** y cargar tu inventario real desde `/taller-control/productos` (con el escáner de
  código de barras / reconocimiento por foto) antes de anunciar el sitio.
- **Precargar tu catálogo real** editando `prisma/seed.ts` con tus productos, precios y stock
  reales antes del primer deploy, y corriendo `npx prisma db seed` una sola vez.

Crea tu cuenta de administrador real (no uses "admin" de prueba) antes de dar por terminado el
despliegue. `tsx` no carga `.env` solo — sin `--env-file`, este comando escribiría el admin en un
`dev.db` relativo al directorio donde lo corras, no en tu base de datos real de `DATABASE_URL`:

```bash
npx tsx --env-file=.env scripts/create-admin.ts <tu-usuario> <tu-contraseña>
```

## 3. Probar en un puerto aparte (recomendado, no te saltes esto)

Antes de tocar nginx o el sitio anterior, corre v2 en un puerto que nadie más usa:

```bash
cd /home/zarate/infosistel-v2
sed -i 's/name: "infosistel-v2"/name: "infosistel-v2-test"/; s/PORT: 3000/PORT: 3010/' ecosystem.config.js
bash scripts/deploy-vps.sh
```

El script instala dependencias, corre las migraciones de Prisma, hace el build y arranca PM2 —
falla ruidosamente (`set -euo pipefail`) si algo sale mal, en vez de dejar un estado a medias.

Revisa que responda:

```bash
curl -I http://127.0.0.1:3010
```

Prueba manualmente desde tu navegador vía un túnel SSH (`ssh -L 3010:localhost:3010 zarate@tu-vps`)
o agregando temporalmente un `server_name` de prueba en nginx apuntando al puerto 3010. Verifica
en especial:
- Login de admin (`/taller-control/login`) con la cuenta que crees vía
  `npx tsx --env-file=.env scripts/create-admin.ts <usuario> <password>`.
- Crear un producto con foto (confirma que `PRODUCT_IMAGES_DIR` funciona).
- Un pedido de prueba desde `/tienda` (confirma cifrado del teléfono).

Cuando quede conforme, revierte el cambio de prueba:

```bash
git checkout ecosystem.config.js
npx pm2 delete infosistel-v2-test
```

## 4. Corte a producción

Con v2 ya probado en el puerto 3010, el corte real es: aplicar el `nginx.conf` de este repo
(paso obligatorio ahora, ver la nota abajo), apagar el proceso PM2 del sitio anterior y levantar
v2 en el puerto 3000 (el mismo que nginx ya espera).

**Antes que nada, copia el `nginx.conf` de este repo a la configuración real** — a diferencia de
un despliegue normal, esta vez SÍ hace falta tocar nginx (ver "Fotos de producto" en Notas, abajo):

```bash
sudo cp /home/zarate/infosistel-v2/nginx.conf /etc/nginx/conf.d/infosistel.conf   # o donde viva la config real
sudo nginx -t   # valida sintaxis ANTES de recargar
sudo systemctl reload nginx
```

```bash
# 1. Apaga el sitio anterior (NO lo borres — es tu plan de rollback)
npx pm2 stop infosistel

# 2. Levanta v2 en el puerto real
cd /home/zarate/infosistel-v2
bash scripts/deploy-vps.sh

# 3. Confirma que responde en el dominio real
curl -I https://infosistel.com.pe
```

## 5. Si algo sale mal — volver atrás

```bash
npx pm2 stop infosistel-v2
npx pm2 start infosistel   # el proceso del sitio anterior, tal como estaba
```

El sitio anterior no se tocó en ningún momento — su base de datos y sus fotos siguen intactas en
su propio directorio (`/home/zarate/infosistel`), completamente separadas de
`/home/zarate/infosistel-v2-data`.

## Notas

- `scripts/deploy-vps.sh` hace un backup de la base de datos (`cp -a`) antes de cada build —
  revisa `/home/zarate/infosistel-v2-data/backups/` si algo se ve raro después de un deploy.
- `nginx.conf` en este repo es el mismo del sitio anterior con tres ajustes (ver el comentario en
  el encabezado del archivo) — cópialo tú mismo y corre `nginx -t` antes de recargar cada vez que
  cambie en el repo.
- **Fotos de producto — bloque de nginx obligatorio.** El servidor standalone de Next.js indexa su
  carpeta `public/` una sola vez al arrancar y no detecta archivos escritos después: una foto
  subida, descargada de un código de barras o elegida en el buscador de imágenes devuelve 404
  hasta el próximo reinicio del proceso PM2. `nginx.conf` ya trae el bloque
  `location /img/products/ { alias ...; }` que sirve esas fotos directo desde
  `PRODUCT_IMAGES_DIR` sin pasar por Node — confirma que la ruta del `alias` coincide exactamente
  con tu `PRODUCT_IMAGES_DIR` real antes de recargar nginx. Ver `hardening-log.md`, entrada #28.
- **Fotos de producto — permisos.** El código ahora fija 644/755 en cada foto/directorio nuevo
  (ver `hardening-log.md`, entrada #30), pero eso solo corrige archivos escritos *después* de este
  deploy. Si ya tenías fotos guardadas con el bug anterior (rotas para nginx aunque existan en
  disco), corrige las existentes una sola vez:
  ```bash
  sudo chmod 755 "$PRODUCT_IMAGES_DIR"
  sudo chmod 644 "$PRODUCT_IMAGES_DIR"/*.webp
  ```
  (reemplaza `$PRODUCT_IMAGES_DIR` por la ruta real de tu `.env`, p. ej.
  `/home/zarate/infosistel-v2-data/uploads/products`). Después de esto, cualquier foto que ya
  estuviera "rota" en el navegador debería cargar sin necesidad de volver a escanearla.
- Redeploys posteriores (una vez ya migraste) son solo `git pull && bash scripts/deploy-vps.sh` —
  el script ya asume el puerto 3000 real.
