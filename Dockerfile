# Usa Node LTS basado en Debian Slim (mejor compatibilidad con Prisma/SQLite que Alpine)
FROM node:22-slim AS base

# Dependencias del sistema necesarias para compilar/ejecutar Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app

# Instalar dependencias de compilación para native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generar el cliente Prisma y compilar Next.js (Standalone)
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Seteamos localhost para que no exponga directo, aunque docker-compose mapea el puerto
ENV HOSTNAME="127.0.0.1"

# Copiamos los archivos de configuración
COPY --from=builder /app/package.json ./

# Copiamos la salida standalone de Next.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Directorio que será montado como volumen
RUN mkdir -p /data/uploads/products /data/uploads/servicios

EXPOSE 3000

# Iniciamos el servidor Next.js standalone
CMD ["node", "server.js"]
