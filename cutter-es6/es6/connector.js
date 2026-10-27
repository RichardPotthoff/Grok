/**
 * Pose-to-pose connectors. Angles are radians.
 *
 * A pose is [x, y, θ]. asPose also accepts a typed array or
 * {dx, dy, dtheta} / {x, y, heading}, so a Block.interface() result
 * can be passed straight through.
 *
 * The returned block is in the start frame (origin, heading 0).
 * Its interface() equals the relative end pose.
 */

import { Arc, Paint, Seq } from "./blocks.js";
import { computeBiarc, xy, Tθ } from "./biarc.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function wrap(a) {
  const t = Math.atan2(Math.sin(a), Math.cos(a));
  return t;
}

/** User-facing: any pose-like value to [x, y, θ]. */
export function asPose(p) {
  if (p == null) return [0, 0, 0];
  if (typeof p.length === "number" && p.length >= 3 && typeof p[0] === "number") {
    return [num(p[0]), num(p[1]), num(p[2])];
  }
  if (p && typeof p === "object") {
    const at = p.at || p.startPoint;
    return [
      num(p.dx ?? p.x ?? at?.[0]),
      num(p.dy ?? p.y ?? at?.[1]),
      num(p.dtheta ?? p.heading ?? p.h ?? p.startAngle),
    ];
  }
  throw new Error("pose must be [x, y, θ] or {dx, dy, dtheta}");
}

function rel(from, to) {
  const a = asPose(from);
  const b = asPose(to);
  const th = -a[2];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return [
    dx * Math.cos(th) - dy * Math.sin(th),
    dx * Math.sin(th) + dy * Math.cos(th),
    b[2] - a[2],
  ];
}

function paintOf(opts) {
  if (!opts) return null;
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

function finish(block, extra) {
  return extra ? new Paint(block, extra) : block;
}

/** Turn, straight, turn. End pose matches exactly. */
export function line(from, to, extra) {
  const [rx, ry, dh] = rel(from, to);
  const len = Math.hypot(rx, ry);
  if (len < 1e-9) return finish(new Seq([new Arc(0, dh)]), paintOf(extra));
  const aim = Math.atan2(ry, rx);
  return finish(
    new Seq([new Arc(0, aim), new Arc(len, 0), new Arc(0, wrap(dh - aim))]),
    paintOf(extra),
  );
}

/** G1 biarc. p places the junction (default 1). End pose matches exactly. */
export function biarc(from, to, p = 1, extra) {
  const [rx, ry, dh] = rel(from, to);
  const hit = computeBiarc(xy([0, 0]), Tθ(0), xy([rx, ry]), Tθ(dh), { p: p ?? 1 });
  if (!hit || !hit.a0 || !hit.a1) throw new Error("biarc: no solution");
  return finish(
    new Seq([new Arc(hit.a0.s, hit.a0.Δθ), new Arc(hit.a1.s, hit.a1.Δθ)]),
    paintOf(extra),
  );
}

/**
 * Arc, tangent, arc. r0 and r1 are signed radii (positive = left).
 * Tries both external tangents and keeps the one that lands on the end pose.
 */
export function ata(from, to, r0, r1, extra) {
  const [rx, ry, dh] = rel(from, to);
  const R0 = num(r0, 1);
  const R1 = num(r1, R0);
  if (Math.abs(R0) < 1e-9 || Math.abs(R1) < 1e-9) throw new Error("ata: radii must be non-zero");
  const block = ataBlock(rx, ry, dh, R0, R1);
  return finish(block, paintOf(extra));
}

function ataBlock(rx, ry, dh, r0, r1) {
  const c0x = 0;
  const c0y = r0;
  const c1x = rx - r1 * Math.sin(dh);
  const c1y = ry + r1 * Math.cos(dh);
  const vx = c1x - c0x;
  const vy = c1y - c0y;
  const d = Math.hypot(vx, vy);
  const base = Math.atan2(vy, vx);
  let best = null;
  for (const internal of [false, true]) {
    const R1 = internal ? -r1 : r1;
    const dr = R1 - r0;
    if (d < Math.abs(dr) - 1e-9) continue;
    const alpha = Math.asin(Math.max(-1, Math.min(1, dr / d)));
    const sols = [base - alpha, base - Math.PI + alpha];
    for (const raw of sols) {
      const phi = internal ? raw + Math.PI : raw;
      const built = buildAta(phi, rx, ry, dh, r0, r1, c1x, c1y);
      if (!built) continue;
      if (!best || built.cost < best.cost) best = built;
    }
  }
  if (!best) throw new Error("ata: no tangent");
  return best.block;
}

function buildAta(phi, rx, ry, dh, r0, r1, c1x, c1y) {
  const turn0 = wrap(phi);
  const s0 = r0 * turn0;
  const t0x = r0 * Math.sin(turn0);
  const t0y = r0 * (1 - Math.cos(turn0));
  const t1x = c1x + r1 * Math.sin(phi);
  const t1y = c1y - r1 * Math.cos(phi);
  const lx = t1x - t0x;
  const ly = t1y - t0y;
  const line = Math.hypot(lx, ly);
  const dir = Math.atan2(ly, lx);
  if (line > 1e-8 && Math.abs(wrap(dir - phi)) > 1e-4) return null;
  const turn1 = wrap(dh - phi);
  const s1 = r1 * turn1;
  const endx = t1x + r1 * (Math.sin(dh) - Math.sin(phi));
  const endy = t1y - r1 * (Math.cos(dh) - Math.cos(phi));
  const err = Math.hypot(endx - rx, endy - ry) + Math.abs(wrap(phi + turn1 - dh));
  if (err > 1e-4) return null;
  return {
    cost: Math.abs(s0) + line + Math.abs(s1),
    block: new Seq([new Arc(s0, turn0), new Arc(line, 0), new Arc(s1, turn1)]),
  };
}
