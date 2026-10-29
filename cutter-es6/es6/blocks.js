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
 */
export function walkCtx(ctx = {}) {
  const scale = Number(ctx.scale);
  const offset = Number(ctx.offset);
  return {
    reverse: !!ctx.reverse,
    mirror: !!ctx.mirror,
    scale: Number.isFinite(scale) ? scale : 1,
    offset: Number.isFinite(offset) ? offset : 0,
    k: ctx.k ?? 0,
    paint: ctx.paint || null,
  };
}

export function ctxKey(ctx) {
  const c = walkCtx(ctx);
  return `${c.reverse ? 1 : 0}${c.mirror ? 1 : 0}:${c.scale}:${c.offset}`;
}

/** Leaf row after the walk flags. A hinge (s = 0, Δθ ≠ 0) is kept. */
export function emitArc(s, dtheta, ctx) {
  const c = walkCtx(ctx);
  const ss = (Number(s) || 0) * c.scale;
  let da = c.mirror ? -(Number(dtheta) || 0) : Number(dtheta) || 0;
  const d = c.mirror ? -c.offset : c.offset;
  const th = da;
  if (Math.abs(th) < 1e-12) return { s: ss, dtheta: da };
  let sOff = ss - d * th;
  /*
  if (c.offset !== 0 && sOff < 0) {
  
    const R = sOff / th;
    const loop = Math.abs(R) * TAU;
    const turn = da < 0 ? -TAU : TAU;
    if (loop > 1e-12) {
      while (sOff < 0) {
        sOff += loop;
        da += turn;
      }
    }
  }
  */
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

  *arcs(ctx = {}) {
    const row = emitArc(this.s, this.dtheta, ctx);
    yield [row.s, row.dtheta, this.paintObject(ctx.paint)];
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

  *arcs(ctx = {}) {
    const c = walkCtx(ctx);
    for (const child of this._kids(c)) yield* child.arcs(c);
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

/** Replay the child n times. A reversed repeat is the reversed child, n times. */
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

  computeInterface(ctx) {
    const one = this.of.interface(ctx);
    let acc = { ...IFACE0 };
    for (let i = 0; i < this.n; i++) acc = composeIface(acc, one);
    return acc;
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
    const c = walkCtx(ctx);
    for (let k = 0; k < this.n; k++) yield* this.of.arcs({ ...c, k });
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
    for (const [s, da] of this.baked(c)) yield [s, da, extra];
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
    this.from = Math.max(0, Number(from) || 0);
    this.to = Number(to);
    if (!Number.isFinite(this.to)) this.to = Infinity;
  }

  computeLength(ctx) {
    const total = this.of.length(ctx);
    const a = Math.min(this.from, total);
    const b = Math.min(Math.max(this.to, a), total);
    return b - a;
  }

  computeInterface(ctx) {
    let acc = { ...IFACE0 };
    for (const [s, da] of this.arcs(ctx)) acc = composeIface(acc, arcIface(s, da));
    return acc;
  }

  computeArea(ctx) {
    return foldArea(this.arcs(ctx));
  }

  *arcs(ctx = {}) {
    const a = this.from;
    const b = this.to;
    if (b <= a) return;
    let acc = 0;
    for (const [s, da, extra] of this.of.arcs(ctx)) {
      const len = Math.abs(s);
      const next = acc + len;
      if (len < 1e-12) {
        if (acc >= a && acc <= b) yield [0, da, extra];
      } else if (next > a && acc < b) {
        const u = Math.max(0, a - acc);
        const v = Math.min(len, b - acc);
        const f = (v - u) / len;
        if (f > 1e-12) yield [s * f, da * f, extra];
      }
      acc = next;
      if (acc >= b) break;
    }
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
  if (Array.isArray(x) && x.length === 2 && typeof x[0] === "number") {
    return new Arc(x[0], x[1]);
  }
  if (Array.isArray(x)) return new Seq(x.map(asBlock));
  throw new Error("not a block");
}

export function isBlock(x) {
  return x instanceof Block;
}
