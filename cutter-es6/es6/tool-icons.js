/**
 * Tool icons as arc drawings + SVG renderer.
 *
 * Source of truth is turtle strokes ([s, Δθ] + start pose). The SVG uses
 * exact `A` commands (no polyline). Bitmap is never the source.
 *
 * Themes map role names (ink / accent / muted / danger) to paint.
 */

import { DEG } from "./path-utils.js";
import { stepArc } from "./close-path.js";
import { drawingBounds, normalizeDrawing, normalizeStroke } from "./drawing-doc.js";
import {
  appendSegs,
  appendStroke,
  mirrorStroke,
  repeatRotate,
  rotateStroke,
  tracePoints,
} from "./path-xform.js";

export const ICON_THEMES = {
  dark: {
    ink: "#ece7dc",
    accent: "#9bc4bb",
    muted: "#9a9488",
    danger: "#e07070",
    paper: "none",
  },
  light: {
    ink: "#2a241c",
    accent: "#3f6f68",
    muted: "#8a8478",
    danger: "#a33b2b",
    paper: "#f3ead8",
  },
};

const W = 2.2;
const WA = 2.4;

function S(startPoint, startAngle, turtlePath, paint = {}) {
  return normalizeStroke({
    startPoint,
    startAngle,
    turtlePath,
    stroke: paint.stroke || "ink",
    width: paint.width ?? W,
    fill: paint.fill || null,
    name: paint.name || "",
    id: paint.id || "",
  });
}

function line(x1, y1, x2, y2, paint) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return S([x1, y1], (Math.atan2(dy, dx) * 180) / Math.PI, [[Math.hypot(dx, dy), 0]], paint);
}

function circ(cx, cy, r, paint) {
  return S([cx + r, cy], 90, [[2 * Math.PI * r, 360]], paint);
}

function arc(cx, cy, r, a0Deg, sweepDeg, paint) {
  const a0 = a0Deg * DEG;
  const s = r * Math.abs(sweepDeg) * DEG;
  return S([cx + r * Math.cos(a0), cy + r * Math.sin(a0)], a0Deg + 90, [[s, sweepDeg]], paint);
}

function dot(cx, cy, r = 1.15, paint = {}) {
  return S([cx + r, cy], 90, [[2 * Math.PI * r, 360]], {
    stroke: paint.stroke || "accent",
    width: paint.width ?? 0.7,
    fill: paint.fill || paint.stroke || "accent",
  });
}

/** Shaft + two barbs. dirDeg is heading of the shaft toward the tip. */
function arrow(tipX, tipY, dirDeg, length = 6.5, paint = {}) {
  const h = dirDeg * DEG;
  const tailX = tipX - length * Math.cos(h);
  const tailY = tipY - length * Math.sin(h);
  const barb = Math.min(3.1, length * 0.42);
  const left = dirDeg + 148;
  const right = dirDeg - 148;
  const p = { width: paint.width ?? WA, stroke: paint.stroke || "ink" };
  return [
    line(tailX, tailY, tipX, tipY, p),
    S([tipX, tipY], left, [[barb, 0]], p),
    S([tipX, tipY], right, [[barb, 0]], p),
  ];
}

function doc(id, name, paths) {
  return normalizeDrawing({ id, name, paths: paths.map((p, i) => ({ ...p, id: p.id || `${id}-${i + 1}` })), active: 0 });
}

function paint(stroke, extra = {}) {
  return normalizeStroke({
    ...stroke,
    width: extra.width ?? stroke.width ?? W,
    stroke: extra.stroke || stroke.stroke || "ink",
    fill: extra.fill === undefined ? stroke.fill || null : extra.fill,
    id: extra.id || stroke.id || "",
    name: extra.name || stroke.name || "",
  });
}

/** 1/8 of Pan → mirror → 4×90°. One walk; shaft meets the hub. */
function panStroke() {
  const hub = 2.05;
  const base = 5.45;
  const tip = 8.55;
  const hw = 2.25;
  const eighth = tracePoints(
    [
      [hub, 0],
      [tip, 0],
      [base, hw],
      [base, 0],
      [hub, 0],
    ],
    0,
  );
  const quarterHead = appendStroke(eighth, mirrorStroke(eighth, 0));
  const quarter = appendSegs(quarterHead, [
    [0, -90],
    [(hub * Math.PI) / 2, 90],
  ]);
  return paint(repeatRotate(quarter, 4, 90), { width: WA, id: "pan" });
}

