#!/usr/bin/env node
/**
 * Crea dos cuentas de prueba para entrar por usuario y contraseña (no por
 * nombre/anónimo ni por Google): "docente" y "estudiante", contraseña
 * "123456" para las dos. El formulario de login resuelve un usuario sin "@"
 * como "<usuario>@ensenia-unt.local" (ver resolveLoginEmail en
 * src/app/login/login-form.tsx), así que estas cuentas quedan con esos
 * emails sintéticos.
 *
 * Uso: node scripts/seed-login-test-accounts.mjs
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
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
const PASSWORD = "123456";
const ACCOUNTS = [
  { username: "docente", email: "docente@ensenia-unt.local", full_name: "Docente de Prueba", role: "docente" },
  { username: "estudiante", email: "estudiante@ensenia-unt.local", full_name: "Estudiante de Prueba", role: "estudiante" },
];

async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function seed() {
  const users = {};

  for (const a of ACCOUNTS) {
    let user = await findUserByEmail(a.email);
    if (user) {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password: PASSWORD });
      if (error) throw new Error(`updateUserById ${a.email}: ${error.message}`);
      console.log(`ya existía, contraseña reseteada: ${a.username} (${user.id})`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: a.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: a.full_name, role: a.role },
      });
      if (error) throw new Error(`createUser ${a.email}: ${error.message}`);
      user = data.user;
      console.log(`creado: ${a.username} (${user.id})`);
    }
    users[a.role] = { id: user.id, username: a.username };

    const { error: profErr } = await admin
      .from("profiles")
      .update({ role: a.role, status: "validado", full_name: a.full_name })
      .eq("id", user.id);
    if (profErr) throw new Error(`profiles ${a.email}: ${profErr.message}`);
  }

  const { error: taErr } = await admin
    .from("teacher_assignments")
    .upsert({ teacher_id: users.docente.id, course_id: COURSE_ID });
  if (taErr) throw new Error(`teacher_assignments: ${taErr.message}`);

  const { error: enErr } = await admin
    .from("enrollments")
    .upsert({ student_id: users.estudiante.id, course_id: COURSE_ID, status: "active" });
  if (enErr) throw new Error(`enrollments: ${enErr.message}`);

  console.log("\nListo. Login en /login:");
  console.log("  docente    / 123456");
  console.log("  estudiante / 123456");
}

seed().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
