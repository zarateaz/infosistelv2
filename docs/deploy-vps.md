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
ANTHROPIC_API_KEY="..."   # console.anthropic.com — habilita el chat y "Reconocer con IA"
```

**Nunca cambies `DNI_HMAC_SECRET` una vez que haya pedidos reales guardados** — invalida el índice
de búsqueda por teléfono de todos los pedidos existentes (ver `docs/security/hardening-log.md`,
entrada #15).

```bash
chmod 600 .env
```

## 2. Probar en un puerto aparte (recomendado, no te saltes esto)

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
- Login de admin (`/admin/login`) con la cuenta que crees vía
  `npx tsx scripts/create-admin.ts <usuario> <password>`.
- Crear un producto con foto (confirma que `PRODUCT_IMAGES_DIR` funciona).
- Un pedido de prueba desde `/tienda` (confirma cifrado del teléfono).

Cuando quede conforme, revierte el cambio de prueba:

```bash
git checkout ecosystem.config.js
npx pm2 delete infosistel-v2-test
```

## 3. Corte a producción

Con v2 ya probado en el puerto 3010, el corte real es: apagar el proceso PM2 del sitio anterior y
levantar v2 en el puerto 3000 (el mismo que nginx ya espera — **nginx no necesita ningún cambio**,
solo reenvía a `localhost:3000`).

```bash
# 1. Apaga el sitio anterior (NO lo borres — es tu plan de rollback)
npx pm2 stop infosistel

# 2. Levanta v2 en el puerto real
cd /home/zarate/infosistel-v2
bash scripts/deploy-vps.sh

# 3. Confirma que responde en el dominio real
curl -I https://infosistel.com.pe
```

## 4. Si algo sale mal — volver atrás

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
- `nginx.conf` en este repo es el mismo del sitio anterior con dos ajustes (ver el comentario en el
  encabezado del archivo) — no hace falta tocar nginx para este despliegue, ya que ambos sitios
  usan el mismo dominio y puerto. Si en algún momento quieres aplicar cambios a la config real en
  el VPS, cópialo tú mismo y corre `nginx -t` antes de recargar.
- Redeploys posteriores (una vez ya migraste) son solo `git pull && bash scripts/deploy-vps.sh` —
  el script ya asume el puerto 3000 real.
