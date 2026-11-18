/**
 * ATA connectors built on the analytic intersect primitives.
 *
 * ataSigned(from, to, r0, rt, r1) — senses given by the signs of the radii.
 * ataBest(from, to, radii) — tries admissible sign combinations,
 *   returns the one with smallest total |Δθ|.
 *
 * radii elements may be a number, [rPos, rNeg], 0, or ±Infinity.
 * Tiny lengths are left as computed; the caller decides.
 */

import { Arc, Seq } from "./blocks.js";
import { asPose } from "./connector.js";
import { intersectCircleCircle, intersectCircleLine, intersectLineLine, isZero, isInf } from "./intersect.js";

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

function wrap(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Build one signed ATA. Returns Seq or null. Uses optional buf for intersects. */
export function ataSigned(from, to, r0, rt, r1, buf) {
  if (!buf) buf = new Float64Array(8);
  const [rx, ry, dh] = rel(from, to);

  // Both sides straight: line-line (sharp corner when rt ≈ 0)
  if (isInf(r0) && isInf(r1)) {
    return lineLine(rx, ry, dh, rt, buf);
  }

  // One or both finite — existing circle path (still approximate)
  const c0x = 0, c0y = isInf(r0) ? 0 : r0;
  const c1x = isInf(r1) ? rx : rx - r1 * Math.sin(dh);
  const c1y = isInf(r1) ? ry : ry + r1 * Math.cos(dh);

  const d0 = Math.abs(rt - (isInf(r0) ? 0 : r0));
  const d1 = Math.abs(rt - (isInf(r1) ? 0 : r1));

  let hits = 0;
  if (isInf(rt)) {
    return null; // straight middle still TODO
  }
  // Mixed: one side is a line
  if (isInf(r0) || isInf(r1)) {
    return circleLine(rx, ry, dh, r0, rt, r1, buf);
  }
  if (isZero(rt)) {
    hits = intersectCircleCircle(c0x, c0y, Math.abs(r0), c1x, c1y, Math.abs(r1), buf);
  } else {
    hits = intersectCircleCircle(c0x, c0y, d0, c1x, c1y, d1, buf);
  }
  if (!hits) return null;

  let best = null;
  for (let i = 0; i < hits; i++) {
    const mx = buf[i * 4];
    const my = buf[i * 4 + 1];
    const built = buildFromMiddle(mx, my, rt, rx, ry, dh, r0, r1, c0x, c0y, c1x, c1y);
    if (built && (!best || built.curv < best.curv)) best = built;
  }
  return best ? best.block : null;
}

/** Two directed lines, rt=0 → sharp corner.
 *  Lengths are the signed parameters returned by the intersection. */
function lineLine(rx, ry, dh, rt, buf) {
  if (!(isZero(rt) || Math.abs(rt) < 1e-15)) return null;
  const d0x = 1, d0y = 0;
  const d1x = Math.cos(dh), d1y = Math.sin(dh);
  const n = intersectLineLine(0, 0, d0x, d0y, rx, ry, d1x, d1y, buf);
  if (!n) return null;
  // buf[2] = signed distance along start line to junction
  // buf[3] = signed distance from junction to end pose along end heading
  return new Seq([
    new Arc(buf[2], 0),
    new Arc(0, wrap(dh)),
    new Arc(buf[3], 0),
  ]);
}

/** Circle vs line, rt=0 → direct intersection.
 *  Arc length is the signed center angle from the start point;
 *  line length is the signed parameter from the intersection. */
function circleLine(rx, ry, dh, r0, rt, r1, buf) {
  if (!(isZero(rt) || Math.abs(rt) < 1e-15)) return null;
  const startIsLine = isInf(r0);
  const R = startIsLine ? r1 : r0;
  const absR = Math.abs(R);
  const cx = startIsLine ? rx - R * Math.sin(dh) : 0;
  const cy = startIsLine ? ry + R * Math.cos(dh) : R;
  const lpx = startIsLine ? 0 : rx;
  const lpy = startIsLine ? 0 : ry;
  const ldx = startIsLine ? 1 : Math.cos(dh);
  const ldy = startIsLine ? 0 : Math.sin(dh);

  const n = intersectCircleLine(cx, cy, absR, lpx, lpy, ldx, ldy, buf);
  if (!n) return null;

  // Reference angle of the arc’s start point, measured at the center.
  const startAng = Math.atan2(-cy, -cx);
  let best = null;
  for (let i = 0; i < n; i++) {
    const px = buf[i * 4], py = buf[i * 4 + 1];
    const tLine = buf[i * 4 + 3];                 // signed, 0 at the line’s reference point
    const hitAng = Math.atan2(py - cy, px - cx);
    let turn = wrap(hitAng - startAng);
    if (R > 0 && turn < 0) turn += 2 * Math.PI;
    if (R < 0 && turn > 0) turn -= 2 * Math.PI;
    const sArc = R * turn;
    // line reference is the end pose when the line is the end side,
    // so length from junction to end pose is -tLine
    const sLine = startIsLine ? tLine : -tLine;
    const curv = Math.abs(turn);
    if (!best || curv < best.curv) best = { turn, sArc, sLine, curv };
  }
  if (!best) return null;
  return startIsLine
    ? new Seq([new Arc(best.sLine, 0), new Arc(0, 0), new Arc(best.sArc, best.turn)])
    : new Seq([new Arc(best.sArc, best.turn), new Arc(0, 0), new Arc(best.sLine, 0)]);
}

function buildFromMiddle(mx, my, rt, rx, ry, dh, r0, r1, c0x, c0y, c1x, c1y) {
  // tangent points: from middle center toward the end centers, scaled
  // For simplicity, compute the contact points.
  // Contact on start circle: direction from c0 to m, length |r0|
  const dx0 = mx - c0x, dy0 = my - c0y;
  const len0 = Math.hypot(dx0, dy0) || 1;
  const tx0 = c0x + (r0 / len0) * dx0 * Math.sign(r0 || 1); // rough
  const ty0 = c0y + (r0 / len0) * dy0 * Math.sign(r0 || 1);
  // This is approximate; a correct version normalizes properly for internal/external.
  // For the first trial we compute turns via angles.

  const phi0 = Math.atan2(ty0 - c0y, tx0 - c0x);
  const phi1 = Math.atan2(my - c1y, mx - c1x); // placeholder
  // Better angle-based construction (similar to existing buildCurve)
  const left0x = mx - c0x, left0y = my - c0y;
  const left1x = mx - c1x, left1y = my - c1y;
  const phi0b = Math.atan2(-left0x, left0y); // matches existing style
  const phi1b = Math.atan2(-left1x, left1y);
  const turn0 = wrap(phi0b); // will be adjusted by sign later
  const turnM = wrap(phi1b - phi0b);
  const turn1 = wrap(dh - phi1b);
  // force sign consistency with radius (positive r => positive turn for left)
  const t0 = r0 === 0 ? 0 : (r0 > 0 ? (turn0 < 0 ? turn0 + TAU : turn0) : (turn0 > 0 ? turn0 - TAU : turn0));
  const tm = rt === 0 ? 0 : (rt > 0 ? (turnM < 0 ? turnM + TAU : turnM) : (turnM > 0 ? turnM - TAU : turnM));
  const t1 = r1 === 0 ? 0 : (r1 > 0 ? (turn1 < 0 ? turn1 + TAU : turn1) : (turn1 > 0 ? turn1 - TAU : turn1));
  const s0 = r0 * t0;
  const sm = rt * tm;
  const s1 = r1 * t1;
  const block = new Seq([new Arc(s0, t0), new Arc(sm, tm), new Arc(s1, t1)]);
  // verify end pose roughly
  const got = block.interface();
  const err = Math.hypot(got[0] - rx, got[1] - ry) + Math.abs(wrap(got[2] - dh));
  if (err > 1e-4) return null; // temporary gate so we don't return garbage; caller can relax
  return { block, curv: Math.abs(t0) + Math.abs(tm) + Math.abs(t1), err };
}

const TAU = Math.PI * 2;

/** Try sign combinations. radii = [r0spec, rtspec, r1spec]
 *  each spec: number | [pos, neg] | 0 | ±Infinity
 */
export function ataBest(from, to, radii = [1, 0, 1]) {
  const choices = radii.map(specToChoices);
  let best = null;
  const buf = new Float64Array(8);
  for (const r0 of choices[0]) {
    for (const rt of choices[1]) {
      for (const r1 of choices[2]) {
        const block = ataSigned(from, to, r0, rt, r1, buf);
        if (!block) continue;
        // compute curvature from the arcs
        let curv = 0;
        for (const [s, da] of block.arcs()) curv += Math.abs(da);
        if (!best || curv < best.curv) best = { block, curv, r0, rt, r1 };
      }
    }
  }
  return best;
}

function specToChoices(spec) {
  if (Array.isArray(spec)) return spec.filter(v => v != null);
  if (isZero(spec) || isInf(spec)) return [spec];
  if (typeof spec === "number") return [spec, -spec]; // both senses if only magnitude given
  return [1, -1];
}

export function ataArcsBuf(from, to, r0, rt, r1, buf) {
  const block = ataSigned(from, to, r0, rt, r1);
  if (!block) return 0;
  let i = 0;
  for (const [s, da] of block.arcs()) {
    if (i + 1 >= (buf.length || 6)) break;
    buf[i++] = s;
    buf[i++] = da;
  }
  return i / 2;
}
