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
 * rt curves the tangent: omitted, or ±Infinity, keeps it straight.
 * +0 uses rtmax and -0 uses rtmin, the extreme radii that still
 * touch both circles with every arc length positive.
 * Zero r0 and r1 is the straight line, so ata(a, b) is line(a, b).
 * undefined or ±Infinity for r0 or r1 means that side is straight;
 * rt is then the fillet radius between the straight sides.
 */
export function ata(from, to, r0, r1, rt, extra) {
  if (rt && typeof rt === "object") {
    extra = rt;
    rt = extra.rt;
  }
  const [rx, ry, dh] = rel(from, to);
  const i0 = r0 == null || !Number.isFinite(Number(r0));
  const i1 = r1 == null || !Number.isFinite(Number(r1));
  const paint = paintOf(extra);
  if (i0 && i1 && rt != null && Number.isFinite(Number(rt)) && !Object.is(Number(rt), 0) && !Object.is(Number(rt), -0)) {
    return finish(corner(rx, ry, dh, Number(rt)), paint);
  }
  if (i0 || i1) {
    const big = 1e6;
    const R0 = i0 ? big * (Object.is(r0, -Infinity) ? -1 : 1) : num(r0, 0);
    const R1 = i1 ? big * (Object.is(r1, -Infinity) ? -1 : 1) : num(r1, 0);
    return finish(flattenWide(ata(from, to, R0, R1, rt)), paint);
  }
  const R0 = num(r0, 0);
  const R1 = num(r1, 0);
  if (Math.abs(R0) < 1e-9 && Math.abs(R1) < 1e-9) return line(from, to, extra);
  if (Math.abs(R0) < 1e-9) return finish(pointArc(rx, ry, dh, R1, false), paint);
  if (Math.abs(R1) < 1e-9) return finish(pointArc(rx, ry, dh, R0, true), paint);
  if (rt == null || !Number.isFinite(Number(rt))) return finish(ataBlock(rx, ry, dh, R0, R1), paint);
  return finish(ataCurve(rx, ry, dh, R0, R1, Number(rt)), paint);
}

/** Turn of the same sign as r, so s = r·Δθ is never negative. */
function posTurn(delta, r) {
  let t = wrap(delta);
  if (r > 0 && t < 0) t += 2 * Math.PI;
  if (r < 0 && t > 0) t -= 2 * Math.PI;
  return Math.abs(t) < 1e-12 ? 0 : t;
}

/** A very large radius is a straight side. Collapse it to Δθ = 0. */
function flattenWide(block) {
  const arcs = [];
  for (const [s, da] of block.arcs()) {
    if (Math.abs(da) > 1e-6 && Math.abs(s / da) > 1e5) arcs.push(new Arc(s, 0));
    else arcs.push(new Arc(s, da));
  }
  return new Seq(arcs);
}

