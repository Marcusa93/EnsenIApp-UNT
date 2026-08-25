#!/usr/bin/env node
/**
 * Seed de usuarios de prueba vía Supabase Auth Admin API.
 *
 * Uso:
 *   node scripts/seed-test-users.mjs           # crea (si no existen) los 3 usuarios de prueba
 *                                              # y guarda la contraseña en scripts/.test-users.local.json
 *   node scripts/seed-test-users.mjs link <email>
 *                                              # imprime el token_hash de un magic link para ese email
 *                                              # (navegar a /auth/confirm?token_hash=<hash>&type=magiclink)
 *
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env.local parser (no extra deps)
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
const TEST_USERS = [
  { email: "docente.prueba@derecho.unt.edu.ar", full_name: "Docente de Prueba", role: "docente" },
  { email: "alumno.prueba@derecho.unt.edu.ar", full_name: "Alumno de Prueba", role: "estudiante" },
  { email: "admin.prueba@derecho.unt.edu.ar", full_name: "Admin de Prueba", role: "admin" },
];

const credsPath = join(root, "scripts/.test-users.local.json");

async function findUserByEmail(email) {
  // listUsers is paginated; test projects are small so one page is enough
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function seed() {
  const existingCreds = existsSync(credsPath) ? JSON.parse(readFileSync(credsPath, "utf8")) : {};
  const password = existingCreds.password ?? randomBytes(18).toString("base64url") + "!Aa1";
  const users = {};

  for (const u of TEST_USERS) {
    let user = await findUserByEmail(u.email);
    if (user) {
      console.log(`ya existe: ${u.email} (${user.id})`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role },
      });
      if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
      user = data.user;
      console.log(`creado: ${u.email} (${user.id})`);
    }
    users[u.role] = { id: user.id, email: u.email };

    // El trigger handle_new_user toma raw_user_meta_data.role; garantizamos el rol igualmente.
    const { error: profErr } = await admin
      .from("profiles")
      .update({ role: u.role, status: "validado", full_name: u.full_name })
      .eq("id", user.id);
    if (profErr) throw new Error(`profiles ${u.email}: ${profErr.message}`);
  }

  // Docente asignado al curso, alumno inscripto
  const { error: taErr } = await admin
    .from("teacher_assignments")
    .upsert({ teacher_id: users.docente.id, course_id: COURSE_ID });
  if (taErr) throw new Error(`teacher_assignments: ${taErr.message}`);

  const { error: enErr } = await admin
    .from("enrollments")
    .upsert({ student_id: users.estudiante.id, course_id: COURSE_ID, status: "active" });
  if (enErr) throw new Error(`enrollments: ${enErr.message}`);

  writeFileSync(credsPath, JSON.stringify({ password, users }, null, 2) + "\n");
  console.log(`credenciales escritas en ${credsPath}`);
}

async function link(email) {
  if (!email) {
    console.error("Uso: node scripts/seed-test-users.mjs link <email>");
    process.exit(1);
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  console.log(data.properties.hashed_token);
}

const [, , cmd, arg] = process.argv;
try {
  if (cmd === "link") await link(arg);
  else await seed();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
