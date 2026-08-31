# Fase 5 — Hardening de infraestructura VPS

Este documento es un **runbook para que tú lo ejecutes manualmente** en tu propia sesión SSH,
igual que `docs/deploy-vps.md` — nada de esto se ejecuta automáticamente ni por Claude ni por
ningún proceso del repo (ver `feedback-vps-production-caution` en memoria: nunca me conecto
directo al VPS de producción).

Es la fase que da nombre a la tesis (*"...en Entorno VPS..."*) y la única que falta: Fases 0–4 ya
están implementadas y documentadas en `hardening-log.md`, a nivel de aplicación. Esta fase trabaja
la capa de **infraestructura** — el sistema operativo y los servicios que corren alrededor de la
app (SSH, firewall, Nginx/TLS, actualizaciones) — siguiendo NIST SP 800-123 (*Guide to General
Server Security*) y el checklist de configuración de OWASP.

**Cómo usar este documento**: cada sección tiene comandos para copiar/pegar y una casilla de
verificación. Ve marcando conforme avanzas. Al final hay una plantilla para que me pegues las
salidas de los comandos de verificación — con eso redacto la entrada #24 de `hardening-log.md` y
el contenido real del Capítulo IV de la tesis (la fase de VPS), en vez de que yo intente
adivinarlo.

Antes de empezar, identifica tu distribución (los comandos de paquetes cambian según cuál sea):

```bash
cat /etc/os-release
```

- Si dice `ID=ubuntu` o `ID=debian` → usa los bloques marcados **[apt]**.
- Si dice `ID="almalinux"`, `ID="rocky"` o `ID="centos"` → usa los bloques marcados **[dnf]**.

---

## 5.1 Cuentas y acceso SSH

Referencia: NIST SP 800-123 §3.1 (autenticación), OWASP ASVS V2 (autenticación), CIS Benchmark SSH.

- [ ] **Confirma que ya no usas la cuenta `root` para trabajar.** Ya usas `zarate` con sudo —
  verifica que root no tiene una contraseña débil o reutilizada de otro sistema, aunque no la
  uses a diario (sigue siendo una puerta de entrada):
  ```bash
  sudo passwd -S root
  ```

- [ ] **Autenticación solo por clave pública, nunca por contraseña.** Confirma primero que tu
  clave ya funciona (verifica que puedes entrar como `zarate` sin que te pida contraseña) antes
  de deshabilitar el login por contraseña — si te equivocas en este paso sin haberlo confirmado
  antes, puedes quedarte fuera del servidor.
  ```bash
  sudo nano /etc/ssh/sshd_config
  ```
  Confirma/ajusta estas líneas:
  ```
  PermitRootLogin no
  PasswordAuthentication no
  PubkeyAuthentication yes
  PermitEmptyPasswords no
  MaxAuthTries 4
  ```
  Aplica sin cerrar tu sesión SSH actual (para poder revertir si algo falla):
  ```bash
  sudo sshd -t                 # valida la sintaxis antes de aplicar
  sudo systemctl reload sshd
  ```
  Abre una **segunda** terminal nueva y confirma que aún puedes entrar antes de cerrar la
  primera.

