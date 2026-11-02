// The public woven web map: an early, static sketch drawn from the living-map prototype.
// Only public facts live here: scene names, place names, and Boulder as home of COhere Boulder.
// Positions are computed at build time, so the map renders without JavaScript.

const SCENES = {
  ai: { name: "AI innovation", dye: "weld" },
  dance: { name: "Ecstatic dance", dye: "madder" },
  ea: { name: "Effective altruism", dye: "verdigris" },
  ar: { name: "Authentic relating", dye: "cochineal" },
  cu: { name: "CU Boulder", dye: "woad" },
  naropa: { name: "Naropa", dye: "saffron" },
};

// Scenes that overlap. Only CU × Naropa has a stated place.
const BRIDGES = [
  { id: "ai-dance", a: "ai", b: "dance" },
  { id: "ea-ar", a: "ea", b: "ar" },
  { id: "cu-naropa", a: "cu", b: "naropa", place: "boulder" },
];

// Places where the culture is emerging. A place with no stated role shows only its name.
// side: where the label sits in each variant (r = right, l = left).
const PLACES = [
  { id: "seattle", name: "Seattle", lat: 47.61, lon: -122.33, side: { wide: "l", narrow: "l" } },
  { id: "portland", name: "Portland", lat: 45.52, lon: -122.68, side: { wide: "l", narrow: "l" } },
  { id: "ashland", name: "Ashland", lat: 42.19, lon: -122.71, side: { wide: "l", narrow: "l" } },
  { id: "boulder", name: "Boulder", lat: 40.01, lon: -105.27, role: "home of COhere Boulder", home: true, side: { wide: "r", narrow: "r" } },
  { id: "austin", name: "Austin", lat: 30.27, lon: -97.74, side: { wide: "r", narrow: "r" } },
  { id: "asheville", name: "Asheville", lat: 35.6, lon: -82.55, side: { wide: "r", narrow: "l" } },
  { id: "toronto", name: "Toronto", lat: 43.65, lon: -79.38, side: { wide: "r", narrow: "l" } },
];

// The web between places: drawn threads, not claims about who meets whom.
const THREADS = [
  ["seattle", "portland"], ["portland", "ashland"], ["ashland", "boulder"], ["seattle", "boulder"],
  ["boulder", "austin"], ["boulder", "toronto"], ["austin", "asheville"], ["asheville", "toronto"],
];

const FRAME = { lonMin: -126, lonMax: -75, latMin: 28, latMax: 50 };

const VARIANTS = {
  wide: { W: 640, H: 360, pad: { l: 96, r: 84, t: 40, b: 26 }, loop: 50 },
  narrow: { W: 360, H: 310, pad: { l: 82, r: 22, t: 44, b: 22 }, loop: 40 },
};

const r1 = (n) => Math.round(n * 10) / 10;

function layout(key) {
  const v = VARIANTS[key];
  const { W, H, pad } = v;
  const proj = (p) => [
    r1(pad.l + ((p.lon - FRAME.lonMin) / (FRAME.lonMax - FRAME.lonMin)) * (W - pad.l - pad.r)),
    r1(pad.t + ((FRAME.latMax - p.lat) / (FRAME.latMax - FRAME.latMin)) * (H - pad.t - pad.b)),
  ];
  const places = PLACES.map((p) => {
    const [x, y] = proj(p);
    const side = p.side[key];
    return {
      ...p, x, y,
      label: { x: side === "r" ? 14 : -14, anchor: side === "r" ? "start" : "end" },
    };
  });
  const at = Object.fromEntries(places.map((p) => [p.id, p]));

  // each thread sags its own way, like hand-strung yarn
  const threads = THREADS.map(([a, b], i) => {
    const A = at[a], B = at[b];
    const dx = B.x - A.x, dy = B.y - A.y;
    const sag = (i % 2 ? 0.14 : -0.11) + (i % 3) * 0.03;
    const cx = r1((A.x + B.x) / 2 - dy * sag), cy = r1((A.y + B.y) / 2 + dx * sag);
    return { id: `${a}-${b}`, a, b, d: `M${A.x},${A.y} Q${cx},${cy} ${B.x},${B.y}` };
  });

  // CU and Naropa loop out of Boulder, side by side, into the open space above the knot
  const home = at.boulder;
  const loops = ["cu", "naropa"].map((s, k) => {
    const ang = -Math.PI / 2 + (k - 0.5) * 0.7, r = v.loop;
    const p = (da) => `${r1(home.x + Math.cos(ang + da) * r)},${r1(home.y + Math.sin(ang + da) * r)}`;
    return { scene: s, dye: SCENES[s].dye, d: `M${home.x},${home.y} C${p(-0.42)} ${p(0.42)} ${home.x},${home.y}` };
  });

  return { key, W, H, places, threads, loops };
}

// Two threads interlacing: the scene overlap, drawn as a small braid.
// A sits on top at alternate crossings, so the pair reads as woven rather than stacked.
function braid() {
  const W = 120, H = 36, mid = H / 2, amp = 11, P = 48;
  const pts = (phase) => {
    const out = [];
    for (let x = 0; x <= W; x += 2) out.push(`${x},${r1(mid + amp * Math.sin((2 * Math.PI * x) / P + phase))}`);
    return "M" + out.join(" L");
  };
  // crossings fall every P/2; A goes over at every other one
  const over = [];
  for (let c = P / 2; c <= W; c += P) over.push({ x: Math.max(0, c - P / 4), w: Math.min(P / 2, W - (c - P / 4)) });
  return { W, H, a: pts(0), b: pts(Math.PI), over };
}

module.exports = {
  scenes: SCENES,
  bridges: BRIDGES.map((b) => ({ ...b, A: SCENES[b.a], B: SCENES[b.b] })),
  places: PLACES,
  wide: layout("wide"),
  narrow: layout("narrow"),
  braid: braid(),
};
