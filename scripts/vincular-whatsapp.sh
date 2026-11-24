#!/bin/bash
# scripts/vincular-whatsapp.sh
# Permite ver el código QR en la consola de tu VPS para escanear con el WhatsApp de Infosistel.

cd /home/zarate/infosistel-v2 || exit 1

echo "=========================================================="
echo "    INFOSISTEL — VINCULACIÓN DE WHATSAPP"
echo "=========================================================="
echo "Comprobando estado del servicio..."

STATUS=$(curl -s http://127.0.0.1:3005/status 2>/dev/null)

if echo "$STATUS" | grep -q '"connected":true'; then
  PHONE=$(echo "$STATUS" | grep -o '"phone":"[^"]*"' | cut -d'"' -f4)
  echo ""
  echo "✅ ¡WHATSAPP YA ESTÁ CONECTADO Y FUNCIONANDO!"
  echo "Número vinculado: +$PHONE"
  echo "El bot y los recordatorios automáticos están activos."
  echo "=========================================================="
  exit 0
fi

echo ""
echo "Generando código QR fresco..."
npx pm2 restart infosistel-whatsapp >/dev/null 2>&1
sleep 2

echo ""
echo "Abre WhatsApp en tu celular:"
echo "👉 Menú (3 puntos) > Dispositivos vinculados > Vincular un dispositivo"
echo "👉 Apunta la cámara al código QR que aparecerá abajo:"
echo "=========================================================="
echo ""

echo "Si prefieres verlo en el navegador de tu PC (el gateway ya no está expuesto a internet):"
echo "   en tu PC:  ssh -p 2244 -L 3005:127.0.0.1:3005 zarate@187.127.20.171"
echo "   y abre:    http://localhost:3005/qr"
echo ""

npx pm2 logs infosistel-whatsapp --lines 40