- [ ] **(Opcional pero recomendado) Cambiar el puerto SSH del 22 por defecto.** No es seguridad
  real (es seguridad por oscuridad, igual que el rename de `/admin` a `/taller-control` que ya
  hicimos en la app — ver entrada #22 de `hardening-log.md`), pero reduce el ruido de escaneos
  automatizados de credential-stuffing contra el puerto estándar. Si lo haces, actualiza también
  la regla del firewall en el paso 5.2.

---

## 5.2 Firewall — solo los puertos que la app necesita

Referencia: NIST SP 800-123 §3.4 (servicios innecesarios deshabilitados), OWASP ASVS V1
(arquitectura, superficie de exposición mínima).

**[apt] Ubuntu/Debian — `ufw`:**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # o el puerto que hayas elegido en 5.1
sudo ufw allow 80/tcp      # HTTP — necesario para el desafío de certbot
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status verbose
```

**[dnf] AlmaLinux/Rocky/CentOS — `firewalld`:**
```bash
sudo systemctl enable --now firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

- [ ] Confirma que **ningún otro puerto** responde desde afuera — en particular el 3000 (donde
  corre PM2 directamente) no debe ser alcanzable desde internet, solo desde `localhost` vía el
  proxy de nginx. Desde tu propia máquina (no desde el VPS):
  ```bash
  nmap -Pn -p 22,80,443,3000,3010 <ip-del-vps>
  ```
  Solo 22/80/443 deben aparecer `open`; 3000 y 3010 deben aparecer `filtered` o `closed`.

---

## 5.3 `fail2ban` — bloqueo automático de fuerza bruta

Referencia: OWASP ASVS V2.2.1 (protección contra ataques automatizados de credenciales), complementa
el rate-limit a nivel de aplicación que ya existe en `/taller-control/login` (entrada #13) con uno
a nivel de SO para SSH.

**[apt]:**
```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

**[dnf]:**
```bash
sudo dnf install -y epel-release
sudo dnf install -y fail2ban
sudo systemctl enable --now fail2ban
```

Configura una jail básica para SSH (no edites `jail.conf` directamente — se sobreescribe en cada
actualización del paquete):
```bash
sudo tee /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
maxretry = 4
bantime = 1h
findtime = 10m
EOF
sudo systemctl restart fail2ban
```

- [ ] Verifica que la jail quedó activa:
  ```bash
  sudo fail2ban-client status sshd
  ```

---

## 5.4 Nginx — TLS y endurecimiento a nivel de servidor web

Referencia: NIST SP 800-52 (configuración TLS), OWASP ASVS V9 (comunicaciones). **Importante**:
la entrada #19 de `hardening-log.md` ya documenta por qué `nginx.conf` en este repo **no** lleva
cabeceras de seguridad propias (CSP/X-Frame-Options/HSTS/Permissions-Policy) — esas ya las pone la
app (`next.config.ts` + `src/proxy.ts`, con nonce por request). No las agregues de vuelta a nginx
o quedarán duplicadas con valores distintos.

- [ ] **Certificado TLS real** (si no lo tienes ya — el dominio anterior puede que ya sirva por
  HTTPS, confírmalo primero):
  ```bash
  sudo certbot --nginx -d infosistel.com.pe -d www.infosistel.com.pe
  ```
  Certbot instala un cronjob/timer de renovación automática — confírmalo:
  ```bash
  sudo systemctl list-timers | grep certbot
  ```

- [ ] **Ocultar la versión de nginx** en las cabeceras de respuesta (reduce fingerprinting, mismo
  criterio que quitar `X-Powered-By` de Next.js en la entrada #7):
  ```bash
  sudo nano /etc/nginx/nginx.conf
  ```
  Dentro del bloque `http { ... }`, agrega:
  ```
  server_tokens off;
  ```

- [ ] **Deshabilitar protocolos TLS obsoletos.** Busca la directiva `ssl_protocols` en la
  configuración que generó certbot (normalmente en `/etc/letsencrypt/options-ssl-nginx.conf` o
  directamente en el server block) y confirma que solo permite TLS 1.2 y 1.3:
  ```
  ssl_protocols TLSv1.2 TLSv1.3;
  ```

- [ ] Verifica sintaxis y recarga:
  ```bash
  sudo nginx -t && sudo systemctl reload nginx
  ```

- [ ] Prueba la configuración TLS con una herramienta externa (no requiere instalar nada, corre
  desde tu navegador): [SSL Labs Server Test](https://www.ssllabs.com/ssltest/) contra
  `infosistel.com.pe` — apunta a nota A o superior. Guarda el resultado (captura o el enlace del
  reporte) para el anexo de la tesis.

---

## 5.5 Actualizaciones automáticas de seguridad

Referencia: NIST SP 800-123 §3.3 (aplicación oportuna de parches), OWASP Top 10 A06:2021
(Vulnerable and Outdated Components) — mismo principio que ya se aplicó a nivel de dependencias
npm en la entrada #5, ahora a nivel de sistema operativo.

**[apt]:**
```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```
Confirma que `/etc/apt/apt.conf.d/50unattended-upgrades` incluye al menos las actualizaciones de
seguridad (`${distro_id}:${distro_codename}-security`, ya viene así por defecto).

**[dnf]:**
```bash
sudo dnf install -y dnf-automatic
sudo sed -i 's/^apply_updates = no/apply_updates = yes/' /etc/dnf/automatic.conf
sudo systemctl enable --now dnf-automatic.timer
```

- [ ] Verifica que el timer/servicio quedó activo (`systemctl status unattended-upgrades` o
  `systemctl status dnf-automatic.timer`).

---

## 5.6 Mínimo privilegio en el sistema de archivos

Referencia: NIST SP 800-123 §3.2 (permisos de archivos), mismo principio de mínimo privilegio ya
aplicado en la app (`Admin.role`, entrada #20).

- [ ] Confirma que `.env` (secretos: `JWT_SECRET`, `ENCRYPTION_KEY`, `DNI_HMAC_SECRET`, API keys)
  solo lo puede leer el usuario `zarate`, ya lo pide `docs/deploy-vps.md` paso 1 pero vale
  reconfirmarlo:
  ```bash
  ls -l /home/zarate/infosistel-v2/.env    # debe mostrar -rw------- (600)
  ```
- [ ] Confirma que `/home/zarate/infosistel-v2-data/` (la base de datos SQLite real y las fotos
  de productos subidas) no es legible por otros usuarios del sistema:
  ```bash
  ls -ld /home/zarate/infosistel-v2-data
  ```

---

## 5.7 Verificación final y evidencia para la tesis

Corre esto al terminar todas las secciones anteriores y **pégame la salida completa** — con eso
escribo la entrada #24 de `hardening-log.md` y el desarrollo real del Capítulo IV (apartado de
VPS) en vez de tener que suponer el resultado:

```bash
echo "== SSH ==" && sudo sshd -T | grep -E "permitrootlogin|passwordauthentication"
echo "== Firewall ==" && (sudo ufw status verbose 2>/dev/null || sudo firewall-cmd --list-all)
echo "== fail2ban ==" && sudo fail2ban-client status sshd
echo "== nginx ==" && sudo nginx -T 2>/dev/null | grep -E "server_tokens|ssl_protocol"
echo "== TLS cert ==" && sudo certbot certificates
echo "== updates ==" && (systemctl is-active unattended-upgrades 2>/dev/null || systemctl is-active dnf-automatic.timer)
echo "== permisos ==" && ls -l /home/zarate/infosistel-v2/.env && ls -ld /home/zarate/infosistel-v2-data
```

También pega (o cuéntame) el resultado del SSL Labs test del paso 5.4 — eso completa la
"verificación posterior" que el Capítulo II (objetivo específico e) promete: contrastar el
cumplimiento ASVS antes/después de la intervención.
