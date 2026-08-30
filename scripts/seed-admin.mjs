#!/usr/bin/env node
/**
 * Crea (o repone) la cuenta de administración del campus.
 *
 * Uso: node scripts/seed-admin.mjs [email] [contraseña]
 * Por defecto: admin@dyntec.com / 123456
 *
 * Es idempotente: si la cuenta ya existe le resetea la contraseña y se asegura
 * de que quede con rol admin y estado validado. El admin no se inscribe en
 * ninguna comisión — ve todas por rol (ver getCoursesForRole).
 *
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

const [, , emailArg, passArg] = process.argv;
const EMAIL = emailArg ?? "admin@dyntec.com";
const PASSWORD = passArg ?? "123456";
const FULL_NAME = "Administración EnsenIA";

async function findUserByEmail(email) {
  // listUsers pagina; el proyecto es chico, con una página alcanza.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

let user = await findUserByEmail(EMAIL);
if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: PASSWORD });
  if (error) throw new Error(`updateUserById: ${error.message}`);
  console.log(`ya existía, contraseña repuesta: ${EMAIL} (${user.id})`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME, role: "admin" },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  user = data.user;
  console.log(`creado: ${EMAIL} (${user.id})`);
}

// El trigger handle_new_user toma el rol del metadata; lo garantizamos igual.
const { error: profErr } = await admin
  .from("profiles")
  .update({ role: "admin", status: "validado", full_name: FULL_NAME })
  .eq("id", user.id);
if (profErr) throw new Error(`profiles: ${profErr.message}`);

console.log(`Listo. Entrá en /login con ${EMAIL} y la contraseña que pasaste.`);
