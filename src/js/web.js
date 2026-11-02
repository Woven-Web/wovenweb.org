// The woven web: selection and the small lights travelling between places.
// No dependencies, no network. The map itself is drawn at build time and works without this file.

const root = document.querySelector("[data-web]");

if (root) {
  const NS = "http://www.w3.org/2000/svg";
  const HINT = "Tap a place, or a pair of scenes.";
  const caption = root.querySelector("#web-caption");
  const bridges = [...root.querySelectorAll(".bridge")];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const wide = matchMedia("(min-width: 720px)"); // the same breakpoint as the CSS that swaps the two map variants

  // One record per place, read from the markup so the text lives in one spot.
  const places = new Map();
  for (const g of root.querySelectorAll(".web-map--wide .place")) {
    places.set(g.dataset.place, {
      name: g.querySelector(".place__name").textContent,
      role: g.querySelector(".place__role")?.textContent || "",
    });
  }

  let sel = null; // { type: "place" | "bridge", id }

  function pick(next) {
    sel = next && !(sel && sel.type === next.type && sel.id === next.id) ? next : null;
    render();
  }

  function render() {
    const litPlaces = new Set();
    const litBridges = new Set();
    if (sel?.type === "place") {
      litPlaces.add(sel.id);
      for (const b of bridges) if (b.dataset.place === sel.id) litBridges.add(b.dataset.bridge);
    } else if (sel?.type === "bridge") {
      litBridges.add(sel.id);
      const b = bridges.find((x) => x.dataset.bridge === sel.id);
      if (b?.dataset.place) litPlaces.add(b.dataset.place);
    }

    root.classList.toggle("has-sel", Boolean(sel));
    for (const g of root.querySelectorAll(".place")) {
      const id = g.dataset.place;
      const isSel = sel?.type === "place" && sel.id === id;
      g.classList.toggle("is-lit", litPlaces.has(id));
      g.classList.toggle("is-sel", isSel);
      g.setAttribute("aria-pressed", String(isSel));
    }
    for (const t of root.querySelectorAll(".thread")) {
      const lit = sel?.type === "place" && (t.dataset.a === sel.id || t.dataset.b === sel.id);
      t.classList.toggle("is-lit", lit);
      t.glint?.classList.toggle("is-lit", lit);
    }
    // CU and Naropa loop out of Boulder: lit with Boulder or with their bridge
    const loopsLit = litPlaces.has("boulder");
    for (const l of root.querySelectorAll(".loop")) l.classList.toggle("is-lit", loopsLit);
    for (const b of bridges) {
      const on = litBridges.has(b.dataset.bridge);
      b.classList.toggle("is-lit", on);
      b.setAttribute("aria-pressed", String(sel?.type === "bridge" && sel.id === b.dataset.bridge));
    }

    caption.replaceChildren();
    if (!sel) {
      caption.textContent = HINT;
    } else if (sel.type === "place") {
      const p = places.get(sel.id);
      const name = document.createElement("strong");
      name.textContent = p.name;
      caption.append(name);
      if (p.role) caption.append(" ", p.role);
    } else {
      const b = bridges.find((x) => x.dataset.bridge === sel.id);
      const name = document.createElement("strong");
      name.textContent = b.querySelector(".bridge__names").textContent.replace(/\s+/g, " ").trim();
      caption.append(name);
      if (b.dataset.place) caption.append(` in ${places.get(b.dataset.place).name}`);
    }
  }

  for (const g of root.querySelectorAll(".place")) {
    const go = () => pick({ type: "place", id: g.dataset.place });
    g.addEventListener("click", go);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); }
    });
  }
  for (const b of bridges) b.addEventListener("click", () => pick({ type: "bridge", id: b.dataset.bridge }));
  // tapping open ground in the map band clears the selection; so does Escape
  root.closest(".band")?.addEventListener("click", (e) => { if (sel && !e.target.closest(".place, .bridge")) pick(null); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sel) pick(null); });

  // Glints: one small light per thread, the exchange between places. Only when the map is on screen.
  const glints = [];
  for (const svg of root.querySelectorAll(".web-map")) {
    const layer = svg.querySelector(".web-map__glints");
    [...svg.querySelectorAll(".thread")].forEach((path, i) => {
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("r", "2.4");
      dot.setAttribute("class", "glint");
      dot.setAttribute("fill-opacity", "0");
      layer.append(dot);
      path.glint = dot;
      glints.push({ svg, path, dot, len: 0, phase: (i * 0.37) % 1, dir: i % 2 ? -1 : 1, period: 7 + (i % 3) * 2.5 });
    });
  }

  let raf = 0;
  let onScreen = false;

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const shown = wide.matches ? "web-map--wide" : "web-map--narrow";
    for (const g of glints) {
      if (!g.svg.classList.contains(shown)) continue; // the other layout variant
      if (!g.len) g.len = g.path.getTotalLength();
      let t = (now / 1000 / g.period + g.phase) % 1;
      if (g.dir < 0) t = 1 - t;
      const p = g.path.getPointAtLength(t * g.len);
      g.dot.setAttribute("cx", p.x.toFixed(1));
      g.dot.setAttribute("cy", p.y.toFixed(1));
      g.dot.setAttribute("opacity", (Math.sin(t * Math.PI) * 0.9).toFixed(2));
    }
  }

  function run() {
    const should = onScreen && !motion.matches && !document.hidden;
    if (should && !raf) {
      for (const g of glints) g.dot.setAttribute("fill-opacity", "1");
      raf = requestAnimationFrame(tick);
    } else if (!should && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (motion.matches) for (const g of glints) g.dot.setAttribute("fill-opacity", "0");
  }

  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; run(); }).observe(root);
  document.addEventListener("visibilitychange", run);
  motion.addEventListener("change", run);

  render();
}
