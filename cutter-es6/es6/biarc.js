/**
 * G1 biarc. Symbols (stripped by IIFE minify):
 * θ heading, Δθ turn, s length, p family, Pm junction, T tangent (complex).
 */

import { DEG } from "./path-utils.js";
import { poseBefore, stepArc, wrapPi } from "./close-path.js";

const τ = Math.PI * 2;
const inf = Infinity;

const C = (x, y = 0) => ({ x, y });
const add = (a, b) => C(a.x + b.x, a.y + b.y);
const sub = (a, b) => C(a.x - b.x, a.y - b.y);
const mul = (a, b) => C(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
const div = (a, b) => {
  const d = b.x * b.x + b.y * b.y;
  return C((a.x * b.x + a.y * b.y) / d, (a.y * b.x - a.x * b.y) / d);
};
const conj = (a) => C(a.x, -a.y);
const abs = (a) => Math.hypot(a.x, a.y);
const arg = (a) => Math.atan2(a.y, a.x);
const fromPolar = (r, θ) => C(r * Math.cos(θ), r * Math.sin(θ));
const unit = (a) => {
  const r = abs(a);
  return r < 1e-16 ? C(1, 0) : C(a.x / r, a.y / r);
};
const isInf = (a) => !Number.isFinite(a.x) || !Number.isFinite(a.y);

function mt(z, a, b, c, d) {
  const den = add(mul(c, z), d);
  if (abs(den) < 1e-16) return C(inf, inf);
  return div(add(mul(a, z), b), den);
}
function mti(z, a, b, c, d) {
  return mt(z, C(-d.x, -d.y), b, c, C(-a.x, -a.y));
}
function dmt(z, a, b, c, d) {
  const den = add(mul(c, z), d);
  const det = sub(mul(a, d), mul(b, c));
  if (abs(den) < 1e-16) return C(inf, inf);
  return div(det, mul(den, den));
}
function dmti(z, a, b, c, d) {
  return dmt(z, C(-d.x, -d.y), b, c, C(-a.x, -a.y));
}
function mm(A, B) {
  const [a, b, c, d] = A;
  const [e, f, g, h] = B;
  return [add(mul(a, e), mul(b, g)), add(mul(a, f), mul(b, h)), add(mul(c, e), mul(d, g)), add(mul(c, f), mul(d, h))];
}

export function arcFromChord(P0, T0, P1) {
  const ch = sub(P1, P0);
  const Lch = abs(ch);
  if (Lch < 1e-12) return { s: 0, Δθ: 0 };
  const ph = unit(div(ch, T0));
  const α = arg(ph);
  if (Math.PI - Math.abs(α) < 1e-6) return { s: -Lch, Δθ: 0 };
  const s = Math.abs(ph.y) < 1e-16 ? Lch : Lch * (α / ph.y);
  return { s, Δθ: 2 * α };
}

function sqrtC(z, branch = 0) {
  const r = abs(z);
  const θ = arg(z) / 2 + branch * Math.PI;
  return fromPolar(Math.sqrt(r), θ);
}

function scorePair(a0, a1, hint) {
  if (hint) {
    const d0 = hint.d0 ?? 0;
    const d1 = hint.d1 ?? 0;
    const s0 = hint.s0 ?? 0;
    const s1 = hint.s1 ?? 0;
    return (a0.Δθ - d0) ** 2 + (a1.Δθ - d1) ** 2 + 0.04 * ((a0.s - s0) ** 2 + (a1.s - s1) ** 2);
  }
  return Math.abs(a0.Δθ) + Math.abs(a1.Δθ) + 0.02 * (Math.abs(a0.s) + Math.abs(a1.s));
}

function computeBiarcBranch(P0, T0, P1, T1, { p = null, P = null } = {}, branch = 0) {
  const m = [C(2), C(-(P0.x + P1.x), -(P0.y + P1.y)), C(0), sub(P1, P0)];
  const phl = unit(sqrtC(mul(T1, conj(T0)), branch));
  const ml = [add(phl, C(1)), sub(phl, C(1)), sub(phl, C(1)), add(phl, C(1))];
  const mn = mm(ml, m);
  const [a, b, c, d] = mn;
  const phj = mul(T0, dmt(P0, a, b, c, d));

  let p̂ = p == null ? 1 : p;
  if (P) {
    const pn = mt(P, a, b, c, d);
    if (pn.y > 0) {
      const w = div(add(pn, C(1)), add(C(-pn.x, -pn.y), C(1)));
      p̂ = w.x + (Math.abs(phj.y) < 1e-14 ? 0 : (w.y / phj.y) * phj.x);
    } else {
      const w = div(sub(pn, C(1)), add(pn, C(1)));
      const u = w.x + (Math.abs(phj.y) < 1e-14 ? 0 : (w.y / phj.y) * phj.x);
      p̂ = Math.abs(u) < 1e-14 ? inf : -1 / u;
    }
  }
  if (!Number.isFinite(p̂)) p̂ = 1e6;
  if (Math.abs(p̂) < 1e-4) p̂ = p̂ < 0 ? -1e-4 : 1e-4;
  if (Math.abs(p̂ + 1) < 1e-4) p̂ = p̂ < -1 ? -1.0001 : -0.9999;
  const xj = C((p̂ - 1) / (p̂ + 1));
  const Pm = mti(xj, a, b, c, d);
  let Tm = mul(conj(phj), dmti(xj, a, b, c, d));
  Tm = unit(Tm);
  let Tl = dmti(xj, a, b, c, d);
  Tl = unit(Tl);
  const Popp = abs(xj) < 1e-16 ? C(inf, inf) : mti(C(-1 / xj.x, 0), a, b, c, d);
  return { Pm, Tm, Tl, Popp, p: p̂, branch };
}

/**
 * One-parameter G1 family from (P0,T0) to (P1,T1).
 * sqrt(T1 conj(T0)) has two branches — one is the short pair, the other
 * the long-way-around pair. Both are tried; `hint` (previous s, Δθ)
 * picks continuity, otherwise the shorter total turn wins.
 */
export function computeBiarc(P0, T0, P1, T1, opts = {}) {
  const { hint = null } = opts;
  let best = null;
  let bestScore = Infinity;
  for (const br of [0, 1]) {
    let cand;
    try {
      cand = computeBiarcBranch(P0, T0, P1, T1, opts, br);
    } catch (_) {
      continue;
    }
    if (!cand || isInf(cand.Pm) || abs(cand.Tm) < 1e-12) continue;
    const a0 = arcFromChord(P0, T0, cand.Pm);
    const a1 = arcFromChord(cand.Pm, cand.Tm, P1);
    if (![a0.s, a0.Δθ, a1.s, a1.Δθ].every(Number.isFinite)) continue;
    const score = scorePair(a0, a1, hint);
    if (score < bestScore) {
      best = { ...cand, a0, a1 };
      bestScore = score;
    }
  }
  return best || computeBiarcBranch(P0, T0, P1, T1, opts, 0);
}

export function xy(p) {
  return C(p[0], p[1]);
}
export function arr(z) {
  return [z.x, z.y];
}
export function Tθ(θ) {
  return fromPolar(1, θ);
}

export function pairIdx(j, n) {
  if (n < 2) return null;
  if (j === 0 || j === n) return [n - 1, 0];
  return [j - 1, j];
}

export function quadIdx(j, n) {
  if (n < 4) return null;
  const i = j === n ? 0 : ((j % n) + n) % n;
  const m = (k) => ((k % n) + n) % n;
  return [m(i - 2), m(i - 1), i, m(i + 1)];
}

function poseToCT(pose) {
  return { P: xy(pose.point), T: Tθ(pose.heading), θ: pose.heading };
}

function writePair(src, i0, i1, a0, a1) {
  const segs = src.turtlePath.map((s) => [s[0], s[1]]);
  segs[i0] = [round5(a0.s), round4(a0.Δθ / DEG)];
  segs[i1] = [round5(a1.s), round4(a1.Δθ / DEG)];
  const out = { ...src, turtlePath: segs };
  if (i1 === 0) {
    const pre = poseBefore(src, i0);
    const end = stepArc(pre.point, pre.heading, a0.s, a0.Δθ);
    out.startPoint = end.point.slice();
    out.startAngle = wrapPi(end.heading) / DEG;
  }
  return out;
}

/** Replace two arcs around joint j with a biarc. */
export function applyBiarc(outline, j, opts = {}) {
  const n = (outline.turtlePath || []).length;
  const idx = pairIdx(j, n);
  if (!idx) return outline;
  const [i0, i1] = idx;
  const A = poseToCT(poseBefore(outline, i0));
  const B = poseToCT(poseBefore(outline, i1 + 1));
  const segs = outline.turtlePath;
  const hint = {
    s0: Number(segs[i0][0]),
    d0: Number(segs[i0][1]) * DEG,
    s1: Number(segs[i1][0]),
    d1: Number(segs[i1][1]) * DEG,
  };
  const { Pm, Tm, p } = computeBiarc(A.P, A.T, B.P, B.T, { ...opts, hint });
  if (isInf(Pm) || abs(Tm) < 1e-12) return outline;
  const a0 = arcFromChord(A.P, A.T, Pm);
  const a1 = arcFromChord(Pm, Tm, B.P);
  const next = writePair(outline, i0, i1, a0, a1);
  next._biarc = { p, Pm: arr(Pm), Tm: arr(Tm), j, i0, i1 };
  return next;
}

/** Dual biarc around joint j. Keeps each pair's p. */
export function applyVertex(outline, j, P, θ, pL, pR) {
  const n = (outline.turtlePath || []).length;
  const q = quadIdx(j, n);
  if (!q) return outline;
  const [a, b, c, d] = q;
  const T = Tθ(θ);
  const Pm = xy(P);
  const A = poseToCT(poseBefore(outline, a));
  const endI = d + 1 > n ? n : d + 1;
  const B = poseToCT(poseBefore(outline, endI));
  const segs = outline.turtlePath;
  const hintL = {
    s0: Number(segs[a][0]),
    d0: Number(segs[a][1]) * DEG,
    s1: Number(segs[b][0]),
    d1: Number(segs[b][1]) * DEG,
  };
  const hintR = {
    s0: Number(segs[c][0]),
    d0: Number(segs[c][1]) * DEG,
    s1: Number(segs[d][0]),
    d1: Number(segs[d][1]) * DEG,
  };
  const left = computeBiarc(A.P, A.T, Pm, T, { p: pL ?? 1, hint: hintL });
  const right = computeBiarc(Pm, T, B.P, B.T, { p: pR ?? 1, hint: hintR });
  if (isInf(left.Pm) || isInf(right.Pm) || abs(left.Tm) < 1e-12 || abs(right.Tm) < 1e-12) {
    return outline;
  }
  const a0 = arcFromChord(A.P, A.T, left.Pm);
  const a1 = arcFromChord(left.Pm, left.Tm, Pm);
  const b0 = arcFromChord(Pm, T, right.Pm);
  const b1 = arcFromChord(right.Pm, right.Tm, B.P);
  let out = writePair(outline, a, b, a0, a1);
  out = writePair(out, c, d, b0, b1);
  // Only the seam pose is (P, θ). Arc 0 sitting in the quad is not the seam.
  if (j === 0 || j === n) {
    out.startPoint = P.slice();
    out.startAngle = θ / DEG;
  }
  out._biarc = { pL: left.p, pR: right.p, P, θ, j };
  return out;
}

export function spanLength(outline, idx) {
  const segs = outline.turtlePath || [];
  let s = 0;
  for (const i of idx || []) {
    if (segs[i]) s += Math.abs(Number(segs[i][0]));
  }
  return s;
}

/** p≈0 and p≈−1 are poles; same-circle recoveries often land there. */
export function saneP(p) {
  if (!Number.isFinite(p) || Math.abs(p) > 1e5) return 1;
  if (Math.abs(p) < 2e-3 || Math.abs(p + 1) < 2e-3) return 1;
  return p;
}

/** True when a rewrite collapsed, exploded, or flipped to the long way around. */
export function spanCollapsed(before, after, idx) {
  if (!after?.turtlePath) return true;
  const segs = after.turtlePath;
  const prev = before?.turtlePath || [];
  for (const i of idx || []) {
    const row = segs[i];
    if (!row || !Number.isFinite(row[0]) || !Number.isFinite(row[1])) return true;
    const d1 = Number(row[1]) * DEG;
    const d0 = prev[i] ? Number(prev[i][1]) * DEG : 0;
    if (Math.abs(d1) > Math.PI * 1.4 && Math.abs(d0) < Math.PI * 0.85) return true;
  }
  const L0 = spanLength(before, idx);
  const L1 = spanLength(after, idx);
  if (L0 > 1e-4 && L1 < L0 * 0.08) return true;
  if (L1 > Math.max(L0, 1) * 3.5) return true;
  return false;
}

/**
 * Keep-p first; if that branch swaps or collapses, try p=1 on each side
 * and keep the candidate whose joint stays nearest the requested P.
 */
export function applyVertexStable(outline, j, P, θ, pL, pR) {
  const n = (outline.turtlePath || []).length;
  const q = quadIdx(j, n);
  if (!q) return outline;
  const aKeep = saneP(pL ?? 1);
  const bKeep = saneP(pR ?? 1);
  const tries = [
    [aKeep, bKeep],
    [1, bKeep],
    [aKeep, 1],
    [1, 1],
  ];
  let best = outline;
  let bestD = Infinity;
  for (const [a, b] of tries) {
    const next = applyVertex(outline, j, P, θ, a, b);
    if (next === outline || spanCollapsed(outline, next, q)) continue;
    const jp = jointPose(next, j === n ? 0 : j);
    const dP = Math.hypot(jp.point[0] - P[0], jp.point[1] - P[1]);
    const L0 = Math.max(spanLength(outline, q), 1e-6);
    const L1 = spanLength(next, q);
    const d = dP + 0.25 * Math.abs(L1 - L0);
    if (d < bestD) {
      best = next;
      bestD = d;
    }
  }
  return best;
}

export function cloneOutline(o = {}) {
  return {
    name: o.name || "Custom",
    startPoint: (o.startPoint || [0, 0]).slice(),
    startAngle: o.startAngle ?? 0,
    turtlePath: (o.turtlePath || []).map((s) => [Number(s[0]), Number(s[1])]),
  };
}

/** Lift 2 or 4 parent arcs into a linear snippet (wrap becomes in-order). */
export function extractSpan(outline, indices) {
  const n = (outline.turtlePath || []).length;
  if (!indices?.length || !n) return null;
  const start = poseBefore(outline, indices[0]);
  const last = indices[indices.length - 1];
  const end = poseBefore(outline, last + 1 > n ? n : last + 1);
  return {
    name: "span",
    startPoint: start.point.slice(),
    startAngle: start.heading / DEG,
    turtlePath: indices.map((i) => {
      const s = outline.turtlePath[i];
      return [Number(s[0]), Number(s[1])];
    }),
    indices: indices.slice(),
    endPoint: end.point.slice(),
    endAngle: end.heading / DEG,
  };
}

/** Write snippet arcs back. Parent start updates only if segment 0 is in the span. */
export function commitSpan(parent, snippet) {
  if (!snippet?.indices) return parent;
  const out = cloneOutline(parent);
  snippet.indices.forEach((pi, k) => {
    const row = snippet.turtlePath[k];
    if (row) out.turtlePath[pi] = [Number(row[0]), Number(row[1])];
  });
  const slot0 = snippet.indices.indexOf(0);
  if (slot0 === 0) {
    out.startPoint = snippet.startPoint.slice();
    out.startAngle = snippet.startAngle;
  } else if (slot0 > 0) {
    const pre = {
      startPoint: snippet.startPoint.slice(),
      startAngle: snippet.startAngle,
      turtlePath: snippet.turtlePath.slice(0, slot0),
    };
    const pose = poseBefore(pre, slot0);
    out.startPoint = pose.point.slice();
    out.startAngle = wrapPi(pose.heading) / DEG;
  }
  if (snippet._biarc) out._biarc = snippet._biarc;
  return out;
}

export function jointPose(outline, j) {
  const n = (outline.turtlePath || []).length;
  if (j <= 0 || j >= n) return poseBefore(outline, 0);
  return poseBefore(outline, j);
}

export function recoverP(outline, j) {
  const n = (outline.turtlePath || []).length;
  const idx = pairIdx(j, n);
  if (!idx) return 1;
  const [i0, i1] = idx;
  const A = poseToCT(poseBefore(outline, i0));
  const B = poseToCT(poseBefore(outline, i1 + 1));
  const Pm = xy(jointPose(outline, j === n ? 0 : j).point);
  const segs = outline.turtlePath;
  const hint = {
    s0: Number(segs[i0][0]),
    d0: Number(segs[i0][1]) * DEG,
    s1: Number(segs[i1][0]),
    d1: Number(segs[i1][1]) * DEG,
  };
  const { p } = computeBiarc(A.P, A.T, B.P, B.T, { P: Pm, hint });
  return p;
}

export function pairPoses(outline, j) {
  const n = (outline.turtlePath || []).length;
  const idx = pairIdx(j, n);
  if (!idx) return null;
  const [i0, i1] = idx;
  return {
    i0,
    i1,
    A: poseToCT(poseBefore(outline, i0)),
    B: poseToCT(poseBefore(outline, i1 + 1)),
    J: poseToCT(jointPose(outline, j === n ? 0 : j)),
  };
}

export function locusCircle(outline, j) {
  const pr = pairPoses(outline, j);
  if (!pr) return null;
  const { Pm, Tl, Popp } = computeBiarc(pr.A.P, pr.A.T, pr.B.P, pr.B.T, { p: 1 });
  if (isInf(Popp)) return { c: null, r: inf, Pm, Popp, Tl, ...pr };
  const nrm = C(-Tl.y, Tl.x);
  const v = sub(Pm, Popp);
  const vn = v.x * nrm.x + v.y * nrm.y;
  if (Math.abs(vn) < 1e-12) return { c: null, r: inf, Pm, Popp, Tl, ...pr };
  const ρ = -(v.x * v.x + v.y * v.y) / (2 * vn);
  return { c: add(Pm, C(nrm.x * ρ, nrm.y * ρ)), r: Math.abs(ρ), Pm, Popp, Tl, ...pr };
}

export function projectToCircle(c, r, P) {
  const v = sub(P, c);
  const L = abs(v);
  if (L < 1e-12) return add(c, C(r, 0));
  return add(c, C((v.x / L) * r, (v.y / L) * r));
}

export function splitSeg(outline, i) {
  const segs = (outline.turtlePath || []).map((s) => [Number(s[0]), Number(s[1])]);
  if (i < 0 || i >= segs.length) return outline;
  const [s, Δ] = segs[i];
  segs.splice(i, 1, [s / 2, Δ / 2], [s / 2, Δ / 2]);
  return { ...outline, turtlePath: segs };
}

function round5(v) {
  return Math.round(v * 1e5) / 1e5;
}
function round4(v) {
  return Math.round(v * 1e4) / 1e4;
}
