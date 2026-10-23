#!/usr/bin/env node
/**
 * One-time helper: downloads the files that were NOT part of the saved copy
 * (lazy-loaded scene chunks, comic page images/textures, audio, cover image, API data)
 * straight from the live site into this repo.
 *
 *   node tools/fetch-assets.mjs
 *
 * Needs Node 18+. Safe to re-run; existing files are skipped (use --force to overwrite).
 * Override hosts for testing:  SITE=http://localhost:9000 WP=http://localhost:9000 node tools/fetch-assets.mjs
 */
import { mkdir, writeFile, readFile, readdir, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE || "https://ten.375.studio").replace(/\/$/, "");
const WP = (process.env.WP || "https://admin10.375.studio").replace(/\/$/, "");
const DPL = "dpl_9qe75gys9KWCCUdG4rJ2YHH5abq5";
const FORCE = process.argv.includes("--force");

const CHUNKS = [
  "9df9f77df5abc795", // 3D scene (calls setSceneReady -> fixes the "stuck at 40%" loader)
  "4a35d5c5c64d85be",
  "3dcc93bb4829c1ba",
  "28e14a26e92e0e1d",
  "92e22b0d886e40c0",
  "ce0d0de7d02c566c", // error page (only shown if something throws)
  "cbb728de8f96bac9", // 404 page
];
const MEDIA = ["uploads/pagina-1-eng.webp", "uploads/cropped_pagina-1.ktx2", "uploads/pagina-2-eng.webp", "uploads/cropped_pagina-2.ktx2", "uploads/pagina-3-eng.webp", "uploads/cropped_pagina-3.ktx2", "uploads/pagina-4-eng.webp", "uploads/full_2018.ktx2", "uploads/pagina-5-eng.webp", "uploads/full_2019.ktx2", "uploads/pagina-6-eng-1.webp", "uploads/full_2020.ktx2", "uploads/pagina-7-eng.webp", "uploads/full_2021.ktx2", "uploads/pagina-8-eng.webp", "uploads/full_2022.ktx2", "uploads/pagina-9-eng.webp", "uploads/full_2023.ktx2", "uploads/pagina-10-eng.webp", "uploads/full_2024.ktx2", "uploads/pagina-11-eng.webp", "uploads/full_2025.ktx2"];
const AUDIO = ["default", ...Array.from({ length: 10 }, (_, i) => String(2015 + i)), "2025_01", "2025_02"];
const STATIC = [
  "/textures/copertina-no-title.webp",
  ...AUDIO.flatMap((n) => [`/audio-compressed/${n}.ogg`, `/audio-compressed/${n}.mp3`]),
  "/sound-compressed/hover.ogg",
  "/sound-compressed/hover.mp3",
  "/sound-sprite/sprite.webm",
  "/sound-sprite/sprite.mp3",
];

const exists = (p) => access(p).then(() => true, () => false);
let ok = 0, miss = 0;

async function get(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (asset-fetch)" } });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch { return null; }
}
async function save(rel, urls, transform) {
  const out = join(ROOT, rel);
  if (!FORCE && (await exists(out))) return console.log("  have   ", rel);
  for (const u of [].concat(urls)) {
    let buf = await get(u);
    if (!buf) continue;
    if (transform) buf = Buffer.from(transform(buf.toString("utf8")));
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buf);
    ok++; return console.log("  saved  ", rel);
  }
  miss++; console.log("  MISSING", rel);
}

// Make absolute "/textures/.." style paths work from any sub-folder (GitHub Pages /repo/).
const BASE = '(window.__BP__||"")';
const PREFIXED = /__BP__\|\|""\)\+$/;
function rebase(src) {
  // 1) Next API routes -> static JSON files
  src = src.replace(/fetch\(\s*(["'`])\/api\/(team|years)\?locale=[^"'`)]*\1\s*\)/g, (m, q, n) => `fetch(${BASE}+"/api/${n}.json")`);
  // 2) any other absolute asset path -> prefixed with the folder the site is served from
  return src.replace(/(["'`])\/(textures|audio|audio-compressed|sound|sound-compressed|sound-sprite|basis|draco|media|models|images)\//g,
    (m, q, dir, off) => {
      if (PREFIXED.test(src.slice(Math.max(0, off - 30), off))) return m;
      return q === "`" ? "`${" + BASE + "}/" + dir + "/" : `${BASE}+${q}/${dir}/`;
    });
}

console.log("1/4 JavaScript chunks");
for (const h of CHUNKS) {
  const url = `${SITE}/_next/static/chunks/${h}.js?dpl=${DPL}`;
  await save(`js/${h}.js`, url, rebase);
  // Next's route loader requests the error/404 pages from _next/static/chunks/
  if (h === "ce0d0de7d02c566c" || h === "cbb728de8f96bac9") await save(`_next/static/chunks/${h}.js`, url, rebase);
}

console.log("2/4 Comic pages + textures (wp-content -> media/)");
for (const rel of MEDIA) await save(`media/${rel}`, [`${WP}/wp-content/${rel}`, `${SITE}/media/${rel}`]);

console.log("3/4 Audio, cover image");
for (const p of STATIC) await save(p.slice(1), `${SITE}${p}`);

console.log("4/4 API data");
for (const n of ["years", "team"]) {
  const buf = await get(`${SITE}/api/${n}?locale=en`);
  try { if (Array.isArray(JSON.parse(buf))) { await writeFile(join(ROOT, `api/${n}.json`), buf); ok++; console.log("  saved   api/" + n + ".json"); } }
  catch { console.log("  kept    api/" + n + ".json (live API not reachable)"); }
}

// Discover extra files referenced by the freshly downloaded chunks (e.g. basis transcoder, draco, models)
console.log("Scanning new chunks for further static files...");
const found = new Set();
for (const h of CHUNKS) {
  const f = join(ROOT, `js/${h}.js`);
  if (!(await exists(f))) continue;
  const s = await readFile(f, "utf8");
  for (const m of s.matchAll(/["'`]\/((?:basis|draco|textures|models|images|fonts|sound-sprite|audio-compressed|sound-compressed)\/[\w./-]+\.[\w]+)["'`]/g)) found.add(m[1]);
  for (const m of s.matchAll(/__BP__\|\|""\)\+["'`]\/([\w./-]+\.(?:wasm|js|glb|gltf|png|jpg|webp|ktx2|ogg|mp3|webm|json))["'`]/g)) found.add(m[1]);
}
for (const rel of found) await save(rel, `${SITE}/${rel}`);

console.log(`\nDone: ${ok} downloaded, ${miss} not found.`);
if (miss) console.log("Not-found files are optional unless the browser console still shows 404s for them.");
