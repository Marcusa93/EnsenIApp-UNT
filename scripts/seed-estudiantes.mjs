#!/usr/bin/env node
/**
 * Alta masiva de estudiantes desde una lista de emails.
 *
 * Uso: node scripts/seed-estudiantes.mjs archivo.txt [contraseña]
 *   - Un email por línea. Se toleran viñetas ("* "), puntos sueltos al
 *     principio, espacios y caracteres invisibles (los pegados desde WhatsApp
 *     suelen traer U+2060 y compañía).
 *   - Contraseña por defecto: 123456
 *
 * Cada cuenta queda: rol estudiante, validada, inscripta en la comisión y con
 * must_change_password = true, así el campus le pide elegir una propia la
 * primera vez que entra.
 *
 * Es idempotente: si el email ya existe, NO le toca la contraseña ni lo saca de
 * donde esté — sólo se asegura de que esté inscripto. Correrlo dos veces no
 * pisa la clave que el estudiante ya se puso.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const envFile = readFileSync(join(root, ".env.local"), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const COURSE_ID = "00000000-0000-0000-0000-000000000002";
const [, , archivo, passArg] = process.argv;
if (!archivo) {
  console.error("Uso: node scripts/seed-estudiantes.mjs archivo.txt [contraseña]");
  process.exit(1);
}
const PASSWORD = passArg ?? "123456";

/** Limpia una línea pegada de cualquier lado y devuelve el email, o null. */
function limpiar(linea) {
  const sinInvisibles = linea.replace(/[​-‍⁠﻿]/g, "");
  const sinVinieta = sinInvisibles.replace(/^\s*[*\-•]\s*/, "");
  // Un punto suelto al principio es artefacto de la lista, no parte del email.
  const limpio = sinVinieta.trim().replace(/^\.+\s*/, "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio) ? limpio : null;
}

/**
 * Nombre tentativo a partir del email, sólo para que la ficha no quede vacía.
 * El estudiante lo corrige desde su cuenta; no se pretende adivinar bien.
 */
function nombreTentativo(email) {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
  if (!local) return "Estudiante";
  return local
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

const lineas = readFileSync(archivo, "utf8").split("\n");
const emails = [];
const descartadas = [];
for (const linea of lineas) {
  if (!linea.trim()) continue;
  const email = limpiar(linea);
  if (email) {
    if (!emails.includes(email)) emails.push(email);
  } else {
    descartadas.push(linea.trim());
  }
}

if (descartadas.length > 0) {
  console.log("Líneas que no parecen un email (no se procesan):");
  for (const d of descartadas) console.log(`  ? ${d}`);
  console.log("");
}

const { data: existentes, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listErr) {
  console.error(`No se pudo listar usuarios: ${listErr.message}`);
  process.exit(1);
}
const porEmail = new Map(existentes.users.map((u) => [u.email?.toLowerCase(), u]));

let creados = 0;
let yaEstaban = 0;
const fallados = [];

for (const email of emails) {
  try {
    let user = porEmail.get(email);

    if (user) {
      // No se le toca la contraseña: puede que ya se haya puesto la suya.
      console.log(`ya existía: ${email}`);
      yaEstaban++;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: nombreTentativo(email), role: "estudiante" },
      });
      if (error) throw new Error(error.message);
      user = data.user;

      const { error: profErr } = await admin
        .from("profiles")
        .update({
          role: "estudiante",
          status: "validado",
          full_name: nombreTentativo(email),
          must_change_password: true,
        })
        .eq("id", user.id);
      if (profErr) throw new Error(`profiles: ${profErr.message}`);

      console.log(`creado:    ${email}`);
      creados++;
    }

    const { error: enErr } = await admin
      .from("enrollments")
      .upsert({ student_id: user.id, course_id: COURSE_ID, status: "active" }, { onConflict: "student_id,course_id" });
    if (enErr) throw new Error(`enrollments: ${enErr.message}`);
  } catch (err) {
    console.error(`FALLÓ:     ${email} — ${err instanceof Error ? err.message : err}`);
    fallados.push(email);
  }
}

console.log("");
console.log(`Listo. ${creados} creados, ${yaEstaban} ya existían, ${fallados.length} con error.`);
if (creados > 0) {
  console.log(`Entran en /login con su email y la contraseña "${PASSWORD}".`);
  console.log("La primera vez el campus les pide elegir una contraseña propia.");
}
if (fallados.length > 0) {
  console.log("Con error:");
  for (const f of fallados) console.log(`  - ${f}`);
}
