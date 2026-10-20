#!/usr/bin/env node
/**
 * scripts/devops/ship.ts
 *
 * Autonomous DevOps Agent for INFOSISTEL v2 powered by DeepSeek.
 *
 * Workflow:
 * 1. Analyzes user prompt & identifies target files in the codebase.
 * 2. Uses DeepSeek API to interpret instructions and update code.
 * 3. Validates compilation (npx tsc --noEmit) with auto-healing self-retry.
 * 4. Executes git add, commits with an AI-generated message, and pushes to GitHub.
 * 5. Triggers deployment on VPS (scripts/deploy-vps.sh) so changes go live instantly.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ── 1. Configuration & Environment ──────────────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, "../../");
process.chdir(ROOT_DIR);

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = path.join(ROOT_DIR, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return { ...env, ...(process.env as Record<string, string>) };
}

const env = loadEnv();
const DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY || "";
const VPS_HOST = env.VPS_HOST || "";
const VPS_USER = env.VPS_USER || "zarate";
const VPS_PORT = env.VPS_PORT || "22";
const VPS_DIR = env.VPS_DIR || "/home/zarate/infosistel-v2";

// ── 2. Helpers & Terminal UI ────────────────────────────────────────────────

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

function log(stage: string, msg: string, color = colors.cyan) {
  console.log(`${color}${colors.bold}[${stage}]${colors.reset} ${msg}`);
}

function runCmd(cmd: string, cwd = ROOT_DIR): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const output = (error.stdout || "") + "\n" + (error.stderr || "") + "\n" + (error.message || "");
    throw new Error(output.trim());
  }
}

// ── 3. DeepSeek API Client ──────────────────────────────────────────────────

async function callDeepSeek(messages: Array<{ role: string; content: string }>, jsonMode = false): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("ERROR: DEEPSEEK_API_KEY no está configurada en .env ni como variable de entorno.");
  }

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.1,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ── 4. Project Scan & Relevant Files ────────────────────────────────────────

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "backups",
  "coverage",
  "uploads",
  ".agents",
]);

function scanProjectFiles(dir: string, baseDir = dir): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      result.push(...scanProjectFiles(fullPath, baseDir));
    } else if (
      relPath.endsWith(".ts") ||
      relPath.endsWith(".tsx") ||
      relPath.endsWith(".js") ||
      relPath.endsWith(".mjs") ||
      relPath.endsWith(".json") ||
      relPath.endsWith(".css") ||
      relPath.endsWith(".prisma")
    ) {
      result.push(relPath);
    }
  }
  return result;
}

// ── 5. Main Autonomous DevOps Loop ──────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const prompt = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  const dryRun = args.includes("--dry-run");
  const skipDeploy = args.includes("--no-deploy");

  if (!prompt) {
    console.log(`
${colors.bold}${colors.cyan}INFOSISTEL v2 - Autonomous DevOps Agent (DeepSeek)${colors.reset}
${colors.dim}Uso desde Termux o Terminal:${colors.reset}
  npx tsx scripts/devops/ship.ts "tu idea o cambio aquí"

${colors.dim}Opciones:${colors.reset}
  --dry-run      Modifica y valida con TypeScript, pero no hace commit, push ni deploy.
  --no-deploy    Hace commit y push a GitHub, pero salta el deploy en VPS.
`);
    process.exit(1);
  }

  const startTime = Date.now();
  console.log(`\n${colors.bold}${colors.magenta}🚀 INICIANDO SHIP PIPELINE${colors.reset}`);
  log("PROMPT", prompt, colors.cyan);

  // Paso 1: Exploración de archivos del proyecto
  log("1/5", "Indexando archivos relevantes del proyecto...", colors.cyan);
  const allFiles = scanProjectFiles(ROOT_DIR);

  // Paso 2: Selección de archivos con DeepSeek
  log("2/5", "Consultando a DeepSeek para seleccionar archivos afectados...", colors.cyan);
  const selectPrompt = `Eres el Arquitecto DevOps Senior de INFOSISTEL v2 (Next.js 16 App Router, React 19, Tailwind v4, Prisma SQLite).
El usuario quiere hacer este cambio:
"${prompt}"

Lista de archivos disponibles en el repositorio:
${allFiles.slice(0, 300).join("\n")}

Responde ÚNICAMENTE un JSON con este formato exacto:
{
  "targetFiles": ["ruta/del/archivo1.tsx", "ruta/del/archivo2.ts"],
  "summary": "Breve explicación de la estrategia de cambio"
}
Selecciona máximo 3 archivos que realmente necesiten ser modificados para cumplir la orden.`;

  const selectResponse = await callDeepSeek(
    [{ role: "user", content: selectPrompt }],
    true
  );

  let plan: { targetFiles: string[]; summary: string };
  try {
    plan = JSON.parse(selectResponse);
  } catch {
    throw new Error(`Respuesta no válida de DeepSeek en selección de archivos: ${selectResponse}`);
  }

  log("PLAN", plan.summary, colors.yellow);
  log("ARCHIVOS", plan.targetFiles.join(", "), colors.yellow);

  if (!plan.targetFiles || plan.targetFiles.length === 0) {
    throw new Error("DeepSeek no encontró archivos aplicables para esta solicitud.");
  }

  // Paso 3: Lectura y Generación de Cambios de Código
  log("3/5", "Generando código optimizado con DeepSeek...", colors.cyan);
  const fileContexts: Record<string, string> = {};
  for (const relPath of plan.targetFiles) {
    const fullPath = path.join(ROOT_DIR, relPath);
    if (fs.existsSync(fullPath)) {
      fileContexts[relPath] = fs.readFileSync(fullPath, "utf-8");
    }
  }

  const codePrompt = `Eres un Desarrollador Fullstack Senior en Next.js 16 (App Router), TypeScript y Tailwind CSS.
Se requiere aplicar el siguiente requerimiento exacto:
"${prompt}"

Aquí está el contenido actual de los archivos seleccionados:
${Object.entries(fileContexts)
  .map(([file, content]) => `=== ARCHIVO: ${file} ===\n${content}\n=== FIN ARCHIVO ===`)
  .join("\n\n")}

REGLAS ESTRICTAS:
1. Devuelve el código COMPLETO y listo para producción de cada archivo modificado.
2. Mantén la lógica existente y no borres funciones no relacionadas.
3. Cero errores de TypeScript.
4. Responde ÚNICAMENTE en JSON con este formato exacto:
{
  "files": [
    {
      "path": "ruta/del/archivo.tsx",
      "content": "CODIGO COMPLETO AQUI"
    }
  ],
  "commitMessage": "feat(modulo): descripción concisa del cambio"
}`;

  const codeResponse = await callDeepSeek(
    [{ role: "user", content: codePrompt }],
    true
  );

  let codeResult: { files: Array<{ path: string; content: string }>; commitMessage: string };
  try {
    codeResult = JSON.parse(codeResponse);
  } catch {
    throw new Error(`Respuesta no válida de DeepSeek en generación de código: ${codeResponse}`);
  }

  // Escribir cambios en disco
  for (const file of codeResult.files) {
    const targetPath = path.join(ROOT_DIR, file.path);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, file.content, "utf-8");
    log("ESCRITO", `Actualizado: ${file.path}`, colors.green);
  }

  // Paso 4: Quality Gate (Verificación con TypeScript y auto-corrección)
  log("4/5", "Ejecutando Quality Gate (npx tsc --noEmit)...", colors.cyan);
  let tscPassed = false;
  let attempts = 0;
  const maxFixAttempts = 2;

  while (!tscPassed && attempts <= maxFixAttempts) {
    try {
      runCmd("npx tsc --noEmit");
      tscPassed = true;
      log("QUALITY", "TypeScript pasó limpiamente (0 errores).", colors.green);
    } catch (tscErr: unknown) {
      attempts++;
      const errorMsg = (tscErr as Error).message;
      log("QUALITY WARN", `TypeScript reportó errores (Intento ${attempts}/${maxFixAttempts}):\n${errorMsg.slice(0, 300)}...`, colors.red);

      if (attempts > maxFixAttempts) {
        throw new Error(`Quality Gate falló tras ${maxFixAttempts} intentos de auto-corrección:\n${errorMsg}`);
      }

      log("AUTO-HEAL", "DeepSeek corrigiendo el error de TypeScript...", colors.yellow);
      const fixPrompt = `El código generado produjo este error de compilación de TypeScript:
${errorMsg}

Archivos actuales:
${codeResult.files.map((f) => `=== ARCHIVO: ${f.path} ===\n${fs.readFileSync(path.join(ROOT_DIR, f.path), "utf-8")}`).join("\n")}

Corrige el error. Responde ÚNICAMENTE en JSON con el formato:
{
  "files": [
    {
      "path": "ruta/del/archivo.tsx",
      "content": "CODIGO CORREGIDO COMPLETO"
    }
  ]
}`;
      const fixResponse = await callDeepSeek([{ role: "user", content: fixPrompt }], true);
      const fixed = JSON.parse(fixResponse) as { files: Array<{ path: string; content: string }> };
      for (const file of fixed.files) {
        fs.writeFileSync(path.join(ROOT_DIR, file.path), file.content, "utf-8");
      }
    }
  }

  if (dryRun) {
    log("DRY-RUN", "Modo --dry-run activado. Código verificado. Omitiendo git push y deploy.", colors.yellow);
    return;
  }

  // Paso 5: Git Commit & Push
  log("5/5", "Confirmando cambios en Git...", colors.cyan);
  runCmd("git add -A");

  const commitMsg = codeResult.commitMessage || `feat: ${prompt}`;
  try {
    runCmd(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    log("GIT", `Commit realizado: "${commitMsg}"`, colors.green);
  } catch (gitErr: unknown) {
    const msg = (gitErr as Error).message;
    if (msg.includes("nothing to commit")) {
      log("GIT", "No hubo diferencias de código que commitear.", colors.yellow);
    } else {
      throw gitErr;
    }
  }

  log("GIT", "Pusheando cambios a GitHub (origin/main)...", colors.cyan);
  runCmd("git push origin main");
  log("GIT", "Push completado en GitHub.", colors.green);

  // Paso 6: Despliegue en VPS
  if (skipDeploy) {
    log("DEPLOY", "Modo --no-deploy activo. Omitiendo despliegue en VPS.", colors.yellow);
  } else {
    log("DEPLOY", "Disparando despliegue en el VPS...", colors.magenta);

    const isRunningOnVPS = fs.existsSync("/home/zarate/infosistel-v2") && ROOT_DIR.includes("infosistel-v2");

    if (isRunningOnVPS) {
      log("VPS LOCAL", "Ejecutando scripts/deploy-vps.sh directamente en el VPS...", colors.cyan);
      runCmd("bash scripts/deploy-vps.sh");
      log("VPS", "Despliegue local en el VPS terminado exitosamente.", colors.green);
    } else if (VPS_HOST) {
      log("VPS REMOTE", `Conectando por SSH a ${VPS_USER}@${VPS_HOST}:${VPS_PORT}...`, colors.cyan);
      const remoteCmd = `ssh -p ${VPS_PORT} -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cd ${VPS_DIR} && git pull origin main && bash scripts/deploy-vps.sh"`;
      runCmd(remoteCmd);
      log("VPS", "Despliegue remoto en el VPS terminado exitosamente.", colors.green);
    } else {
      log(
        "VPS NOTICE",
        "VPS_HOST no está definido en .env. El código ya está en GitHub. En tu VPS corre:\n  git pull origin main && bash scripts/deploy-vps.sh",
        colors.yellow
      );
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${colors.bold}${colors.green}✨ PROCESO COMPLETADO EN ${elapsed}s!${colors.reset}`);
  console.log(`${colors.dim}Cambio realizado y desplegado en producción con éxito.${colors.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${colors.bold}${colors.red}❌ ERROR EN SHIP PIPELINE:${colors.reset}\n`, err.message || err);
  process.exit(1);
});
