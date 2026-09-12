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

/**
 * One-parameter G1 family from (P0,T0) to (P1,T1).
 * Pass p, or a world point P that the curve should go through.
 */
export function computeBiarc(P0, T0, P1, T1, { p = null, P = null } = {}) {
  const m = [C(2), C(-(P0.x + P1.x), -(P0.y + P1.y)), C(0), sub(P1, P0)];
  let phl = unit(sqrtC(mul(T1, conj(T0))));
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
  const xj = C((p̂ - 1) / (p̂ + 1));
  const Pm = mti(xj, a, b, c, d);
  let Tm = mul(conj(phj), dmti(xj, a, b, c, d));
  Tm = unit(Tm);
  let Tl = dmti(xj, a, b, c, d);
  Tl = unit(Tl);
  const Popp = abs(xj) < 1e-16 ? C(inf, inf) : mti(C(-1 / xj.x, 0), a, b, c, d);
  return { Pm, Tm, Tl, Popp, p: p̂ };
}

function sqrtC(z) {
  const r = abs(z);
  const θ = arg(z) / 2;
  return fromPolar(Math.sqrt(r), θ);
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
  const { Pm, Tm, p } = computeBiarc(A.P, A.T, B.P, B.T, opts);
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
  const B = poseToCT(poseBefore(outline, d + 1));
  const left = computeBiarc(A.P, A.T, Pm, T, { p: pL ?? 1 });
  const right = computeBiarc(Pm, T, B.P, B.T, { p: pR ?? 1 });
  const a0 = arcFromChord(A.P, A.T, left.Pm);
  const a1 = arcFromChord(left.Pm, left.Tm, Pm);
  const b0 = arcFromChord(Pm, T, right.Pm);
  const b1 = arcFromChord(right.Pm, right.Tm, B.P);
  let out = writePair(outline, a, b, a0, a1);
  out = writePair(out, c, d, b0, b1);
  if (a === 0 || b === 0 || c === 0) {
    out.startPoint = P.slice();
    out.startAngle = θ / DEG;
  }
  out._biarc = { pL: left.p, pR: right.p, P, θ, j };
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
  const { p } = computeBiarc(A.P, A.T, B.P, B.T, { P: Pm });
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
