/**
 * Exact-arc path closure.
 *
 * Modes (see closePath):
 *   ends      — rewrite FIRST and LAST arcs; middle (s, Δθ) stays put (default)
 *   last-two  — rewrite the last two adjacent arcs as a biarc
 *   append    — keep every existing arc; add a two-arc cap
 *   spread    — snapTurtle: share heading error then stretch many segments
 *   corner    — G0 only: last arc onto the start point (possible kink)
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

/** Net displacement + turn of a relative turtle chain started at the origin. */
export function chainNet(segsDeg) {
  let p = [0, 0];
  let h = 0;
  for (const [len, angDeg] of segsDeg) {
    const next = stepArc(p, h, Number(len), Number(angDeg) * DEG);
    p = next.point;
    h = next.heading;
  }
  return { disp: p, turn: h };
}

/**
 * Solve first/last lengths so
 *   s0 u0 + R(θ0+d0) D_M + sL uL = 0
 * with heading lock dL + d0 + Ω_M ≡ 0 (mod 2π).
 */
export function lengthsForEndArcs(theta0, net, d0, dL) {
  const th1 = theta0 + d0;
  const th2 = th1 + net.turn;
  const u0s = sinc(d0 / 2);
  const uLs = sinc(dL / 2);
  const a0 = theta0 + d0 / 2;
  const aL = th2 + dL / 2;
  const u0x = u0s * Math.cos(a0);
  const u0y = u0s * Math.sin(a0);
  const uLx = uLs * Math.cos(aL);
  const uLy = uLs * Math.sin(aL);
  const det = u0x * uLy - u0y * uLx;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-14) return null;
  const mx = net.disp[0] * Math.cos(th1) - net.disp[1] * Math.sin(th1);
  const my = net.disp[0] * Math.sin(th1) + net.disp[1] * Math.cos(th1);
  const rx = -mx;
  const ry = -my;
  const s0 = (rx * uLy - ry * uLx) / det;
  const sL = (u0x * ry - u0y * rx) / det;
  if (!Number.isFinite(s0) || !Number.isFinite(sL)) return null;
  return [s0, sL];
}

