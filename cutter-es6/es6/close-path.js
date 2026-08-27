/**
 * Exact-arc path closure.
 *
 * G0: last segment is a single fitArc onto the start point (position only).
 * G1: last two segments become a biarc that matches start point AND start heading.
 *
 * Two arcs are required for a smooth join: position is 2 constraints and
 * heading is a third. Each arc is (s, Δθ); after locking total turn so the
 * heading matches, lengths solve a 2×2 linear system in the chord directions.
 */

import { DEG, fitArc } from "./path-utils.js";

export const G0_GAP = 0.02;
export const G1_HEADING_RAD = (0.35 * Math.PI) / 180;

export function wrapPi(a) {
  const t = a + Math.PI;
  return t - 2 * Math.PI * Math.floor(t / (2 * Math.PI)) - Math.PI;
}

export function sinc(x) {
  return Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x;
}

/** One exact turtle step. `ang` is radians. */
export function stepArc(point, heading, len, ang) {
  const half = ang / 2;
  const chord = Number(len) * sinc(half);
  const ch = heading + half;
  return {
    point: [point[0] + chord * Math.cos(ch), point[1] + chord * Math.sin(ch)],
    heading: heading + ang,
  };
}

/** Pose after each segment. Index -1 is the start pose. */
export function walkExact(outline) {
  let p = (outline.startPoint || [0, 0]).slice();
  let h = (outline.startAngle ?? 0) * DEG;
  const poses = [{ point: p.slice(), heading: h, i: -1 }];
  const segs = outline.turtlePath || [];
  for (let i = 0; i < segs.length; i++) {
    const [len, angDeg] = segs[i];
    const next = stepArc(p, h, Number(len), Number(angDeg) * DEG);
    p = next.point;
    h = next.heading;
    poses.push({ point: p.slice(), heading: h, i });
  }
  return poses;
}

export function poseBefore(outline, idx) {
  const n = (outline.turtlePath || []).length;
  const i = Math.max(0, Math.min(idx, n));
  const prefix = {
    ...outline,
    turtlePath: (outline.turtlePath || []).slice(0, i),
  };
  const poses = walkExact(prefix);
  return poses[poses.length - 1];
}

export function closureInfo(outline) {
  const poses = walkExact(outline);
  const start = poses[0];
  const end = poses[poses.length - 1];
  const dx = end.point[0] - start.point[0];
  const dy = end.point[1] - start.point[1];
  const gap = Math.hypot(dx, dy);
  const dHeading = wrapPi(end.heading - start.heading);
  const g0 = gap <= G0_GAP;
  const g1 = g0 && Math.abs(dHeading) <= G1_HEADING_RAD;
  return {
    startPoint: start.point,
    startHeading: start.heading,
    endPoint: end.point,
    endHeading: end.heading,
    gap,
    dHeading,
    dHeadingDeg: dHeading / DEG,
    g0,
    g1,
    n: (outline.turtlePath || []).length,
  };
}

/**
 * Solve L0, L1 so two arcs with fixed turns Δ0, Δ1 go from (A, α) to B.
 * Displacement is linear in the two lengths.
 */
export function lengthsForTurns(A, alpha, B, d0, d1) {
  const u0s = sinc(d0 / 2);
  const u1s = sinc(d1 / 2);
  const a0 = alpha + d0 / 2;
  const a1 = alpha + d0 + d1 / 2;
  const u0x = u0s * Math.cos(a0);
  const u0y = u0s * Math.sin(a0);
  const u1x = u1s * Math.cos(a1);
  const u1y = u1s * Math.sin(a1);
  const det = u0x * u1y - u0y * u1x;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-14) return null;
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const L0 = (dx * u1y - dy * u1x) / det;
  const L1 = (u0x * dy - u0y * dx) / det;
  if (!Number.isFinite(L0) || !Number.isFinite(L1)) return null;
  return [L0, L1];
}

