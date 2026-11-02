// Screenshots and browser checks of the built site at phone and desktop sizes.
// Usage: PLAYWRIGHT=<path to the playwright package> node walkthrough/shots.mjs [url]
// Without a url it serves ./_site itself. Exits non-zero if a check fails.
import { createRequire } from "node:module";
import { serve } from "../scripts/serve.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const OUT = new URL(".", import.meta.url).pathname;

let url = process.argv[2];
let server;
if (!url) {
  server = await serve("_site");
  url = `http://127.0.0.1:${server.address().port}/`;
}

const failures = [];
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failures.push(what); };

const browser = await chromium.launch();

async function open(name, opts, media = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const external = [];
  page.on("request", (r) => { const u = new URL(r.url()); if (!["127.0.0.1", "localhost", new URL(url).hostname].includes(u.hostname)) external.push(r.url()); });
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "light", ...media });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  check(external.length === 0, `${name}: no third-party requests${external.length ? " (" + external.join(", ") + ")" : ""}`);
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check(sw <= cw, `${name}: no horizontal scroll (scrollWidth ${sw}, clientWidth ${cw})`);
  return { ctx, page };
}

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };

// Phone
{
  const { ctx, page } = await open("phone 390x844", phone);
  await page.waitForTimeout(3200); // let the threads finish weaving in
  await page.screenshot({ path: `${OUT}01-phone-hero.png` });
  await page.locator("#cohere").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}02-phone-cohere.png` });
  await page.locator("#web").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}03-phone-map.png` });

  // touch: tap Boulder on the map
  const boulder = page.locator('.web-map--narrow [data-place="boulder"] .place__knot');
  check(await boulder.isVisible(), "phone: narrow map variant is the one shown");
  await boulder.tap();
  const cap = await page.locator("#web-caption").textContent();
  check(/Boulder/.test(cap) && /home of COhere Boulder/.test(cap), `phone: tapping Boulder captions it ("${cap}")`);
  check(await page.locator('.bridge[data-bridge="cu-naropa"]').evaluate((b) => b.classList.contains("is-lit")), "phone: tapping Boulder lights CU Boulder × Naropa");
  await page.locator("#web").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.screenshot({ path: `${OUT}04-phone-map-boulder.png` });

  // touch: tap a scene pair
  await page.locator('.bridge[data-bridge="ai-dance"]').tap();
  const cap2 = await page.locator("#web-caption").textContent();
  check(/AI innovation × Ecstatic dance/.test(cap2), `phone: tapping a scene pair captions it ("${cap2}")`);
  await page.locator('.bridge[data-bridge="ai-dance"]').tap();
  check(!(await page.locator("[data-web]").evaluate((w) => w.classList.contains("has-sel"))), "phone: tapping the pair again clears the selection");

  // tap targets on the map are at least 40px across on screen
  const tgt = await page.locator('.web-map--narrow [data-place="toronto"] .place__hit').boundingBox();
  check(tgt.width >= 40, `phone: place tap target ${Math.round(tgt.width)}px wide`);

  await page.locator("#relationships").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}05-phone-relationships.png` });
  await ctx.close();
}

// Phone full page, reduced motion (also proves the page is complete with no animation)
{
  const { ctx, page } = await open("phone reduced motion", phone, { reducedMotion: "reduce" });
  const dash = await page.locator(".hero__weft--under .w1").evaluate((p) => getComputedStyle(p).animationName);
  check(dash === "none", `reduced motion: hero threads do not animate (animation ${dash})`);
  const glints = await page.locator(".glint").evaluateAll((gs) => gs.filter((g) => g.getAttribute("fill-opacity") !== "0").length);
  check(glints === 0, `reduced motion: no moving lights on the map (${glints} visible)`);
  await page.locator("#web").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.screenshot({ path: `${OUT}06-phone-map-reduced-motion.png` });
  await page.screenshot({ path: `${OUT}07-phone-full.png`, fullPage: true, scale: "css" });
  await ctx.close();
}

// Desktop
{
  const { ctx, page } = await open("desktop 1280x800", desktop);
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `${OUT}08-desktop-hero.png` });
  await page.locator("#who").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.screenshot({ path: `${OUT}09-desktop-who-cohere.png` });
  await page.locator("#web").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}10-desktop-map.png` });
  check(await page.locator('.web-map--wide [data-place="boulder"]').isVisible(), "desktop: wide map variant is the one shown");
  await page.locator('.bridge[data-bridge="cu-naropa"]').click();
  check(await page.locator('.web-map--wide [data-place="boulder"]').evaluate((g) => g.classList.contains("is-lit")), "desktop: CU Boulder × Naropa lights Boulder");
  await page.screenshot({ path: `${OUT}11-desktop-map-cu-naropa.png` });
  await page.keyboard.press("Escape");
  await page.locator("#relationships").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.screenshot({ path: `${OUT}12-desktop-relationships.png` });
  await page.screenshot({ path: `${OUT}13-desktop-full.png`, fullPage: true });
  await ctx.close();
}

// Desktop dark scheme, map and hero
{
  const { ctx, page } = await open("desktop dark", desktop, { colorScheme: "dark" });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `${OUT}14-desktop-dark-hero.png` });
  await ctx.close();
}

// No JavaScript: the map is still drawn
{
  const ctx = await browser.newContext({ ...phone, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load" });
  check(await page.locator('.web-map--narrow [data-place="boulder"]').isVisible(), "no JS: the map still renders");
  await ctx.close();
}

await browser.close();
server?.close();
if (failures.length) { console.log(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log("\nall browser checks passed");
