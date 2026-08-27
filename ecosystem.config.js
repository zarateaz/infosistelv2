/**
 * ecosystem.config.js — PM2 configuration for INFOSISTEL v2.
 *
 * No secrets live here on purpose (same reasoning as the previous
 * Infosistel project). They come from `.env` on the VPS, loaded by
 * scripts/deploy-vps.sh and passed through to PM2 via `--update-env`.
 * Never commit a real .env — see .gitignore / .env.example.
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
        // DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, DNI_HMAC_SECRET,
        // ANTHROPIC_API_KEY, PRODUCT_IMAGES_DIR → set in .env on the VPS.
      },
    },
  ],
};
