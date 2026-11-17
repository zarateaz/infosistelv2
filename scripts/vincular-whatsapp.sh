#!/bin/bash
# scripts/vincular-whatsapp.sh
# Permite ver el código QR en la consola de tu VPS para escanear con el WhatsApp de Infosistel.

cd /home/zarate/infosistel-v2 || exit 1

echo "=========================================================="
echo "    INFOSISTEL — VINCULACIÓN DE WHATSAPP"
echo "=========================================================="
echo "Comprobando estado del servicio..."

STATUS=$(curl -s http://127.0.0.1:3005/status 2>/dev/null)
echo "$STATUS"

echo ""
echo "Si ves el código QR abajo, abre tu WhatsApp en el celular:"
echo "Menú (3 puntos) > Dispositivos vinculados > Vincular un dispositivo"
echo "=========================================================="
echo ""

npx pm2 logs infosistel-whatsapp --lines 50 --nostream

