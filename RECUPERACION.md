# Plan de emergencia — INFOSISTEL v2

## Qué se respalda y dónde
| Qué | Cuándo | Dónde |
|---|---|---|
| BD + Servicios Técnicos + `.env` (`infosistel-*.tar.gz`) | Todos los días 3:00 AM Perú y antes de cada despliegue | VPS: `~/infosistel-v2-data/backups/` (últimos 30) |
| Copia de los respaldos + fotos | Cuando corre `scripts/descargar-backups.sh` en tu PC | PC: `~/infosistel-backups/` (hasta 90, nunca se borra por el VPS) |

El `.tar.gz` contiene el `.env` (claves). Trátalo como una contraseña: no lo subas a Drive/WhatsApp sin cifrar.

## Instalar (una sola vez)
- VPS: `bash scripts/instalar-backup-automatico.sh`
- PC: `bash scripts/descargar-backups.sh` y luego el `crontab` que indica el propio script.

## Si se dañan o borran datos (el VPS sigue vivo)
```bash
cd ~/infosistel-v2
bash scripts/restaurar-backup.sh            # lista respaldos
bash scripts/restaurar-backup.sh ~/infosistel-v2-data/backups/infosistel-AAAAMMDD-HHMMSS-diario.tar.gz
```
Pide escribir `RESTAURAR`, guarda antes el estado actual (`-pre-restauracion`), restaura y reinicia.

## Si hackean el VPS o se pierde
1. No confíes en ese VPS: crea uno nuevo (o reinstala) y **cambia las contraseñas** (panel, SSH, Hostinger, GitHub, DeepSeek, NubeFacT).
2. Instala la app: `git clone` + `bash scripts/deploy-vps.sh`.
3. Sube desde tu PC el último respaldo y las fotos:
   ```bash
   scp -P 2244 ~/infosistel-backups/respaldos/infosistel-ULTIMO.tar.gz zarate@IP:~/infosistel-v2-data/backups/
   rsync -az -e "ssh -p 2244" ~/infosistel-backups/fotos/ zarate@IP:~/infosistel-v2-data/uploads/
   ```
4. `bash scripts/restaurar-backup.sh ~/infosistel-v2-data/backups/infosistel-ULTIMO.tar.gz --con-env`
5. Rota las claves del `.env` (JWT_SECRET cierra todas las sesiones). **No cambies `ENCRYPTION_KEY`** o no podrás leer los datos cifrados.
6. Vuelve a vincular WhatsApp: `bash scripts/vincular-whatsapp.sh`.
