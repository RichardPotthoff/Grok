
/**
 * Lazy turtle blocks.
 *
 * The stored model is the tree. `arcs(ctx)` is a restartable generator of
 * leaf [s, Δθ, extra]. Reverse, mirror, scale, and offset are walk flags,
 * not baked copies. `flatten` drains the generator; it is not the model.
 *
 * `interface`, `length`, and `area` are lazy and keyed by the walk context.
 * Shortcuts stay on the node: a repeat does not expand to count its length.
 *
 * World start pose lives on a page use, not on a shared definition.
 */

import { repeatRotate } from "./path-xform.js";

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export function sinc(x) {
  return Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x;
}

export const IFACE0 = { dx: 0, dy: 0, dtheta: 0 };

let nextId = 1;
function uid(prefix = "b") {
  return `${prefix}_${nextId++}`;
}

/** Read a pose as [x, y, θ]. Accepts an array, a typed array, or {dx,dy,dtheta}. */
export function pose3(p) {
  if (p == null) return [0, 0, 0];
  if (typeof p.length === "number" && p.length >= 3 && typeof p[0] === "number") {
    return [p[0], p[1], p[2]];
  }
  return [p.dx ?? p.x ?? 0, p.dy ?? p.y ?? 0, p.dtheta ?? p.heading ?? p.h ?? 0];
}

/**
 * Pose step of one arc starting at the origin, heading 0.
 * Δθ is radians.
 */
export function arcIface(s, dtheta) {
  const ang = Number(dtheta) || 0;
  const half = ang / 2;
  const chord = Number(s) * sinc(half);
  return {
    dx: chord * Math.cos(half),
    dy: chord * Math.sin(half),
    dtheta: ang,
  };
}

/** Compose A then B, both in A's incoming frame. */
export function composeIface(A, B) {
  const a = pose3(A);
  const b = pose3(B);
  const c = Math.cos(a[2]);
  const s = Math.sin(a[2]);
  return {
    dx: a[0] + c * b[0] - s * b[1],
    dy: a[1] + s * b[0] + c * b[1],
    dtheta: a[2] + b[2],
  };
}

/**
 * Walk flags. Reverse reorders. Mirror negates Δθ and the offset side.
 * Scale multiplies lengths. Offset is to the right of the walked heading,
 * applied at the leaf after scale: s' = s − d·θ for a curved arc, and a
 * hinge becomes the corner fillet of radius d.
 * @param {object} [ctx]
 * @param {object} [out] optional reused flags object
 */
export function walkCtx(ctx = {}, out) {
  const scale = Number(ctx.scale);
  const offset = Number(ctx.offset);
  const o = out || {};
  o.reverse = !!ctx.reverse;
  o.mirror = !!ctx.mirror;
  o.scale = Number.isFinite(scale) ? scale : 1;
  o.offset = Number.isFinite(offset) ? offset : 0;
  o.k = ctx.k ?? 0;
  o.paint = ctx.paint || null;
  return o;
}

export function ctxKey(ctx) {
  const c = walkCtx(ctx);
  return `${c.reverse ? 1 : 0}${c.mirror ? 1 : 0}:${c.scale}:${c.offset}`;
}

/** Leaf row after the walk flags. A hinge (s = 0, Δθ ≠ 0) is kept.
 *  Writes into `out` when given, so the hot path allocates nothing.
 */
export function emitArc(s, dtheta, ctx, out) {
  const c = walkCtx(ctx, out && out._ctx);
  const ss = (Number(s) || 0) * c.scale;
  let da = c.mirror ? -(Number(dtheta) || 0) : Number(dtheta) || 0;
  const d = c.mirror ? -c.offset : c.offset;
  const th = da;
  let sOff = ss;
  if (Math.abs(th) >= 1e-12) sOff = ss - d * th;
  if (out) {
    out.s = sOff;
    out.dtheta = da;
    out._ctx = c;
    return out;
  }
  return { s: sOff, dtheta: da };
}

/**
 * Algebraic area of one arc drawn from the origin, heading 0.
 * ½ ∫ x dy − y dx = (R²/2) (θ − sin θ), with R = s/θ.
 * A straight move or a hinge contributes 0.
 */
/**
 * Smallest circle around one arc, in the arc's own frame (start at origin, heading 0).
 * A turn of 180° or more uses the arc's circle. A shorter arc uses the chord diameter.
 */
export function arcBound(s, dtheta) {
  const th = Number(dtheta) || 0;
  const len = Number(s) || 0;
  if (Math.abs(th) < 1e-12) {
    return { cx: len / 2, cy: 0, r: Math.abs(len) / 2 };
  }
  const R = len / th;
  if (Math.abs(th) >= Math.PI - 1e-9) return { cx: 0, cy: R, r: Math.abs(R) };
  const end = arcIface(len, dtheta);
  return {
    cx: end.dx / 2,
    cy: end.dy / 2,
    r: Math.hypot(end.dx, end.dy) / 2,
  };
}

/** Smallest circle around two circles. Never smaller than either. */
export function encloseCircles(a, b) {
  if (!a) return b;
  if (!b) return a;
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const dist = Math.hypot(dx, dy);
  if (dist + a.r <= b.r + 1e-12) return { cx: b.cx, cy: b.cy, r: b.r };
  if (dist + b.r <= a.r + 1e-12) return { cx: a.cx, cy: a.cy, r: a.r };
  const r = (dist + a.r + b.r) / 2;
  const t = dist > 1e-12 ? (r - a.r) / dist : 0;
  return { cx: a.cx + dx * t, cy: a.cy + dy * t, r };
}