function moveStroke() {
  const hub = 2.15;
  const base = 5.2;
  const tip = 8.3;
  const hw = 1.85;
  const eighth = tracePoints(
    [
      [hub, 0],
      [tip, 0],
      [base, hw],
      [base, 0],
      [hub, 0],
    ],
    0,
  );
  const quarterHead = appendStroke(eighth, mirrorStroke(eighth, 0));
  const quarter = appendSegs(quarterHead, [
    [0, -90],
    [(hub * Math.PI) / 2, 90],
  ]);
  return paint(repeatRotate(quarter, 4, 90), { width: 2.0, id: "move" });
}

function addStroke() {
  const arm = tracePoints(
    [
      [1.3, 0],
      [7.4, 0],
    ],
    0,
  );
  return paint(repeatRotate(arm, 4, 90), { width: 2.6, stroke: "accent", id: "add" });
}

function fitStroke() {
  const half = 7.2;
  const cr = 1.85;
  const quarter = S([-half + cr, -half], 0, [
    [2 * (half - cr), 0],
    [(cr * Math.PI) / 2, 90],
  ]);
  return paint(repeatRotate(quarter, 4, 90), { width: 1.9, id: "fit" });
}

export const TOOL_ICONS = [
  doc("pan", "Pan", [panStroke()]),
  doc("fit", "Fit", [fitStroke(), circ(0, 0, 2.6, { stroke: "accent", width: 1.7, id: "fit-hub" })]),
  doc("select", "Select", [
    paint(
      tracePoints(
        [
          [0, 8.4],
          [-3.8, -1.6],
          [0.7, 0.5],
          [3.8, -8.2],
          [0, 8.4],
        ],
        -110,
      ),
      { width: 1.7, fill: "ink", id: "select" },
    ),
  ]),
  doc("path", "Path", [
    paint(
      S([-6.5, -1.2], 18, [
        [7.4, 70],
        [7.4, -70],
      ]),
      { width: 2.3, id: "path-body" },
    ),
    paint(S([-8.2, -6.2], 0, [[16.4, 0], [Math.PI, 90], [12.4, 0], [Math.PI, 90], [16.4, 0], [Math.PI, 90], [12.4, 0], [Math.PI, 90]]), {
      width: 1.5,
      stroke: "accent",
      id: "path-frame",
    }),
  ]),
  doc("add", "Add", [addStroke()]),
  doc("arc", "Arc", [
    arc(0, -1.2, 8.2, 28, 124, { width: 2.4 }),
    line(7.24, 2.65, 9.7, 3.7, { width: 1.6, stroke: "accent" }),
    line(-7.24, 2.65, -9.7, 3.7, { width: 1.6, stroke: "accent" }),
  ]),
  doc("p", "p", [
    arc(-3.2, 0.6, 5.6, 210, 150, { width: 2.3 }),
    arc(3.2, 0.6, 5.6, 30, 150, { width: 2.3 }),
    dot(0, 0.6, 1.2),
  ]),
  doc("locus", "Locus", [
    circ(0, 0, 7.2, { width: 1.7, stroke: "muted" }),
    arc(0, 0, 7.2, -40, 95, { width: 2.3, stroke: "ink" }),
    dot(7.2 * Math.cos(20 * DEG), 7.2 * Math.sin(20 * DEG), 1.25),
  ]),
  doc("move", "Move", [moveStroke()]),
  doc("mirror", "Mirror", [
    paint(
      appendStroke(
        S([-2.2, -6.4], 90, [
          [12.4, 0],
          [0, 55],
          [6.2, 0],
        ]),
        mirrorStroke(
          S([-2.2, -6.4], 90, [
            [12.4, 0],
            [0, 55],
            [6.2, 0],
          ]),
          90,
        ),
      ),
      { width: 2.1, id: "mirror-body" },
    ),
    line(0, -8.2, 0, 8.2, { width: 1.4, stroke: "accent" }),
  ]),
  doc("rot90", "90°", [
    paint(
      S([6.2, 0], 90, [
        [(6.2 * Math.PI) / 2, 90],
        [0, 40],
        [3.0, 0],
        [0, -160],
        [3.0, 0],
      ]),
      { width: 2.2, id: "rot90" },
    ),
  ]),
  doc("tan", "Tan", [
    circ(0, 0, 2.05, { width: 1.6, stroke: "accent" }),
    dot(0, 0, 0.85),
    line(2.05, 0, 9.4, 0, { width: 2.2 }),
    S([9.4, 0], 140, [[2.8, 0]], { width: 2.0 }),
    S([9.4, 0], -140, [[2.8, 0]], { width: 2.0 }),
    arc(0, 0, 5.4, 28, 84, { width: 1.7, stroke: "accent" }),
  ]),
  doc("close", "Close", [
    arc(0, 0, 7.2, 48, 264, { width: 2.3 }),
    line(
      7.2 * Math.cos(48 * DEG),
      7.2 * Math.sin(48 * DEG),
      7.2 * Math.cos(-48 * DEG),
      7.2 * Math.sin(-48 * DEG),
      { width: 2.0, stroke: "accent" },
    ),
  ]),
  doc("split", "Split", [
    arc(-0.2, 0, 7.4, 200, 140, { width: 2.3 }),
    line(0, 0.2, 0, 8.6, { width: 2.0, stroke: "accent" }),
    line(-2.4, 6.4, 2.4, 6.4, { width: 2.0, stroke: "accent" }),
  ]),
  doc("insert", "Ins", [
    line(-8.4, 0, -2.2, 0, { width: 2.2 }),
    line(2.2, 0, 8.4, 0, { width: 2.2 }),
    line(-1.6, 0, 1.6, 0, { width: 2.0, stroke: "accent" }),
    line(0, -1.6, 0, 1.6, { width: 2.0, stroke: "accent" }),
  ]),
  doc("del", "Del", [
    arc(0, 0, 7.0, 28, 124, { width: 2.2 }),
    line(-6.6, 6.6, 6.6, -6.6, { width: 2.2, stroke: "danger" }),
  ]),
  doc("undo", "Undo", [
    arc(0.4, -0.6, 6.4, 40, 250, { width: 2.3 }),
    ...arrow(
      0.4 + 6.4 * Math.cos(40 * DEG),
      -0.6 + 6.4 * Math.sin(40 * DEG),
      40 + 90,
      0.2,
      { width: 2.2 },
    ).slice(1),
    S(
      [0.4 + 6.4 * Math.cos(40 * DEG), -0.6 + 6.4 * Math.sin(40 * DEG)],
      40 + 90 + 148,
      [[3.1, 0]],
      { width: 2.2 },
    ),
    S(
      [0.4 + 6.4 * Math.cos(40 * DEG), -0.6 + 6.4 * Math.sin(40 * DEG)],
      40 + 90 - 148,
      [[3.1, 0]],
      { width: 2.2 },
    ),
  ]),
];