function scoreBiarc(L0, d0, L1, d1, hint) {
  const big = Math.abs(L0) + Math.abs(L1);
  if (big > 1e6) return Infinity;
  let s = 0;
  if (hint) {
    const [hL0, hD0, hL1, hD1] = hint;
    s += (L0 - hL0) ** 2 + (L1 - hL1) ** 2;
    s += 4 * (d0 - hD0) ** 2 + 4 * (d1 - hD1) ** 2;
  } else {
    s += Math.abs(L0) + Math.abs(L1);
    s += 0.35 * (Math.abs(d0) + Math.abs(d1));
  }
  if (L0 < 0) s += 2.5 * Math.abs(L0);
  if (L1 < 0) s += 2.5 * Math.abs(L1);
  return s;
}

function consider(candidates, L0, d0, L1, d1, hint, extra = 0) {
  if (![L0, d0, L1, d1].every(Number.isFinite)) return;
  if (Math.abs(L0) + Math.abs(L1) > 1e6) return;
  candidates.push({
    segs: [L0, d0, L1, d1],
    score: scoreBiarc(L0, d0, L1, d1, hint) + extra,
  });
}

/**
 * Second-arc-as-fitArc family: J is reached by (L0, Δ0), then a unique arc
 * hits B. Search for heading match at B. Covers the singular "headings
 * already agree" case the 2×2 misses.
 */
function headingErrForL0(A, alpha, B, beta, L0, d0) {
  const mid = stepArc(A, alpha, L0, d0);
  const second = fitArc(mid.point, mid.heading, B);
  const d1 = second.ang * DEG;
  return {
    err: wrapPi(mid.heading + d1 - beta),
    L1: second.len,
    d1,
    mid,
  };
}

function solveL0ForTurn(A, alpha, B, beta, d0, hint) {
  const gap = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const span = Math.max(gap * 4, hint ? Math.abs(hint[0]) * 3 : 1, 2);
  let bestL = hint ? hint[0] : span / 4;
  let best = headingErrForL0(A, alpha, B, beta, bestL, d0);
  for (let i = 0; i <= 40; i++) {
    const L0 = -span + (2 * span * i) / 40;
    const cur = headingErrForL0(A, alpha, B, beta, L0, d0);
    if (Math.abs(cur.err) < Math.abs(best.err)) {
      best = cur;
      bestL = L0;
    }
  }
  // Two Newton steps on wrap-free finite difference.
  for (let n = 0; n < 8; n++) {
    const h = Math.max(1e-4, Math.abs(bestL) * 1e-4);
    const f0 = headingErrForL0(A, alpha, B, beta, bestL, d0).err;
    const fp = headingErrForL0(A, alpha, B, beta, bestL + h, d0).err;
    const deriv = (fp - f0) / h;
    if (Math.abs(deriv) < 1e-10) break;
    bestL -= f0 / deriv;
    if (!Number.isFinite(bestL) || Math.abs(bestL) > span * 8) break;
  }
  best = headingErrForL0(A, alpha, B, beta, bestL, d0);
  return { L0: bestL, ...best };
}

function leftNormal(heading) {
  return [-Math.sin(heading), Math.cos(heading)];
}

function signedAngle(ux, uy, vx, vy) {
  return wrapPi(Math.atan2(vy, vx) - Math.atan2(uy, ux));
}

/**
 * Circles tangent at the two poses. C = P + r N(heading), r = s/Δθ.
 * For each sampled r0, r1 is solved from |C0−C1| = |r0∓r1|.
 */