function corner(rx, ry, dh, rt) {
  const turn = posTurn(dh, rt);
  const left1 = [-Math.sin(dh), Math.cos(dh)];
  const px = rx + rt * left1[0];
  const py = ry + rt * left1[1];
  let t;
  if (Math.abs(Math.sin(dh)) > 1e-8) t = (rt - py) / Math.sin(dh);
  else if (Math.abs(py - rt) < 1e-6) t = 0;
  else return line([0, 0, 0], [rx, ry, dh]);
  const cx = px + t * Math.cos(dh);
  const t0x = cx;
  const t1x = cx - rt * left1[0];
  const t1y = rt - rt * left1[1];
  const s0 = t0x;
  const s1 = Math.hypot(rx - t1x, ry - t1y);
  if (s0 < -1e-9 || s1 < -1e-9) return line([0, 0, 0], [rx, ry, dh]);
  const block = new Seq([new Arc(Math.abs(s0), 0), new Arc(rt * turn, turn), new Arc(s1, 0)]);
  const got = block.interface();
  if (Math.hypot(got[0] - rx, got[1] - ry) + Math.abs(wrap(got[2] - dh)) > 1e-3) {
    return line([0, 0, 0], [rx, ry, dh]);
  }
  return block;
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
    const turn = posTurn(startArc ? phi : dh - phi, r);
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
 * +0 selects rtmax, -0 selects rtmin. Other values are clamped
 * into that range. Every arc length is positive.
 */
function ataCurve(rx, ry, dh, r0, r1, rt) {
  const c1x = rx - r1 * Math.sin(dh);
  const c1y = ry + r1 * Math.cos(dh);
  const bounds = rtBounds(rx, ry, dh, r0, r1, c1x, c1y);
  let radius = rt;
  if (Object.is(rt, -0)) radius = bounds.min;
  else if (Object.is(rt, 0)) radius = bounds.max;
  else if (!solveCurve(rt, rx, ry, dh, r0, r1, c1x, c1y)) {
    radius = rt < 0 ? bounds.min : bounds.max;
  }
  const built = solveCurve(radius, rx, ry, dh, r0, r1, c1x, c1y);
  if (built) return built.block;
  return ataBlock(rx, ry, dh, r0, r1);
}

function rtBounds(rx, ry, dh, r0, r1, c1x, c1y) {
  const span = Math.max(Math.abs(r0), Math.abs(r1), Math.hypot(c1x, c1y - r0), 1) * 16;
  const works = (v) => Math.abs(v) > 1e-6 && !!solveCurve(v, rx, ry, dh, r0, r1, c1x, c1y);
  let max = span;
  let min = -span;
  for (let v = span; v > 1e-3; v *= 0.6) if (works(v)) max = v;
  for (let v = span; v > 1e-3; v *= 0.6) if (works(-v)) min = -v;
  return { min, max };
}

function solveCurve(rt, rx, ry, dh, r0, r1, c1x, c1y) {
  const hits = circleHits(0, r0, Math.abs(rt - r0), c1x, c1y, Math.abs(rt - r1));
  let best = null;
  for (const [ctx, cty] of hits) {
    const built = buildCurve(ctx, cty, rt, rx, ry, dh, r0, r1, c1x, c1y);
    if (!built) continue;
    if (!best || built.cost < best.cost) best = built;
  }
  return best;
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
  const turn0 = posTurn(phi0, r0);
  const turnM = posTurn(phi1 - phi0, rt);
  const turn1 = posTurn(dh - phi1, r1);
  const s0 = r0 * turn0;
  const sm = rt * turnM;
  const s1 = r1 * turn1;
  if (s0 < -1e-9 || sm < -1e-9 || s1 < -1e-9) return null;
  const block = new Seq([new Arc(s0, turn0), new Arc(sm, turnM), new Arc(s1, turn1)]);
  const got = block.interface();
  const err = Math.hypot(got[0] - rx, got[1] - ry) + Math.abs(wrap(got[2] - dh));
  if (err > 1e-3) return null;
  return { cost: s0 + sm + s1, block };
}

function unit(dx, dy, scale) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-9 || Math.abs(scale) < 1e-9) return null;
  const s = Math.sign(scale) / len;
  return [dx * s, dy * s];
}

function buildAta(phi, rx, ry, dh, r0, r1, c1x, c1y) {
  const turn0 = posTurn(phi, r0);
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
  const turn1 = posTurn(dh - phi, r1);
  const s1 = r1 * turn1;
  const endx = t1x + r1 * (Math.sin(dh) - Math.sin(phi));
  const endy = t1y - r1 * (Math.cos(dh) - Math.cos(phi));
  const err = Math.hypot(endx - rx, endy - ry) + Math.abs(wrap(phi + turn1 - dh));
  if (err > 1e-4 || s0 < -1e-9 || s1 < -1e-9) return null;
  return {
    cost: Math.abs(s0) + line + Math.abs(s1),
    block: new Seq([new Arc(s0, turn0), new Arc(line, 0), new Arc(s1, turn1)]),
  };
}
