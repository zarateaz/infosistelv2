/**
 * ecosystem.config.js — PM2 configuration for INFOSISTEL v2.
 *
 * No secrets live here on purpose. They come from `.env` on the VPS,
 * loaded by scripts/deploy-vps.sh and passed through to PM2 via `--update-env`.
 */
module.exports = {
  apps: [
    {
      name: "infosistel-v2",
      script: ".next/standalone/server.js",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
        SERVICIOS_TECNICOS_DIR: "/home/zarate/infosistel-v2-data/servicios-tecnicos",
      },
    },
    {
      name: "infosistel-whatsapp",
      script: "scripts/whatsapp-gateway/server.ts",
      interpreter: "./node_modules/.bin/tsx",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        WHATSAPP_PORT: 3005,
        WHATSAPP_AUTH_DIR: "/home/zarate/infosistel-v2-data/whatsapp-auth",
      },
    },
  ],
};
