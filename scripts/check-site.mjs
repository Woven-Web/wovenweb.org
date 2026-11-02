// Checks the built site in _site. No dependencies.
//   node scripts/check-site.mjs [--quotes <file>]
// - every internal link, script, stylesheet, font and image resolves to a built file
// - every external link the previous site carried is still present, unchanged
// - nothing is loaded from another origin (external URLs only as <a href> links)
// - the Writing pages still build, and nothing links to them
// - with --quotes: no sentence from that file (e.g. a private source's quote list) appears in the output
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, dirname, normalize } from "node:path";

const SITE = "_site";

// External links on wovenweb.org before this refresh (links only; the old Google Fonts URLs were stylesheets, now vendored).
const KEEP = [
  "https://github.com/Woven-Web",
  "https://oaklog.org",
  "https://opencivics.co",
  "https://regenhub.xyz",
  "https://techne.institute",
  "https://wovenweb.beehiiv.com/subscribe",
  "https://www.colorado.edu/atlas",
  "https://www.naropa.edu",
  "mailto:hello@wovenweb.org",
];

const failures = [];
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failures.push(what); };

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    out.push(...(e.isDirectory() ? await walk(p) : [p]));
  }
  return out;
}

const exists = async (p) => { try { const s = await stat(p); return s.isDirectory() ? exists(join(p, "index.html")) : true; } catch { return false; } };

const files = await walk(SITE);
const html = files.filter((f) => extname(f) === ".html");
const css = files.filter((f) => extname(f) === ".css");
const js = files.filter((f) => extname(f) === ".js");

// 1. internal references
const allExternal = new Set();
let internal = 0;
for (const f of html) {
  const text = await readFile(f, "utf8");
  for (const m of text.matchAll(/\s(href|src)="([^"]+)"/g)) {
    const ref = m[2];
    if (/^(https?:|mailto:)/.test(ref)) { allExternal.add(ref); continue; }
    if (ref.startsWith("#")) {
      check(text.includes(`id="${ref.slice(1)}"`), `${f}: anchor ${ref} exists`);
      continue;
    }
    const path = ref.split(/[?#]/)[0];
    const target = path.startsWith("/") ? join(SITE, path) : normalize(join(dirname(f), path));
    internal++;
    if (!(await exists(target))) check(false, `${f}: ${ref} resolves`);
  }
}
for (const f of css) {
  const text = await readFile(f, "utf8");
  for (const m of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    const ref = m[1];
    if (/^(https?:|data:|#)/.test(ref)) continue; // remote URLs are caught below
    internal++;
    const target = ref.startsWith("/") ? join(SITE, ref) : normalize(join(dirname(f), ref));
    if (!(await exists(target.split(/[?#]/)[0]))) check(false, `${f}: ${ref} resolves`);
  }
}
check(failures.length === 0, `${internal} internal references resolve`);

// 2. old external links kept
for (const link of KEEP) check(allExternal.has(link), `external link kept: ${link}`);

// 3. no third-party loads: external URLs may appear only as <a href>
for (const f of html) {
  const text = await readFile(f, "utf8");
  for (const m of text.matchAll(/<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*\s(src|href|srcset|data)="(https?:)?\/\/[^"]+"[^>]*>/gi)) {
    if (/^<link\b/i.test(m[0]) && /\srel="(canonical|alternate|me|author)"/i.test(m[0])) continue; // references, not loads
    check(false, `${f}: third-party load ${m[0].slice(0, 120)}`);
  }
}
for (const f of [...css, ...js]) {
  const text = await readFile(f, "utf8");
  const hits = [...text.matchAll(/(url\(\s*["']?|@import\s+["']?|fetch\(\s*["'`]|import\s*\(?\s*["'`])(https?:)?\/\//g)];
  if (hits.length) check(false, `${f}: third-party load`);
}
check(!failures.some((x) => x.includes("third-party")), "no scripts, styles, fonts or images from other origins");

// 4. Writing pages build but are not linked
check(await exists(join(SITE, "writing", "index.html")), "the writing page still builds");
check(await exists(join(SITE, "drafts", "index.html")), "the drafts page still builds");
let writingLinks = 0;
for (const f of html) {
  const text = await readFile(f, "utf8");
  if (f === join(SITE, "index.html") && />\s*Writing\s*</.test(text)) writingLinks++;
  if (!f.startsWith(join(SITE, "writing")) && !f.startsWith(join(SITE, "drafts")) && /href="\/writing\/?"/.test(text)) writingLinks++;
}
check(writingLinks === 0, "no page outside the writing pages links to /writing/, and the home page has no Writing link");

// 5. quotes from a private source must not appear
const qi = process.argv.indexOf("--quotes");
if (qi > 0) {
  const file = await readFile(process.argv[qi + 1], "utf8");
  // a source with a QUOTES object (like the map prototype's data.js): check that object only
  const block = file.match(/QUOTES\s*=\s*\{[\s\S]*?\n\};/);
  const src = block ? block[0] : file;
  const quotes = [...src.matchAll(/:\s*(["'`])((?:\\.|(?!\1)[^\\])+?)\1/g)].map((m) => m[2]).filter((q) => q.split(/\s+/).length >= 4);
  const flat = (s) => s.toLowerCase().replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  const site = flat((await Promise.all([...html, ...js].map((f) => readFile(f, "utf8")))).join(" "));
  let leaks = 0;
  for (const q of quotes) {
    const words = flat(q).split(" ");
    const n = Math.min(6, words.length); // short quotes are checked whole
    for (let i = 0; i + n <= words.length; i++) {
      const shingle = words.slice(i, i + n).join(" ");
      if (site.includes(shingle)) { leaks++; console.log(`  found: "${shingle}"`); break; }
    }
  }
  check(quotes.length > 0, `read ${quotes.length} quotes from the source file`);
  check(leaks === 0, `no quote, or six-word run of one, appears in the built site`);
  for (const word of ["prototype", "journal", "aaron gabriel", "role of"]) check(!site.includes(word), `built site has no "${word}"`);
  const raw = (await Promise.all(html.map((f) => readFile(f, "utf8")))).join("");
  check(!raw.includes("[Aaron:"), 'built site has no "[Aaron: …]" placeholder (only the one shared [Aaron/Eileen: …] note)');
}

if (failures.length) { console.log(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log("\nall site checks passed");