function scanRadiusFamily(A, alpha, B, beta, hint, candidates) {
  const n0 = leftNormal(alpha);
  const n1 = leftNormal(beta);
  const V = [B[0] - A[0], B[1] - A[1]];
  const gap = Math.hypot(V[0], V[1]);
  const scale = Math.max(gap, 0.5);
  const radii = [];
  const addR = (r) => {
    if (!Number.isFinite(r) || Math.abs(r) < 1e-6) return;
    if (radii.some((x) => Math.abs(x - r) < 1e-4)) return;
    radii.push(r);
  };
  if (hint) {
    if (Math.abs(hint[1]) > 1e-8) addR(hint[0] / hint[1]);
    if (Math.abs(hint[3]) > 1e-8) addR(hint[2] / hint[3]);
  }
  for (let i = 1; i <= 16; i++) {
    addR((i / 4) * scale);
    addR((-i / 4) * scale);
  }

  for (const r0 of radii) {
    const Wx = V[0] + r0 * n0[0];
    const Wy = V[1] + r0 * n0[1];
    const n1w = Wx * n1[0] + Wy * n1[1];
    const w2 = Wx * Wx + Wy * Wy;
    for (const kind of [-1, 1]) {
      const denom = 2 * (kind * r0 - n1w);
      if (Math.abs(denom) < 1e-12) continue;
      const r1 = (r0 * r0 - w2) / denom;
      if (!Number.isFinite(r1) || Math.abs(r1) < 1e-6) continue;
      const C0 = [A[0] + r0 * n0[0], A[1] + r0 * n0[1]];
      const C1 = [B[0] + r1 * n1[0], B[1] + r1 * n1[1]];
      const d = Math.hypot(C1[0] - C0[0], C1[1] - C0[1]);
      const want = Math.abs(r0 - kind * r1);
      if (Math.abs(d - want) > 1e-3 * Math.max(1, d)) continue;
      if (d < 1e-10) continue;
      const dir = [(C1[0] - C0[0]) / d, (C1[1] - C0[1]) / d];
      for (const s of [1, -1]) {
        const J = [C0[0] + s * Math.abs(r0) * dir[0], C0[1] + s * Math.abs(r0) * dir[1]];
        const d0 = signedAngle(A[0] - C0[0], A[1] - C0[1], J[0] - C0[0], J[1] - C0[1]);
        const d1 = signedAngle(J[0] - C1[0], J[1] - C1[1], B[0] - C1[0], B[1] - C1[1]);
        let a0 = d0;
        let a1 = d1;
        if (r0 < 0 && a0 > 1e-8) a0 -= 2 * Math.PI;
        if (r0 > 0 && a0 < -1e-8) a0 += 2 * Math.PI;
        if (r1 < 0 && a1 > 1e-8) a1 -= 2 * Math.PI;
        if (r1 > 0 && a1 < -1e-8) a1 += 2 * Math.PI;
        consider(candidates, r0 * a0, a0, r1 * a1, a1, hint, 0);
      }
    }
  }
}

function scanFitArcFamily(A, alpha, B, beta, hint, candidates) {
  const d0s = [];
  const addD0 = (v) => {
    if (d0s.some((x) => Math.abs(x - v) < 1e-4)) return;
    d0s.push(v);
  };
  if (hint) {
    for (let i = -16; i <= 16; i++) addD0(hint[1] + i * 0.1);
  }
  for (let i = -18; i <= 18; i++) {
    if (i === 0) continue;
    addD0((i * Math.PI) / 9);
  }

  for (const d0 of d0s) {
    const sol = solveL0ForTurn(A, alpha, B, beta, d0, hint);
    if (Math.abs(sol.err) > 0.015) continue;
    consider(candidates, sol.L0, d0, sol.L1, sol.d1, hint, Math.abs(sol.err) * 8);
  }
}

/**
 * Fit two arcs from pose (A, α) onto pose (B, β).
 * `hint` is optional [L0, d0, L1, d1] in radians — prefer nearby last-two segs.
 */