/** Place a circle that is expressed in a frame whose origin is `pose`. */
export function placeCircle(circle, pose) {
  const p = pose3(pose);
  const c = Math.cos(p[2]);
  const s = Math.sin(p[2]);
  return {
    cx: p[0] + c * circle.cx - s * circle.cy,
    cy: p[1] + s * circle.cx + c * circle.cy,
    r: circle.r,
  };
}

/**
 * Minimum circle of a point set (Welzl). The circle of a path of minor arcs
 * is the circle of its endpoints and crowns, so it touches the path.
 */
export function mec(points) {
  const P = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!P.length) return { cx: 0, cy: 0, r: 0 };
  for (let i = P.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = P[i];
    P[i] = P[j];
    P[j] = t;
  }
  return welzl(P, [], P.length);
}

function welzl(P, R, n) {
  if (n === 0 || R.length === 3) return circleOf(R);
  const p = P[n - 1];
  const c = welzl(P, R, n - 1);
  if (Math.hypot(p.x - c.cx, p.y - c.cy) <= c.r + 1e-8) return c;
  return welzl(P, R.concat(p), n - 1);
}

function circleOf(R) {
  if (!R.length) return { cx: 0, cy: 0, r: 0 };
  if (R.length === 1) return { cx: R[0].x, cy: R[0].y, r: 0 };
  if (R.length === 2) {
    return {
      cx: (R[0].x + R[1].x) / 2,
      cy: (R[0].y + R[1].y) / 2,
      r: Math.hypot(R[1].x - R[0].x, R[1].y - R[0].y) / 2,
    };
  }
  const a = R[0];
  const b = R[1];
  const c = R[2];
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return circleOf([a, b]);
  const ux =
    ((a.x * a.x + a.y * a.y) * (b.y - c.y) +
      (b.x * b.x + b.y * b.y) * (c.y - a.y) +
      (c.x * c.x + c.y * c.y) * (a.y - b.y)) /
    d;
  const uy =
    ((a.x * a.x + a.y * a.y) * (c.x - b.x) +
      (b.x * b.x + b.y * b.y) * (a.x - c.x) +
      (c.x * c.x + c.y * c.y) * (b.x - a.x)) /
    d;
  return { cx: ux, cy: uy, r: Math.hypot(a.x - ux, a.y - uy) };
}

/** Endpoints, and the crown of a curved arc. A minor arc lies inside these. */
export function arcExtremes(s, dtheta) {
  const th = Number(dtheta) || 0;
  const len = Number(s) || 0;
  const end = arcIface(len, dtheta);
  const pts = [
    { x: 0, y: 0 },
    { x: end.dx, y: end.dy },
  ];
  if (Math.abs(th) >= 1e-9) {
    const mid = arcIface(len / 2, (Number(dtheta) || 0) / 2);
    pts.push({ x: mid.dx, y: mid.dy });
  }
  return pts;
}

function placePoint(p, pose) {
  const q = pose3(pose);
  const c = Math.cos(q[2]);
  const s = Math.sin(q[2]);
  return {
    x: q[0] + c * p.x - s * p.y,
    y: q[1] + s * p.x + c * p.y,
  };
}

/** Rotation center of one rigid step, or null if the step is a translation. */
export function stepCenter(iface) {
  const p = pose3(iface);
  const th = p[2];
  if (Math.abs(Math.sin(th / 2)) < 1e-9) return null;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const a = 1 - cos;
  const det = a * a + sin * sin;
  return {
    x: (a * p[0] - sin * p[1]) / det,
    y: (sin * p[0] + a * p[1]) / det,
  };
}

const EMPTY_CIRCLE = { cx: 0, cy: 0, r: 0 };

function toLocal(x, y, pose) {
  const p = pose3(pose);
  const th = -p[2];
  const dx = x - p[0];
  const dy = y - p[1];
  const c = Math.cos(th);
  const s = Math.sin(th);
  return { x: c * dx - s * dy, y: s * dx + c * dy };
}

function fromLocal(hit, pose, s0) {
  const p = pose3(pose);
  const c = Math.cos(p[2]);
  const s = Math.sin(p[2]);
  return {
    x: p[0] + c * hit.x - s * hit.y,
    y: p[1] + s * hit.x + c * hit.y,
    heading: p[2] + hit.heading,
    s: s0 + hit.s,
    dist: hit.dist,
    block: hit.block,
  };
}

/**
 * Algebraic area of one arc drawn from the origin, heading 0.
 * ½ ∫ x dy − y dx = (R²/2) (θ − sin θ), with R = s/θ.
 */
export function arcArea(s, dtheta) {
  const th = Number(dtheta) || 0;
  if (Math.abs(th) < 1e-12 || Math.abs(s) < 1e-12) return 0;
  const R = s / th;
  return 0.5 * R * R * (th - Math.sin(th));
}

export class Block {
  /**
   * @param {string} type
   * @param {{id?: string, name?: string}} [fields]
   */
  constructor(type, fields = {}) {
    if (!fields || typeof fields !== "object") fields = {};
    this.type = type;
    this.id = fields.id || uid(type);
    this.name = fields.name || "";
    this._memo = new Map();
  }

  invalidate() {
    this._memo = new Map();
  }

  _remember(kind, ctx, compute) {
    const key = kind + ":" + ctxKey(ctx);
    if (this._memo.has(key)) return this._memo.get(key);
    const value = compute(walkCtx(ctx));
    this._memo.set(key, value);
    return value;
  }

  /** @returns {[number, number, number]} [dx, dy, Δθ] in radians */
  interface(ctx = {}) {
    const o = this._remember("i", ctx, (c) => this.computeInterface(c));
    return pose3(o);
  }