export const TOOL_ICON_BY_ID = Object.fromEntries(TOOL_ICONS.map((d) => [d.id, d]));

export function iconDrawing(id) {
  const d = TOOL_ICON_BY_ID[id];
  return d ? normalizeDrawing(JSON.parse(JSON.stringify(d))) : null;
}

function fmt(n) {
  const s = Number(n).toFixed(3);
  return s.replace(/\.?0+$/, "");
}

/**
 * Exact SVG path `d` for one turtle stroke.
 * Coordinates stay y-up; wrap the path in `scale(1,-1)` (see drawingToSvg).
 * Positive Δθ → sweep=1 so a later y-flip reads as a left turn on screen.
 */
export function strokeToSvgD(stroke) {
  const s = normalizeStroke(stroke);
  const segs = s.turtlePath;
  let p = s.startPoint.slice();
  let h = s.startAngle * DEG;
  let d = `M ${fmt(p[0])} ${fmt(p[1])}`;
  let emitted = false;
  for (const [len0, ang0] of segs) {
    const piece = emitSeg(p, h, Number(len0), Number(ang0) * DEG);
    d += piece.d;
    if (piece.d) emitted = true;
    p = piece.p;
    h = piece.h;
  }
  if (!emitted) return "";
  if (s.fill) d += " Z";
  return d;
}

