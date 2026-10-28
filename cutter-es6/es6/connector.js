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
 * rt, if given, replaces the straight tangent with an arc of that radius
 * (positive = ccw). Omitted or 0 keeps the straight tangent. A value
 * outside the range that can touch both circles is clamped.
 * Zero r0 and r1 is the straight line, so ata(a, b) is line(a, b).
 */
export function ata(from, to, r0 = 0, r1 = 0, rt = 0, extra) {
  if (rt && typeof rt === "object") {
    extra = rt;
    rt = extra.rt;
  }
  const [rx, ry, dh] = rel(from, to);
  const R0 = num(r0, 0);
  const R1 = num(r1, 0);
  const paint = paintOf(extra);
  if (Math.abs(R0) < 1e-9 && Math.abs(R1) < 1e-9) return line(from, to, extra);
  if (Math.abs(R0) < 1e-9) return finish(pointArc(rx, ry, dh, R1, false), paint);
  if (Math.abs(R1) < 1e-9) return finish(pointArc(rx, ry, dh, R0, true), paint);
  const RT = num(rt, 0);
  if (Math.abs(RT) < 1e-9) return finish(ataBlock(rx, ry, dh, R0, R1), paint);
  return finish(ataCurve(rx, ry, dh, R0, R1, RT), paint);
}

/** One radius is zero: hinge, tangent line, arc — or arc, line, hinge. */
function pointArc(rx, ry, dh, r, startArc) {
  const cx = startArc ? 0 : rx - r * Math.sin(dh);
  const cy = startArc ? r : ry + r * Math.cos(dh);
  const px = startArc ? rx : 0;
  const py = startArc ? ry : 0;
  const toCenter = Math.atan2(cy - py, cx - px);
  const toPoint = Math.atan2(py - cy, px - cx);
  const d = Math.hypot(cx - px, cy - py);
  if (d < Math.abs(r) - 1e-9) throw new Error("ata: point inside circle");
  const alpha = Math.asin(Math.max(-1, Math.min(1, Math.abs(r) / d))) * Math.sign(r || 1);
  let best = null;
  const phis = [toCenter - alpha, toCenter + alpha, toPoint - alpha, toPoint + alpha];
  for (const phi of phis) {
    const tx = cx + r * Math.sin(phi);
    const ty = cy - r * Math.cos(phi);
    const turn = wrap(startArc ? phi : dh - phi);
    const s = r * turn;
    const lineLen = Math.hypot((startArc ? rx : tx) - (startArc ? tx : 0), (startArc ? ry : ty) - (startArc ? ty : 0));
    const hinge = wrap(startArc ? dh - phi : phi);
    const arcs = startArc
      ? [new Arc(s, turn), new Arc(lineLen, 0), new Arc(0, hinge)]
      : [new Arc(0, phi), new Arc(lineLen, 0), new Arc(s, turn)];
    const block = new Seq(arcs);
    const got = block.interface();
    const err = Math.hypot(got[0] - rx, got[1] - ry) + Math.abs(wrap(got[2] - dh));
    if (err > 1e-3) continue;
    const cost = Math.abs(s) + lineLen;
    if (!best || cost < best.cost) best = { cost, block };
  }
  if (!best) throw new Error("ata: no tangent");
  return best.block;
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

/**
 * Middle arc of radius rt, tangent to both end circles.
 * Its center is |rt − r0| from c0 and |rt − r1| from c1.
 */
function ataCurve(rx, ry, dh, r0, r1, rt) {
  const c0x = 0;
  const c0y = r0;
  const c1x = rx - r1 * Math.sin(dh);
  const c1y = ry + r1 * Math.cos(dh);
  const d = Math.hypot(c1x - c0x, c1y - c0y);
  const radius = clampRt(rt, r0, r1, d);
  const a = Math.abs(radius - r0);
  const b = Math.abs(radius - r1);
  const hits = circleHits(c0x, c0y, a, c1x, c1y, b);
  let best = null;
  for (const [ctx, cty] of hits) {
    const built = buildCurve(ctx, cty, radius, rx, ry, dh, r0, r1, c1x, c1y);
    if (!built) continue;
    if (!best || built.cost < best.cost) best = built;
  }
  if (!best) return ataBlock(rx, ry, dh, r0, r1);
  return best.block;
}

function clampRt(rt, r0, r1, d) {
  if (touches(rt, r0, r1, d)) return rt;
  const sign = rt < 0 ? -1 : 1;
  let lo = 1e-3;
  let hi = Math.max(Math.abs(rt), Math.abs(r0), Math.abs(r1), d) * 4 + 1;
  if (!touches(sign * hi, r0, r1, d)) return sign * hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (touches(sign * mid, r0, r1, d)) hi = mid;
    else lo = mid;
  }
  return sign * hi;
}

function touches(rt, r0, r1, d) {
  const a = Math.abs(rt - r0);
  const b = Math.abs(rt - r1);
  return Math.abs(a - b) <= d + 1e-9 && a + b >= d - 1e-9 && a > 1e-9 && b > 1e-9;
}

function circleHits(x0, y0, r0, x1, y1, r1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return [];
  const h = (d * d + r0 * r0 - r1 * r1) / (2 * d);
  const k2 = r0 * r0 - h * h;
  if (k2 < -1e-8) return [];
  const k = Math.sqrt(Math.max(0, k2));
  const ux = dx / d;
  const uy = dy / d;
  const px = x0 + h * ux;
  const py = y0 + h * uy;
  if (k < 1e-9) return [[px, py]];
  return [
    [px - k * uy, py + k * ux],
    [px + k * uy, py - k * ux],
  ];
}

function buildCurve(ctx, cty, rt, rx, ry, dh, r0, r1, c1x, c1y) {
  const left0 = unit(ctx - 0, cty - r0, rt - r0);
  const left1 = unit(ctx - c1x, cty - c1y, rt - r1);
  if (!left0 || !left1) return null;
  const phi0 = Math.atan2(-left0[0], left0[1]);
  const phi1 = Math.atan2(-left1[0], left1[1]);
  const turn0 = wrap(phi0);
  const turnM = wrap(phi1 - phi0);
  const turn1 = wrap(dh - phi1);
  const block = new Seq([
    new Arc(r0 * turn0, turn0),
    new Arc(rt * turnM, turnM),
    new Arc(r1 * turn1, turn1),
  ]);
  const got = block.interface();
  const err = Math.hypot(got[0] - rx, got[1] - ry) + Math.abs(wrap(got[2] - dh));
  if (err > 1e-3) return null;
  return { cost: Math.abs(r0 * turn0) + Math.abs(rt * turnM) + Math.abs(r1 * turn1), block };
}

function unit(dx, dy, scale) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-9 || Math.abs(scale) < 1e-9) return null;
  const s = Math.sign(scale) / len;
  return [dx * s, dy * s];
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