  /**
   * Pose at arc length `s` along this block, written into `out`.
   * Uses the block's period so a long distance costs one period walk
   * plus a divmod, not a walk of the whole distance. `out` is returned.
   * @param {number} s
   * @param {Array|Float64Array} out length ≥ 3
   */
  poseAt(s, out, ctx = {}) {
    const L = this.length(ctx);
    if (!(L > 0) || s <= 0) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      return out;
    }
    const q = Math.floor(s / L);
    const r = s - q * L;
    const one = pose3(this.interface(ctx));
    let acc = q > 0 ? this._repeatIface(one, q) : [0, 0, 0];
    if (r > 1e-12) {
      let walked = 0;
      for (const [ss, da] of this.arcs(ctx)) {
        const len = Math.abs(ss);
        const next = walked + len;
        if (len < 1e-12) {
          if (walked >= r) break;
          acc = composeIface(acc, arcIface(0, da));
        } else if (next >= r) {
          const f = (r - walked) / len;
          acc = composeIface(acc, arcIface(ss * f, da * f));
          break;
        } else {
          acc = composeIface(acc, arcIface(ss, da));
        }
        walked = next;
      }
    }
    const p = pose3(acc);
    out[0] = p[0];
    out[1] = p[1];
    out[2] = p[2];
    return out;
  }

  _repeatIface(one, n) {
    let acc = [0, 0, 0];
    let step = one;
    let k = n;
    while (k > 0) {
      if (k & 1) acc = composeIface(acc, step);
      step = composeIface(step, step);
      k >>= 1;
    }
    return acc;
  }

  computeInterface(_ctx) {
    return { ...IFACE0 };
  }

  /** Path length. Lazy; repeat and scale use shortcuts. */
  length(ctx = {}) {
    return this._remember("L", ctx, (c) => this.computeLength(c));
  }

  computeLength(_ctx) {
    let n = 0;
    for (const [s] of this.arcs(_ctx)) n += Math.abs(s);
    return n;
  }

  /**
   * Algebraic area of the walked path (open or closed). Lazy.
   * Scale contributes k², mirror and reverse contribute a sign,
   * a closed repeat contributes n times. Not asked for on every paint.
   */
  area(ctx = {}) {
    return this._remember("A", ctx, (c) => this.computeArea(c));
  }

  computeArea(_ctx) {
    return foldArea(this.arcs(_ctx));
  }

  /** Leaf count without retaining the rows. */
  arcCount(ctx = {}) {
    return this._remember("n", ctx, (c) => this.computeArcCount(c));
  }

  computeArcCount(_ctx) {
    let n = 0;
    for (const _row of this.arcs(_ctx)) n += 1;
    return n;
  }

  /**
   * @param {{reverse?: boolean, mirror?: boolean, scale?: number, offset?: number, k?: number}} [_ctx]
   * @returns {Generator<[number, number, object]>}
   */
  *arcs(_ctx = {}) {}

  /**
   * Window of this block from arc length `from` to `to`, wrapping at the
   * period. Same rows as `slice(this, from, to).arcs()`, without allocating
   * a Slice.
   *
   * If `row` is an array it is filled and yielded on every step (one
   * object for the whole window). Otherwise each yield is a fresh array.
   * @param {number} from
   * @param {number} to
   * @param {object} [ctx]
   * @param {Array} [row] optional reusable [s, Δθ, extra]
   */
  *arcsSlice(from, to, ctx = {}, row) {
    const a = Number(from) || 0;
    const b = Number(to);
    if (!(b > a)) return;
    const L = this.length(ctx);
    if (!(L > 0)) return;
    const reuse = row && typeof row.length === "number";
    const out = reuse ? row : [0, 0];
    let remaining = b - a;
    let pos = a % L;
    if (pos < 0) pos += L;
    while (remaining > 1e-12) {
      const end = pos + remaining;
      let acc = 0;
      for (const src of this.arcs(ctx, out)) {
        const s = src[0];
        const da = src[1];
        const extra = src[2];
        const len = Math.abs(s);
        const next = acc + len;
        if (len < 1e-12) {
          if (acc >= pos && acc <= end) yield out;
        } else if (next > pos && acc < end) {
          const u = Math.max(0, pos - acc);
          const v = Math.min(len, end - acc);
          const f = (v - u) / len;
          if (f > 1e-12) {
            out[0] = s * f;
            out[1] = da * f;
            if (extra) out[2] = extra;
            else out.length = 2;
            yield out;
            remaining -= v - u;
          }
        }
        acc = next;
        if (acc >= end) break;
      }
      pos = 0;
    }
  }

  /** Enclosing circle in this block's frame. `{ cx, cy, r }`. */
  bound(ctx = {}) {
    return this._remember("C", ctx, (c) => this.computeBound(c));
  }

  computeBound(ctx) {
    return mec(this.extremes(ctx));
  }

  /** Points that can lie on the minimum circle: junctions and arc crowns. */
  extremes(ctx = {}) {
    const pts = [];
    let pose = { ...IFACE0 };
    for (const [s, da] of this.arcs(ctx)) {
      for (const p of arcExtremes(s, da)) pts.push(placePoint(p, pose));
      pose = composeIface(pose, arcIface(s, da));
    }
    return pts;
  }

  get center() {
    const b = this.bound();
    return { x: b.cx, y: b.cy };
  }

  get radius() {
    return this.bound().r;
  }

  /**
   * Nearest point on the walked path. Prunes with the enclosing circle.
   * @returns {{x: number, y: number, heading: number, s: number, dist: number, block: Block}}
   */
  nearest(x, y, ctx = {}) {
    return this._nearest(x, y, walkCtx(ctx), 0);
  }

  _nearest(x, y, ctx, s0) {
    const b = this.bound(ctx);
    if (Math.hypot(x - b.cx, y - b.cy) - b.r >= 1e12) return null;
    let best = null;
    let pose = { ...IFACE0 };
    let acc = s0;
    for (const [s, da] of this.arcs(ctx)) {
      const local = toLocal(x, y, pose);
      const hit = nearestOnArc(s, da, local.x, local.y);
      const placed = fromLocal({ ...hit, block: this }, pose, acc);
      if (!best || placed.dist < best.dist) best = placed;
      pose = composeIface(pose, arcIface(s, da));
      acc += Math.abs(s);
    }
    return best;
  }
  flatten(ctx = {}) {
    return [...this.arcs(ctx)];
  }

  turtlePath(ctx = {}) {
    return this.flatten(ctx).map(([s, da]) => [s, da]);
  }

  extra() {
    return { block: this.name || this.id, type: this.type };
  }

  /**
   * Paint this block sets, or null. Cached once; not rebuilt per yield.
   * A child with no paint returns the parent object (same reference).
   * A child with paint merges onto the parent once per parent reference.
   */
  paintObject(parent) {
    if (!this._paintCache) this._paintCache = new Map();
    const key = parent || null;
    if (this._paintCache.has(key)) return this._paintCache.get(key);
    const own = this._ownPaint || null;
    let resolved = null;
    if (!own) resolved = parent || null;
    else if (!parent) resolved = own;
    else resolved = { ...parent, ...own };
    this._paintCache.set(key, resolved);
    return resolved;
  }

  describe() {
    const I = pose3(this.interface());
    const nm = this.name ? ` ${this.name}` : "";
    return `${this.type}${nm}  Δ=(${fmt(I[0])}, ${fmt(I[1])})  Δθ=${fmt(I[2])}  L=${fmt(this.length())}`;
  }
}

