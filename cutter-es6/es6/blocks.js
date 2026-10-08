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

export function sinc(x) {
  return Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x;
}

export const IFACE0 = { dx: 0, dy: 0, dtheta: 0 };

let nextId = 1;
function uid(prefix = "b") {
  return `${prefix}_${nextId++}`;
}

/**
 * Pose step of one arc starting at the origin, heading 0.
 * @param {number} s
 * @param {number} dtheta degrees
 */
export function arcIface(s, dtheta) {
  const ang = Number(dtheta) * DEG;
  const half = ang / 2;
  const chord = Number(s) * sinc(half);
  return {
    dx: chord * Math.cos(half),
    dy: chord * Math.sin(half),
    dtheta: Number(dtheta) || 0,
  };
}

/** Compose A then B, both in A's incoming frame. */
export function composeIface(A, B) {
  const th = A.dtheta * DEG;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return {
    dx: A.dx + c * B.dx - s * B.dy,
    dy: A.dy + s * B.dx + c * B.dy,
    dtheta: A.dtheta + B.dtheta,
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
  const th = da * DEG;
  if (Math.abs(th) < 1e-12) return { s: ss, dtheta: da };
  let sOff = ss - d * th;
  if (sOff < 0) {
    const R = sOff / th;
    const loop = Math.abs(R) * 2 * Math.PI;
    const turn = da < 0 ? -360 : 360;
    if (loop > 1e-12) {
      while (sOff < 0) {
        sOff += loop;
        da += turn;
      }
    }
  }
  return { s: sOff, dtheta: da };
}

/**
 * Algebraic area of one arc drawn from the origin, heading 0.
 * ½ ∫ x dy − y dx = (R²/2) (θ − sin θ), with R = s/θ.
 * A straight move or a hinge contributes 0.
 */
export function arcArea(s, dtheta) {
  const th = (Number(dtheta) || 0) * DEG;
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

  /** @returns {{dx: number, dy: number, dtheta: number}} */
  interface(ctx = {}) {
    return this._remember("i", ctx, (c) => this.computeInterface(c));
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

  /** Drain. Prefer arcs() for a long path. */
  flatten(ctx = {}) {
    return [...this.arcs(ctx)];
  }

  turtlePath(ctx = {}) {
    return this.flatten(ctx).map(([s, da]) => [s, da]);
  }

  extra() {
    return { block: this.name || this.id, type: this.type };
  }

  describe() {
    const I = this.interface();
    const nm = this.name ? ` ${this.name}` : "";
    return `${this.type}${nm}  Δ=(${fmt(I.dx)}, ${fmt(I.dy)})  Δθ=${fmt(I.dtheta)}°  L=${fmt(this.length())}`;
  }
}

function fmt(n) {
  if (!Number.isFinite(n)) return "?";
  const a = Math.abs(n);
  if (a >= 100) return n.toFixed(1);
  if (a >= 1) return n.toFixed(2);
  return n.toFixed(3);
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
  const th = acc.dtheta * DEG;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const dx = c * iface.dx - s * iface.dy;
  const dy = s * iface.dx + c * iface.dy;
  const cross = 0.5 * (acc.dx * dy - acc.dy * dx);
  const next = composeIface(acc, iface);
  return { ...next, area: acc.area + area + cross };
}

/** Leaf arc. Straight when Δθ = 0; hinge when s = 0. */
export class Arc extends Block {
  /**
   * @param {number} s arc length
   * @param {number} dtheta turn in degrees
   */
  constructor(s, dtheta, fields = {}) {
    super("arc", fields);
    this.s = Number(s) || 0;
    this.dtheta = Number(dtheta) || 0;
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

  *arcs(ctx = {}) {
    const row = emitArc(this.s, this.dtheta, ctx);
    yield [row.s, row.dtheta, { ...this.extra(), k: walkCtx(ctx).k }];
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
    const one = this.of.interface(ctx);
    const closed = Math.hypot(one.dx, one.dy) < 1e-9;
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
    const segs = this.of.turtlePath(ctx);
    const stroke = { startPoint: [0, 0], startAngle: 0, turtlePath: segs };
    const out = repeatRotate(stroke, this.n, this.deg, [0, 0]);
    return (out.turtlePath || []).map((seg) => [Number(seg[0]), Number(seg[1])]);
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
    let i = 0;
    for (const [s, da] of this.baked(c)) {
      yield [s, da, { ...this.extra(), k: c.k ?? i++ }];
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
    return asBlock(b);
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