function emitSeg(p, h, len, ang) {
  if (!Number.isFinite(len) || !Number.isFinite(ang)) return { d: "", p, h };
  if (Math.abs(len) < 1e-9 && Math.abs(ang) < 1e-12) return { d: "", p, h };
  if (Math.abs(ang) >= 2 * Math.PI - 1e-6) {
    const a2 = ang / 2;
    const l2 = len / 2;
    const mid = stepArc(p, h, l2, a2);
    const a = emitSeg(p, h, l2, a2);
    const b = emitSeg(mid.point, mid.heading, l2, a2);
    return { d: a.d + b.d, p: b.p, h: b.h };
  }
  const next = stepArc(p, h, len, ang);
  if (Math.abs(ang) < 1e-8) {
    return { d: ` L ${fmt(next.point[0])} ${fmt(next.point[1])}`, p: next.point, h: next.heading };
  }
  const r = Math.abs(len / ang);
  const large = Math.abs(ang) > Math.PI + 1e-9 ? 1 : 0;
  const sweep = ang > 0 ? 1 : 0;
  return {
    d: ` A ${fmt(r)} ${fmt(r)} 0 ${large} ${sweep} ${fmt(next.point[0])} ${fmt(next.point[1])}`,
    p: next.point,
    h: next.heading,
  };
}

export function resolvePaint(role, theme = "light") {
  const pal = ICON_THEMES[theme] || ICON_THEMES.light;
  if (!role) return pal.ink;
  if (role === "none") return "none";
  if (role.startsWith("#") || role.startsWith("rgb") || role.startsWith("hsl")) return role;
  return pal[role] || role;
}

export function drawingToSvg(drawing, opts = {}) {
  const doc = normalizeDrawing(drawing);
  const theme = opts.theme || "light";
  const pal = ICON_THEMES[theme] || ICON_THEMES.light;
  const size = opts.size ?? 24;
  const pad = opts.pad ?? 2.6;
  const b = drawingBounds(doc);
  const span = Math.max(b.w, b.h, 8);
  const vb = span + pad * 2;
  const cx = b.cx;
  const cy = b.cy;
  const parts = [];
  if (opts.background !== false && pal.paper && pal.paper !== "none") {
    parts.push(
      `<rect x="${fmt(cx - vb / 2)}" y="${fmt(-cy - vb / 2)}" width="${fmt(vb)}" height="${fmt(vb)}" fill="${pal.paper}"/>`,
    );
  }
  for (const stroke of doc.paths) {
    const d = strokeToSvgD(stroke);
    if (!d) continue;
    const role = stroke.stroke || "ink";
    const sw =
      opts.currentColor && role === "ink" ? "currentColor" : resolvePaint(role, theme);
    const fill = stroke.fill
      ? opts.currentColor && stroke.fill === "ink"
        ? "currentColor"
        : resolvePaint(stroke.fill, theme)
      : "none";
    const width = stroke.width ?? 1.6;
    parts.push(
      `<path d="${d}" fill="${fill}" fill-rule="evenodd" stroke="${sw}" stroke-width="${fmt(width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  const inner = `<g transform="translate(0,0) scale(1,-1)">${parts.join("")}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(cx - vb / 2)} ${fmt(-cy - vb / 2)} ${fmt(vb)} ${fmt(vb)}" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
}

export function iconSvg(id, opts = {}) {
  const d = iconDrawing(id);
  if (!d) return "";
  return drawingToSvg(d, { size: 22, theme: "dark", background: false, currentColor: true, ...opts });
}

export function iconMarkup(id, label) {
  const svg = iconSvg(id, { size: 22, theme: "dark", background: false });
  const nm = label || TOOL_ICON_BY_ID[id]?.name || id;
  return `${svg}<span class="tool-nm">${escapeHtml(nm)}</span>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