function fmt(n) {
  if (!Number.isFinite(n)) return "?";
  const a = Math.abs(n);
  if (a >= 100) return n.toFixed(1);
  if (a >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

function nearestOnArc(s, dtheta, x, y) {
  const th = Number(dtheta) || 0;
  const len = Number(s) || 0;
  if (Math.abs(th) < 1e-12) {
    const denom = Math.abs(len) < 1e-12 ? 1 : len;
    let t = x / denom;
    t = Math.max(0, Math.min(1, t));
    const px = t * len;
    return { x: px, y: 0, heading: 0, s: Math.abs(px), dist: Math.hypot(x - px, y) };
  }
  const R = len / th;
  let a = Math.atan2(-(y - R), x) + Math.PI / 2;
  const turns = Math.round((th / 2 - a) / (2 * Math.PI));
  a += turns * 2 * Math.PI;
  const lo = Math.min(0, th);
  const hi = Math.max(0, th);
  if (a < lo) a = lo;
  if (a > hi) a = hi;
  const px = R * Math.sin(a);
  const py = R * (1 - Math.cos(a));
  const f = th === 0 ? 0 : a / th;
  return {
    x: px,
    y: py,
    heading: f * (Number(dtheta) || 0),
    s: Math.abs(f * len),
    dist: Math.hypot(x - px, y - py),
  };
}

function foldArea(rows) {
  let acc = { dx: 0, dy: 0, dtheta: 0, area: 0 };
  for (const [s, da] of rows) {
    const I = arcIface(s, da);
    const area = arcArea(s, da);
    acc = appendArea(acc, I, area);
  }
  return acc.area;
}

function appendArea(acc, iface, area) {
  const a = pose3(acc);
  const b = pose3(iface);
  const c = Math.cos(a[2]);
  const s = Math.sin(a[2]);
  const dx = c * b[0] - s * b[1];
  const dy = s * b[0] + c * b[1];
  const cross = 0.5 * (a[0] * dy - a[1] * dx);
  const next = composeIface(a, b);
  return { ...next, area: acc.area + area + cross };
}

/** Leaf arc. Straight when Δθ = 0; hinge when s = 0. */
export class Arc extends Block {
  /**
   * @param {number} s arc length
   * @param {number} dtheta turn in degrees
   * @param {{stroke?: string, width?: number, fill?: string}} [fields]
   */
  constructor(s, dtheta, fields = {}) {
    super("arc", fields);
    this.s = Number(s) || 0;
    this.dtheta = Number(dtheta) || 0;
    this._ownPaint = ownPaint(fields);
  }

  computeInterface(ctx) {
    const row = emitArc(this.s, this.dtheta, ctx);
    return arcIface(row.s, row.dtheta);
  }

  computeLength(ctx) {
    return Math.abs(emitArc(this.s, this.dtheta, ctx).s);
  }

  computeArea(ctx) {
    const row = emitArc(this.s, this.dtheta, ctx);
    return arcArea(row.s, row.dtheta);
  }

  computeArcCount(_ctx) {
    return 1;
  }

  computeBound(ctx) {
    const row = emitArc(this.s, this.dtheta, ctx);
    return arcBound(row.s, row.dtheta);
  }

  _nearest(x, y, ctx, s0) {
    const row = emitArc(this.s, this.dtheta, ctx);
    const hit = nearestOnArc(row.s, row.dtheta, x, y);
    return { ...hit, s: s0 + hit.s, block: this };
  }

  *arcs(ctx = {}, row) {
    const out = row && typeof row.length === "number" ? row : [0, 0];
    const e = emitArc(this.s, this.dtheta, ctx, out._emit || (out._emit = {}));
    out[0] = e.s;
    out[1] = e.dtheta;
    const paint = this.paintObject(ctx.paint);
    if (paint) out[2] = paint;
    else out.length = 2;
    yield out;
  }
}

/** Concatenate children as one relative walk (tape `cat`). */
export class Seq extends Block {
  /** @param {Block[]} items */
  constructor(items = [], fields = {}) {
    super("seq", fields);
    this.items = items.map(asBlock);
  }

  _kids(ctx) {
    const c = walkCtx(ctx);
    return c.reverse ? this.items.slice().reverse() : this.items;
  }

  computeInterface(ctx) {
    let acc = { ...IFACE0 };
    for (const child of this._kids(ctx)) acc = composeIface(acc, child.interface(ctx));
    return acc;
  }

  computeLength(ctx) {
    let n = 0;
    for (const child of this._kids(ctx)) n += child.length(ctx);
    return n;
  }

  computeArea(ctx) {
    let acc = { dx: 0, dy: 0, dtheta: 0, area: 0 };
    for (const child of this._kids(ctx)) {
      acc = appendArea(acc, child.interface(ctx), child.area(ctx));
    }
    return acc.area;
  }

  computeArcCount(ctx) {
    let n = 0;
    for (const child of this._kids(ctx)) n += child.arcCount(ctx);
    return n;
  }

  *arcs(ctx = {}, row) {
    const c = walkCtx(ctx);
    const out = row && typeof row.length === "number" ? row : [0, 0];
    for (const child of this._kids(c)) yield* child.arcs(c, out);
  }

  computeBound(ctx) {
    const pts = [];
    let pose = { ...IFACE0 };
    for (const child of this._kids(ctx)) {
      for (const p of child.extremes(ctx)) pts.push(placePoint(p, pose));
      pose = composeIface(pose, child.interface(ctx));
    }
    return mec(pts);
  }

  extremes(ctx = {}) {
    const pts = [];
    let pose = { ...IFACE0 };
    for (const child of this._kids(ctx)) {
      for (const p of child.extremes(ctx)) pts.push(placePoint(p, pose));
      pose = composeIface(pose, child.interface(ctx));
    }
    return pts;
  }

  _nearest(x, y, ctx, s0) {
    let best = null;
    let pose = { ...IFACE0 };
    let acc = s0;
    for (const child of this._kids(ctx)) {
      const b = placeCircle(child.bound(ctx), pose);
      const bestDist = best ? best.dist : Infinity;
      if (Math.hypot(x - b.cx, y - b.cy) - b.r < bestDist) {
        const local = toLocal(x, y, pose);
        const hit = child._nearest(local.x, local.y, walkCtx(ctx), acc);
        if (hit) {
          const placed = fromLocal(hit, pose, 0);
          placed.s = hit.s;
          if (!best || placed.dist < best.dist) best = placed;
        }
      }
      pose = composeIface(pose, child.interface(ctx));
      acc += child.length(ctx);
    }
    return best;
  }
}

/** Replay the child n times. Implemented as a wrapping slice of n periods. */
export class Repeat extends Block {
  /**
   * @param {Block} of
   * @param {number} n
   */
  constructor(of, n, fields = {}) {
    super("repeat", fields);
    this.of = asBlock(of);
    this.n = Math.max(0, Math.floor(Number(n) || 0));
  }

  /** A slice that covers exactly n periods. Cached per context length. */
  _asSlice(ctx) {
    const L = this.of.length(ctx);
    return new Slice(this.of, 0, this.n * L);
  }

  computeInterface(ctx) {
    if (this.n === 0) return { ...IFACE0 };
    if (this.n === 1) return this.of.interface(ctx);
    return this._asSlice(ctx).interface(ctx);
  }

  computeLength(ctx) {
    return this.n * this.of.length(ctx);
  }

  computeArea(ctx) {
    const one = pose3(this.of.interface(ctx));
    const closed = Math.hypot(one[0], one[1]) < 1e-9;
    if (closed) return this.n * this.of.area(ctx);
    let acc = { dx: 0, dy: 0, dtheta: 0, area: 0 };
    const area = this.of.area(ctx);
    for (let i = 0; i < this.n; i++) acc = appendArea(acc, one, area);
    return acc.area;
  }

  computeArcCount(ctx) {
    return this.n * this.of.arcCount(ctx);
  }

  *arcs(ctx = {}) {
    if (this.n === 0) return;
    yield* this._asSlice(ctx).arcs(ctx);
  }

  computeBound(ctx) {
    const one = pose3(this.of.interface(ctx));
    const childPts = this.of.extremes(ctx);
    if (this.n <= 1) return mec(childPts);
    const O = stepCenter(one);
    const span = this.n * Math.abs(one[2] || 0);
    if (O && span >= TAU - 1e-6) {
      let r = 0;
      for (const p of childPts) r = Math.max(r, Math.hypot(p.x - O.x, p.y - O.y));
      return { cx: O.x, cy: O.y, r };
    }
    const pts = [];
    let pose = { ...IFACE0 };
    for (let k = 0; k < this.n; k++) {
      for (const p of childPts) pts.push(placePoint(p, pose));
      pose = composeIface(pose, one);
    }
    return mec(pts);
  }

  _nearest(x, y, ctx, s0) {
    const one = this.of.interface(ctx);
    const childLen = this.of.length(ctx);
    let best = null;
    let pose = { ...IFACE0 };
    for (let k = 0; k < this.n; k++) {
      const b = placeCircle(this.of.bound(ctx), pose);
      const bestDist = best ? best.dist : Infinity;
      if (Math.hypot(x - b.cx, y - b.cy) - b.r < bestDist) {
        const local = toLocal(x, y, pose);
        const hit = this.of._nearest(local.x, local.y, { ...walkCtx(ctx), k }, s0 + k * childLen);
        if (hit) {
          const placed = fromLocal(hit, pose, 0);
          placed.s = hit.s;
          if (!best || placed.dist < best.dist) best = placed;
        }
      }
      pose = composeIface(pose, one);
    }
    return best;
  }
}

/** Multiply lengths. The child sees scale and offset already multiplied. */
export class Scale extends Block {
  /**
   * @param {Block} of
   * @param {number} k
   */
  constructor(of, k, fields = {}) {
    super("scale", fields);
    this.of = asBlock(of);
    this.k = Number(k);
    if (!Number.isFinite(this.k)) this.k = 1;
  }

  _ctx(ctx) {
    const c = walkCtx(ctx);
    return { ...c, scale: c.scale * this.k, offset: c.offset * this.k };
  }

  computeInterface(ctx) {
    return this.of.interface(this._ctx(ctx));
  }

  computeLength(ctx) {
    return this.of.length(this._ctx(ctx));
  }

  computeArea(ctx) {
    return this.of.area(this._ctx(ctx));
  }

  computeArcCount(ctx) {
    return this.of.arcCount(this._ctx(ctx));
  }

  *arcs(ctx = {}) {
    yield* this.of.arcs(this._ctx(ctx));
  }

  computeBound(ctx) {
    return this.of.bound(this._ctx(ctx));
  }
}

/**
 * Mirror across the incoming heading. XOR the mirror flag and flip the
 * offset side. axisDeg is a local rotation of that axis, emitted as hinges
 * so the child walk stays a stream.
 */
export class Mirror extends Block {
  /**
   * @param {Block} of
   * @param {number} [axisDeg]
   */
  constructor(of, axisDeg = 0, fields = {}) {
    super("mirror", fields);
    this.of = asBlock(of);
    this.axisDeg = Number(axisDeg) || 0;
  }

  _ctx(ctx) {
    const c = walkCtx(ctx);
    return { ...c, mirror: c.mirror !== true, offset: -c.offset };
  }

  computeInterface(ctx) {
    if (Math.abs(this.axisDeg) < 1e-12) return this.of.interface(this._ctx(ctx));
    return new Seq([new Arc(0, this.axisDeg), new Mirror(this.of, 0), new Arc(0, -this.axisDeg)]).interface(ctx);
  }

  computeLength(ctx) {
    return this.of.length(this._ctx(ctx));
  }

  computeArea(ctx) {
    return this.of.area(this._ctx(ctx));
  }

  computeArcCount(ctx) {
    return this.of.arcCount(this._ctx(ctx));
  }

  *arcs(ctx = {}) {
    if (Math.abs(this.axisDeg) < 1e-12) {
      yield* this.of.arcs(this._ctx(ctx));
      return;
    }
    yield* new Seq([new Arc(0, this.axisDeg), new Mirror(this.of, 0), new Arc(0, -this.axisDeg)]).arcs(ctx);
  }

  computeBound(ctx) {
    if (Math.abs(this.axisDeg) < 1e-12) {
      const b = this.of.bound(this._ctx(ctx));
      return { cx: b.cx, cy: -b.cy, r: b.r };
    }
    return new Seq([new Arc(0, this.axisDeg), new Mirror(this.of, 0), new Arc(0, -this.axisDeg)]).bound(ctx);
  }
}

/**
 * Play children last-to-first. The child walk receives the XOR-ed reverse
 * flag. Leaf arcs are unchanged. Does not build the leaf array.
 */
export class Reverse extends Block {
  /** @param {Block} of */
  constructor(of, fields = {}) {
    super("reverse", fields);
    this.of = asBlock(of);
  }

  _ctx(ctx) {
    const c = walkCtx(ctx);
    return { ...c, reverse: !c.reverse };
  }

  computeInterface(ctx) {
    return this.of.interface(this._ctx(ctx));
  }

  computeLength(ctx) {
    return this.of.length(this._ctx(ctx));
  }

  computeArea(ctx) {
    return this.of.area(this._ctx(ctx));
  }

  computeArcCount(ctx) {
    return this.of.arcCount(this._ctx(ctx));
  }

  *arcs(ctx = {}) {
    yield* this.of.arcs(this._ctx(ctx));
  }

  computeBound(ctx) {
    return this.of.bound(this._ctx(ctx));
  }
}

/** Parametric arrowhead — same geometry as `turtle-cmd` / Python AH. */
export class Ah extends Block {
  /**
   * @param {number} w width
   * @param {number} l length (negative flips)
   */
  constructor(w, l, fields = {}) {
    super("ah", fields);
    this.w = Number(w);
    this.l = Number(l);
  }

  leaves() {
    const width = this.w;
    const len = this.l;
    const vx = Math.abs(len);
    const vy = -0.5 * width;
    const h = Math.hypot(vx, vy);
    const β = Math.atan2(vy, vx);
    const θ = Math.PI / 2 - β;
    let α = β;
    let ω = Math.PI + β;
    if (len < 0) {
      α += Math.PI;
      ω += Math.PI;
    }
    const RAD = 180 / Math.PI;
    return new Seq([
      new Arc(0, α * RAD),
      new Arc(h, 0),
      new Arc(0, θ * RAD),
      new Arc(width, 0),
      new Arc(0, θ * RAD),
      new Arc(h, 0),
      new Arc(0, ω * RAD),
    ]);
  }

  computeInterface(ctx) {
    return this.leaves().interface(ctx);
  }

  computeLength(ctx) {
    return this.leaves().length(ctx);
  }

  computeArea(ctx) {
    return this.leaves().area(ctx);
  }

  computeArcCount(ctx) {
    return this.leaves().arcCount(ctx);
  }

  *arcs(ctx = {}) {
    yield* this.leaves().arcs(ctx);
  }
}

/**
 * n copies rotated in the plane and joined (tape `orbit`).
 * Still bakes one child — joining needs the end pose, which interface()
 * could supply. Flags are applied to the child before that bake.
 */
export class Orbit extends Block {
  /**
   * @param {Block} of
   * @param {number} n
   * @param {number} deg
   */
  constructor(of, n, deg, fields = {}) {
    super("orbit", fields);
    this.of = asBlock(of);
    this.n = Math.max(0, Math.floor(Number(n) || 0));
    this.deg = Number(deg) || 0;
  }

  baked(ctx) {
    const segs = this.of.turtlePath(ctx).map(([s, da]) => [s, da / DEG]);
    const stroke = { startPoint: [0, 0], startAngle: 0, turtlePath: segs };
    const out = repeatRotate(stroke, this.n, this.deg / DEG, [0, 0]);
    return (out.turtlePath || []).map((seg) => [Number(seg[0]), Number(seg[1]) * DEG]);
  }

  computeInterface(ctx) {
    return this.baked(ctx).reduce((acc, [s, da]) => composeIface(acc, arcIface(s, da)), { ...IFACE0 });
  }

  computeLength(ctx) {
    return this.baked(ctx).reduce((n, [s]) => n + Math.abs(s), 0);
  }

  computeArcCount(ctx) {
    return this.baked(ctx).length;
  }

  *arcs(ctx = {}) {
    const c = walkCtx(ctx);
    const extra = this.paintObject(c.paint);
    for (const [s, da] of this.baked(c)) yield extra ? [s, da, extra] : [s, da];
  }
}

/**
 * Parallel curve. Positive d is to the right of the walked heading.
 * A hinge becomes the corner fillet. A negative offset length grows a loop.
 */
export class Offset extends Block {
  /**
   * @param {Block} of
   * @param {number} d
   */
  constructor(of, d, fields = {}) {
    super("offset", fields);
    this.of = asBlock(of);
    this.d = Number(d) || 0;
  }

  _ctx(ctx) {
    const c = walkCtx(ctx);
    return { ...c, offset: c.offset + this.d * c.scale };
  }

  computeInterface(ctx) {
    return this.of.interface(this._ctx(ctx));
  }

  computeLength(ctx) {
    return this.of.length(this._ctx(ctx));
  }

  computeArea(ctx) {
    return this.of.area(this._ctx(ctx));
  }

  computeArcCount(ctx) {
    return this.of.arcCount(this._ctx(ctx));
  }

  *arcs(ctx = {}) {
    yield* this.of.arcs(this._ctx(ctx));
  }

  computeBound(ctx) {
    return this.of.bound(this._ctx(ctx));
  }
}

function ownPaint(fields) {
  if (!fields) return null;
  const out = {};
  let any = false;
  if (fields.stroke != null) {
    out.stroke = fields.stroke;
    any = true;
  }
  if (fields.width != null) {
    out.width = Number(fields.width);
    any = true;
  }
  if (fields.fill != null) {
    out.fill = fields.fill;
    any = true;
  }
  const dash = fields.dash != null ? fields.dash : fields.line;
  if (dash != null && dash !== false && dash !== "solid") {
    out.dash = dash === true ? "dashed" : dash;
    any = true;
  }
  return any ? out : null;
}

/**
 * Restyle a block. Fields update the parent's paint; unset fields are kept.
 * One cached object per parent reference — nothing allocated in the child loop.
 */
export class Paint extends Block {
  /**
   * @param {Block} of
   * @param {{stroke?: string, width?: number, fill?: string}} style
   */
  constructor(of, style = {}, fields = {}) {
    super("paint", fields);
    this.of = asBlock(of);
    this._ownPaint = ownPaint(style) || ownPaint(fields);
  }

  computeInterface(ctx) {
    return this.of.interface(ctx);
  }

  computeLength(ctx) {
    return this.of.length(ctx);
  }

  computeArea(ctx) {
    return this.of.area(ctx);
  }

  computeArcCount(ctx) {
    return this.of.arcCount(ctx);
  }

  *arcs(ctx = {}) {
    const c = walkCtx(ctx);
    const paint = this.paintObject(c.paint);
    yield* this.of.arcs({ ...c, paint });
  }

  computeBound(ctx) {
    return this.of.bound(ctx);
  }
}

/**
 * Sub-path of `of` from arc length `from` to `to`.
 * Boundary arcs are split exactly: [v − u, Δθ·(v − u)/s].
 * A hinge has no length and is kept when the mark lands on it.
 *
 * The source is treated as periodic: if the range extends past
 * `of.length()`, the walk wraps and continues. The slice length is
 * `to − from` (not clipped). A non-finite `to` still means "to the end
 * of one period", preserving the old clip behaviour.
 */
export class Slice extends Block {
  /**
   * @param {Block} of
   * @param {number} from
   * @param {number} to
   */
  constructor(of, from, to, fields = {}) {
    super("slice", fields);
    this.of = asBlock(of);
    this.from = Number(from) || 0;
    this.to = Number(to);
    if (!Number.isFinite(this.to)) this.to = Infinity;
  }

  computeLength(ctx) {
    if (!Number.isFinite(this.to)) {
      const total = this.of.length(ctx);
      const a = Math.max(0, Math.min(this.from, total));
      return Math.max(0, total - a);
    }
    return Math.max(0, this.to - this.from);
  }

  /**
   * Pose step from `from` to `to`. Uses the source period so a long
   * prefix costs one period walk plus a divmod, not a walk of the
   * whole distance.
   */
  computeInterface(ctx) {
    const L = this.of.length(ctx);
    if (!(L > 0) || this.to <= this.from) return { ...IFACE0 };
    if (!Number.isFinite(this.to)) {
      let acc = { ...IFACE0 };
      for (const [s, da] of this.arcs(ctx)) acc = composeIface(acc, arcIface(s, da));
      return acc;
    }
    const one = pose3(this.of.interface(ctx));
    const a = this.from;
    const b = this.to;
    const q0 = Math.floor(a / L);
    const r0 = a - q0 * L;
    const q1 = Math.floor(b / L);
    const r1 = b - q1 * L;
    if (q0 === q1) {
      return this._window(ctx, r0, r1);
    }
    let acc = this._window(ctx, r0, L);
    const full = q1 - q0 - 1;
    if (full > 0) acc = composeIface(acc, this._repeat(one, full));
    if (r1 > 1e-12) acc = composeIface(acc, this._window(ctx, 0, r1));
    return acc;
  }

  /** Interface of one period, composed n times. */
  _repeat(one, n) {
    let acc = { ...IFACE0 };
    let step = one;
    let k = n;
    while (k > 0) {
      if (k & 1) acc = composeIface(acc, step);
      step = composeIface(step, step);
      k >>= 1;
    }
    return acc;
  }

  /** Interface of the source from arc length a to b, both in [0, L]. */
  _window(ctx, a, b) {
    if (b <= a + 1e-12) return { ...IFACE0 };
    let acc = { ...IFACE0 };
    let sAcc = 0;
    for (const [s, da] of this.of.arcs(ctx)) {
      const len = Math.abs(s);
      const next = sAcc + len;
      if (len < 1e-12) {
        if (sAcc >= a && sAcc <= b) acc = composeIface(acc, arcIface(0, da));
      } else if (next > a && sAcc < b) {
        const u = Math.max(0, a - sAcc);
        const v = Math.min(len, b - sAcc);
        const f = (v - u) / len;
        if (f > 1e-12) acc = composeIface(acc, arcIface(s * f, da * f));
      }
      sAcc = next;
      if (sAcc >= b) break;
    }
    return acc;
  }

  computeArea(ctx) {
    return foldArea(this.arcs(ctx));
  }

  *arcs(ctx = {}) {
    const a = this.from;
    const b = this.to;
    if (b <= a) return;
    const L = this.of.length(ctx);
    if (!(L > 0)) return;
    if (!Number.isFinite(b)) {
      yield* this._once(ctx, Math.max(0, a), Infinity);
      return;
    }
    let remaining = b - a;
    let pos = a % L;
    if (pos < 0) pos += L;
    while (remaining > 1e-12) {
      const emitted = yield* this._once(ctx, pos, pos + remaining);
      remaining -= emitted;
      pos = 0;
    }
  }

  /**
   * Yield the source from arc length `from` up to `to`, without wrapping.
   * Returns the length actually emitted.
   */
  *_once(ctx, from, to) {
    let acc = 0;
    let emitted = 0;
    for (const [s, da, extra] of this.of.arcs(ctx)) {
      const len = Math.abs(s);
      const next = acc + len;
      if (len < 1e-12) {
        if (acc >= from && acc <= to) yield extra ? [0, da, extra] : [0, da];
      } else if (next > from && acc < to) {
        const u = Math.max(0, from - acc);
        const v = Math.min(len, to - acc);
        const f = (v - u) / len;
        if (f > 1e-12) {
          yield extra ? [s * f, da * f, extra] : [s * f, da * f];
          emitted += v - u;
        }
      }
      acc = next;
      if (acc >= to) break;
    }
    return emitted;
  }
}

/** Look up a named definition at eval time. Forwards the walk context. */
export class Ref extends Block {
  /**
   * @param {string} refName
   * @param {(name: string) => Block | undefined} resolve
   */
  constructor(refName, resolve, fields = {}) {
    super("ref", fields);
    this.refName = String(refName);
    this.resolve = resolve;
    this.name = this.name || this.refName;
  }

  target() {
    const b = this.resolve(this.refName);
    if (!b) throw new Error(`unknown block: ${this.refName}`);
    if (!isBlock(b)) {
      throw new Error(`ref expects a block (${this.refName} is ${typeof b}); use load() for a class or function`);
    }
    return b;
  }

  computeInterface(ctx) {
    return this.target().interface(ctx);
  }

  computeLength(ctx) {
    return this.target().length(ctx);
  }

  computeArea(ctx) {
    return this.target().area(ctx);
  }

  computeArcCount(ctx) {
    return this.target().arcCount(ctx);
  }

  *arcs(ctx = {}) {
    yield* this.target().arcs(ctx);
  }
}

/**
 * @param {Block | number[] | Block[]} x
 * @returns {Block}
 */
export function asBlock(x) {
  if (x instanceof Block) return x;
  if (
    Array.isArray(x) &&
    (x.length === 2 || x.length === 3) &&
    typeof x[0] === "number" &&
    typeof x[1] === "number"
  ) {
    const fields = x[2] && typeof x[2] === "object" ? x[2] : undefined;
    return new Arc(x[0], x[1], fields);
  }
  if (Array.isArray(x)) return new Seq(x.map(asBlock));
  throw new Error("not a block");
}

export function isBlock(x) {
  return x instanceof Block;
}