export function fitEndArcs(theta0, net, hint) {
  const Omega = wrapPi(-(net.turn));
  const totals = [];
  const addTotal = (t) => {
    if (!totals.some((x) => Math.abs(x - t) < 1e-9)) totals.push(t);
  };
  if (hint) {
    const hintTurn = hint[1] + hint[3];
    addTotal(hintTurn);
    const kHint = Math.round((hintTurn - Omega) / (2 * Math.PI));
    addTotal(Omega + 2 * Math.PI * kHint);
  }
  for (const k of [0, 1, -1, 2, -2]) addTotal(Omega + 2 * Math.PI * k);

  const candidates = [];
  const push = (d0, total) => {
    const dL = total - d0;
    const lens = lengthsForEndArcs(theta0, net, d0, dL);
    if (!lens) return;
    consider(candidates, lens[0], d0, lens[1], dL, hint, 0.12 * Math.abs(total));
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

  const verified = [];
  for (const c of candidates) {
    const [s0, d0, sL, dL] = c.segs;
    const first = stepArc([0, 0], theta0, s0, d0);
    const midX = net.disp[0] * Math.cos(first.heading) - net.disp[1] * Math.sin(first.heading);
    const midY = net.disp[0] * Math.sin(first.heading) + net.disp[1] * Math.cos(first.heading);
    const p2 = [first.point[0] + midX, first.point[1] + midY];
    const th2 = first.heading + net.turn;
    const end = stepArc(p2, th2, sL, dL);
    const g = Math.hypot(end.point[0], end.point[1]);
    const h = Math.abs(wrapPi(end.heading - theta0));
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

/** G1 by rewriting first and last arcs. Middle segments keep their (s, Δθ). */
export function closeEnds(outline) {
  const src = cloneOutline(outline);
  if (closureInfo(src).g1) return src;
  const segs = src.turtlePath.map((s) => [Number(s[0]), Number(s[1])]);
  if (segs.length < 2) return closeG1(src, { mode: "append" });

  const start = poseBefore(src, 0);
  const net = chainNet(segs.slice(1, -1));
  const a = segs[0];
  const b = segs[segs.length - 1];
  const hint = [a[0], a[1] * DEG, b[0], b[1] * DEG];
  const fitted = fitEndArcs(start.heading, net, hint);
  if (!fitted) return src;
  segs[0] = fitted.segsDeg[0];
  segs[segs.length - 1] = fitted.segsDeg[1];
  return { ...src, turtlePath: segs };
}

/**
 * G1 close by rewriting the last two adjacent arcs.
 * `mode: "append"` keeps existing segments and adds two new closing arcs.
 */
export function closeG1(outline, { mode = "adjust" } = {}) {
  const src = cloneOutline(outline);
  const info = closureInfo(src);
  if (info.g1) return src;

  const segs = src.turtlePath.map((s) => [Number(s[0]), Number(s[1])]);
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

function solveIll(AT_A, ATb, lam) {
  const n = ATb.length;
  const M = AT_A.map((row, i) => row.map((v, j) => v + (i === j ? lam : 0)));
  const x = ATb.slice();
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
    if (Math.abs(M[piv][k]) < 1e-14) return null;
    if (piv !== k) {
      [M[k], M[piv]] = [M[piv], M[k]];
      [x[k], x[piv]] = [x[piv], x[k]];
    }
    const diag = M[k][k];
    for (let j = k; j < n; j++) M[k][j] /= diag;
    x[k] /= diag;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k];
      for (let j = k; j < n; j++) M[i][j] -= f * M[k][j];
      x[i] -= f * x[k];
    }
  }
  return x;
}

/**
 * snapTurtle: distribute heading error over bendable arcs, then stretch
 * stretchable segments so the end pose meets the start pose.
 */
export function closeSpread(outline, { keepTotalLength = true } = {}) {
  const src = cloneOutline(outline);
  if (closureInfo(src).g1) return src;
  const segs = src.turtlePath.map((s) => [Number(s[0]), Number(s[1]) * DEG]);
  if (segs.length < 2) return src;

  const start = poseBefore(src, 0);
  const bendable = [];
  const stretchable = [];
  for (let i = 0; i < segs.length; i++) {
    if (Math.abs(segs[i][1]) > 1e-12) bendable.push(i);
    if (Math.abs(segs[i][0]) > 1e-12) stretchable.push(i);
  }
  if (!bendable.length || stretchable.length < 2) return src;

  const angSum = segs.reduce((s, seg) => s + seg[1], 0);
  const mismatch = wrapPi(angSum - start.heading + start.heading);
  // end heading should equal start heading: wrap(angSum) == 0 relative to start
  // walking from start.heading, end heading = start.heading + angSum
  const headErr = wrapPi(angSum);
  const share = headErr / bendable.length;
  for (const i of bendable) segs[i][1] -= share;

  const n = segs.length;
  const headings = new Array(n + 1);
  headings[0] = start.heading;
  for (let i = 0; i < n; i++) headings[i + 1] = headings[i] + segs[i][1];

  const vi = segs.map((seg, i) => {
    const chord = seg[0] * sinc(seg[1] / 2);
    const h = headings[i] + seg[1] / 2;
    return [chord * Math.cos(h), chord * Math.sin(h)];
  });
  let px = 0;
  let py = 0;
  for (const v of vi) {
    px += v[0];
    py += v[1];
  }
  const bx = px - 0;
  const by = py - 0;
  // target relative to start at origin of this relative walk:
  // we walked from heading start.heading at (0,0); want to return to (0,0)
  // Actual start is start.point; end should be start.point, so relative end should be 0.

  const m = stretchable.length;
  const cols = keepTotalLength ? m : m;
  const rows = keepTotalLength ? 3 : 2;
  const A = Array.from({ length: rows }, () => Array(m).fill(0));
  const b = keepTotalLength ? [bx, by, 0] : [bx, by];
  let origLen = 0;
  stretchable.forEach((si, j) => {
    A[0][j] = vi[si][0];
    A[1][j] = vi[si][1];
    origLen += segs[si][0];
    if (keepTotalLength) A[2][j] = segs[si][0];
  });

  const ATA = Array.from({ length: m }, () => Array(m).fill(0));
  const ATb = Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let r = 0; r < rows; r++) s += A[r][i] * A[r][j];
      ATA[i][j] = s;
    }
    let t = 0;
    for (let r = 0; r < rows; r++) t += A[r][i] * b[r];
    ATb[i] = t;
  }
  const a = solveIll(ATA, ATb, 1e-6);
  if (!a) return src;
  stretchable.forEach((si, j) => {
    segs[si][0] *= 1 - a[j];
  });

  return {
    ...src,
    turtlePath: segs.map(([len, ang]) => [roundN(len, 5), roundN(ang / DEG, 4)]),
  };
}

export const CLOSE_MODES = ["ends", "last-two", "append", "spread", "corner"];

/** Default product close: first+last G1. */
export function closePath(outline, opts = {}) {
  const n = (outline.turtlePath || []).length;
  if (n <= 0) return cloneOutline(outline);
  const mode = opts.mode || "ends";
  if (opts.smooth === false || opts.g1 === false || mode === "corner") return closeG0(outline);
  if (mode === "append") return closeG1(outline, { mode: "append" });
  if (mode === "last-two" || mode === "adjust" || mode === "tail") return closeG1(outline, { mode: "adjust" });
  if (mode === "spread" || mode === "snap") return closeSpread(outline, opts);
  return closeEnds(outline);
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
