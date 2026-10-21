/**
 * Connector: arc sequence from one pose to another.
 *
 * Poses are [x, y, headingDeg] or {x, y, heading} / {at, heading}.
 * The returned block is in the *start* frame (origin, heading 0).
 * Place it with show(connect(a, b), { at: [a.x, a.y], heading: a.h }).
 *
 * mode:
 *   "line"  — turn, straight, turn (default)
 *   "biarc" — G1 biarc, optional p (default 1)
 *   "ata"   — arc, tangent, arc; opts.r0, opts.r1 (signed radii)
 */

import { Arc, Paint, Seq } from "./blocks.js";
import { computeBiarc, xy, Tθ } from "./biarc.js";

const DEG = Math.PI / 180;
const TO_DEG = 180 / Math.PI;

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function asPose(p) {
  if (Array.isArray(p)) return { x: num(p[0]), y: num(p[1]), h: num(p[2]) };
  if (p && typeof p === "object") {
    const at = p.at || p.startPoint;
    return {
      x: num(p.x ?? at?.[0]),
      y: num(p.y ?? at?.[1]),
      h: num(p.heading ?? p.h ?? p.startAngle),
    };
  }
  throw new Error("connect: pose must be [x, y, heading] or {x, y, heading}");
}

function rel(from, to) {
  const a = asPose(from);
  const b = asPose(to);
  const th = -a.h * DEG;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    a,
    b,
    rx: dx * Math.cos(th) - dy * Math.sin(th),
    ry: dx * Math.sin(th) + dy * Math.cos(th),
    dh: b.h - a.h,
  };
}

function lineConnect(rx, ry, dh) {
  const len = Math.hypot(rx, ry);
  if (len < 1e-9) return new Seq([new Arc(0, dh)]);
  const aim = Math.atan2(ry, rx) * TO_DEG;
  return new Seq([new Arc(0, aim), new Arc(len, 0), new Arc(0, dh - aim)]);
}

function biarcConnect(rx, ry, dh, p) {
  const hit = computeBiarc(xy([0, 0]), Tθ(0), xy([rx, ry]), Tθ(dh * DEG), { p: p ?? 1 });
  if (!hit || !hit.a0 || !hit.a1) throw new Error("connect: no biarc");
  return new Seq([
    new Arc(hit.a0.s, hit.a0.Δθ * TO_DEG),
    new Arc(hit.a1.s, hit.a1.Δθ * TO_DEG),
  ]);
}

/**
 * Arc–tangent–arc. r0, r1 are signed radii (positive = left / +Δθ).
 * Centers sit r to the left of the heading. The common external tangent
 * (same sign) or internal tangent (opposite sign) joins them.
 */
function ataConnect(rx, ry, dh, opts) {
  const r0 = num(opts.r0 ?? opts.radii?.[0], 1);
  const r1 = num(opts.r1 ?? opts.radii?.[1], r0);
  if (Math.abs(r0) < 1e-9 || Math.abs(r1) < 1e-9) {
    throw new Error("connect ata: radii must be non-zero");
  }
  const c0x = 0;
  const c0y = r0;
  const th1 = dh * DEG;
  const c1x = rx - r1 * Math.sin(th1);
  const c1y = ry + r1 * Math.cos(th1);
  const vx = c1x - c0x;
  const vy = c1y - c0y;
  const d = Math.hypot(vx, vy);
  const same = r0 * r1 > 0;
  const dr = same ? r1 - r0 : r1 + r0;
  if (d < Math.abs(dr) - 1e-9) throw new Error("connect ata: circles overlap, no tangent");
  const base = Math.atan2(vy, vx);
  const alpha = Math.asin(Math.max(-1, Math.min(1, dr / d)));
  const phi = same ? base + alpha : base - alpha + Math.PI;
  const t0x = c0x + r0 * Math.sin(phi);
  const t0y = c0y - r0 * Math.cos(phi);
  const t1x = c1x + r1 * Math.sin(phi);
  const t1y = c1y - r1 * Math.cos(phi);
  const aim0 = Math.atan2(t0y, t0x) * TO_DEG;
  const turn0 = Math.atan2(Math.sin(phi), Math.cos(phi)) * TO_DEG;
  const line = Math.hypot(t1x - t0x, t1y - t0y);
  const arrive = Math.atan2(Math.sin(th1 - phi), Math.cos(th1 - phi)) * TO_DEG;
  return new Seq([
    new Arc(Math.abs(r0) * Math.abs(turn0) * DEG, turn0),
    new Arc(line, 0),
    new Arc(Math.abs(r1) * Math.abs(arrive) * DEG, arrive),
  ]);
}

export function connect(from, to, opts = {}) {
  const { rx, ry, dh } = rel(from, to);
  const mode = String(opts.mode || opts.kind || "line");
  let block;
  if (mode === "biarc") block = biarcConnect(rx, ry, dh, opts.p);
  else if (mode === "ata" || mode === "arc") block = ataConnect(rx, ry, dh, opts);
  else block = lineConnect(rx, ry, dh);
  const extra = opts.extra || opts.paint || paintOf(opts);
  return extra ? new Paint(block, extra) : block;
}

function paintOf(opts) {
  const fields = {};
  let any = false;
  for (const key of ["stroke", "width", "fill", "dash", "line"]) {
    if (opts[key] != null) {
      fields[key] = opts[key];
      any = true;
    }
  }
  return any ? fields : null;
}