export function fitBiarc(A, alpha, B, beta, hint) {
  const Omega = wrapPi(beta - alpha);
  const totals = [];
  const addTotal = (t) => {
    if (!totals.some((x) => Math.abs(x - t) < 1e-9)) totals.push(t);
  };
  if (hint) {
    const hintTurn = hint[1] + hint[3];
    const kHint = Math.round((hintTurn - Omega) / (2 * Math.PI));
    addTotal(Omega + 2 * Math.PI * kHint);
  }
  for (const k of [0, 1, -1, 2, -2]) addTotal(Omega + 2 * Math.PI * k);

  const candidates = [];
  const push = (d0, total) => {
    const d1 = total - d0;
    const lens = lengthsForTurns(A, alpha, B, d0, d1);
    if (!lens) return;
    consider(candidates, lens[0], d0, lens[1], d1, hint, 0.15 * Math.abs(total));
  };

  for (const total of totals) {
    if (hint) {
      const center = hint[1];
      for (let i = -48; i <= 48; i++) push(center + i * 0.04, total);
      for (let k = -2; k <= 2; k++) push(center + k * Math.PI, total);
    } else {
      for (let i = -60; i <= 60; i++) {
        if (i === 0) continue;
        push(i * 0.05, total);
      }
      push(total / 2, total);
    }
  }

  scanRadiusFamily(A, alpha, B, beta, hint, candidates);
  scanFitArcFamily(A, alpha, B, beta, hint, candidates);

  const verified = [];
  for (const c of candidates) {
    const [L0, d0, L1, d1] = c.segs;
    const mid = stepArc(A, alpha, L0, d0);
    const end = stepArc(mid.point, mid.heading, L1, d1);
    const g = Math.hypot(end.point[0] - B[0], end.point[1] - B[1]);
    const h = Math.abs(wrapPi(end.heading - beta));
    if (g > G0_GAP || h > G1_HEADING_RAD) continue;
    verified.push({ ...c, score: c.score + g * 20 + h * 40 });
  }
  if (!verified.length) return null;
  verified.sort((a, b) => a.score - b.score);
  const best = verified[0].segs;
  return {
    segsRad: best,
    segsDeg: [
      [roundN(best[0], 5), roundN(best[1] / DEG, 4)],
      [roundN(best[2], 5), roundN(best[3] / DEG, 4)],
    ],
  };
}

export function closeG0(outline) {
  const segs = (outline.turtlePath || []).map((s) => [Number(s[0]), Number(s[1])]);
  if (!segs.length) return cloneOutline(outline);
  const start = poseBefore(outline, 0);
  const pre = poseBefore(outline, segs.length - 1);
  const fitted = fitArc(pre.point, pre.heading, start.point);
  segs[segs.length - 1] = [roundN(fitted.len, 5), roundN(fitted.ang, 4)];
  return { ...cloneOutline(outline), turtlePath: segs };
}

/**
 * G1 close by rewriting the last two arcs.
 * One segment: append two closing arcs when a biarc exists; otherwise leave as-is.
 * `mode: "append"` always adds two arcs instead of rewriting.
 */
export function closeG1(outline, { mode = "adjust" } = {}) {
  const src = cloneOutline(outline);
  const info = closureInfo(src);
  if (info.g1) return src;

  let segs = src.turtlePath.map((s) => [Number(s[0]), Number(s[1])]);
  const target = poseBefore(src, 0);

  if (mode === "append" || segs.length < 2) {
    if (!segs.length) return src;
    const end = poseBefore(src, segs.length);
    const fitted = fitBiarc(end.point, end.heading, target.point, target.heading, null);
    if (!fitted) return src;
    return { ...src, turtlePath: segs.concat(fitted.segsDeg) };
  }

  const pre = poseBefore(src, segs.length - 2);
  const a = segs[segs.length - 2];
  const b = segs[segs.length - 1];
  const hint = [a[0], a[1] * DEG, b[0], b[1] * DEG];
  const fitted = fitBiarc(pre.point, pre.heading, target.point, target.heading, hint);
  if (!fitted) return src;
  segs[segs.length - 2] = fitted.segsDeg[0];
  segs[segs.length - 1] = fitted.segsDeg[1];
  return { ...src, turtlePath: segs };
}

/** Default product close: G1 when possible, else G0. */
export function closePath(outline, opts = {}) {
  const n = (outline.turtlePath || []).length;
  if (n <= 0) return cloneOutline(outline);
  if (opts.smooth === false || opts.g1 === false) return closeG0(outline);
  return closeG1(outline, opts);
}

function cloneOutline(o = {}) {
  return {
    name: o.name || "Custom",
    startPoint: (o.startPoint || [0, 0]).slice(),
    startAngle: o.startAngle ?? 0,
    turtlePath: (o.turtlePath || []).map((s) => [Number(s[0]), Number(s[1])]),
  };
}

function roundN(v, n) {
  const f = 10 ** n;
  return Math.round(v * f) / f;
}
