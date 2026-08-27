#!/usr/bin/env node
/**
 * Rellena game_challenges.source_seconds en los desafíos ya generados, usando la
 * búsqueda de citas mejorada (la que compara sobre el texto corrido y mapea la
 * posición al segmento). Sin esto, el enlace "ir a escuchar ese momento" sólo
 * aparecía en los desafíos donde la cita caía justo dentro de un único segmento.
 *
 * La lógica de búsqueda está duplicada de src/lib/games/generate.ts a propósito:
 * es un .mjs suelto y no puede importar TypeScript. Si cambia allá, cambiala acá.
 *
 * Uso: node scripts/backfill-quote-seconds.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findQuoteSeconds(quote, segments) {
  const needle = normalize(quote);
  if (needle.length < 12) return null;

  const starts = [];
  let full = "";
  for (const seg of segments) {
    if (typeof seg.start !== "number" || !seg.text) continue;
    const piece = normalize(seg.text);
    if (!piece) continue;
    if (full) full += " ";
    starts.push({ at: full.length, seconds: seg.start });
    full += piece;
  }
  if (starts.length === 0) return null;

  const locate = (at) => {
    let found = starts[0].seconds;
    for (const s of starts) {
      if (s.at > at) break;
      found = s.seconds;
    }
    return found;
  };

  const direct = full.indexOf(needle);
  if (direct >= 0) return locate(direct);

  for (const size of [80, 50, 30]) {
    if (needle.length <= size) continue;
    const at = full.indexOf(needle.slice(0, size));
    if (at >= 0) return locate(at);
  }

  const head = needle.split(" ").slice(0, 6).join(" ");
  if (head.length < 12) return null;
  const at = full.indexOf(head);
  return at >= 0 ? locate(at) : null;
}

const { data: challenges, error } = await admin
  .from("game_challenges")
  .select("id, recording_id, source_quote, source_seconds")
  .is("source_seconds", null);

if (error) throw error;
console.log(`sin minuto resuelto: ${challenges.length}`);

const cache = new Map();
let fixed = 0;

for (const c of challenges) {
  if (!c.recording_id || !c.source_quote) continue;

  if (!cache.has(c.recording_id)) {
    const { data } = await admin.from("transcripts").select("segments").eq("recording_id", c.recording_id).maybeSingle();
    cache.set(c.recording_id, Array.isArray(data?.segments) ? data.segments : []);
  }

  const seconds = findQuoteSeconds(c.source_quote, cache.get(c.recording_id));
  if (seconds == null) continue;

  const { error: upErr } = await admin.from("game_challenges").update({ source_seconds: seconds }).eq("id", c.id);
  if (upErr) console.error("update", c.id, upErr.message);
  else fixed++;
}

console.log(`resueltos: ${fixed} de ${challenges.length}`);
