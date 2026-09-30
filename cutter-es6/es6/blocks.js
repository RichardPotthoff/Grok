/**
 * Lazy turtle blocks.
 *
 * A block is an operator. The stored model is the tree, not a baked
 * turtlePath. `interface()` is the relative pose step in the incoming-
 * heading-0 frame: { dx, dy, dtheta } with Δθ in degrees.
 * `arcs()` is a restartable generator of leaf [s, Δθ, extra].
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

export function foldIface(blocks) {
  let acc = { ...IFACE0 };
  for (const b of blocks) acc = composeIface(acc, asBlock(b).interface());
  return acc;
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
    this._iface = null;
    this._ver = 0;
  }

  invalidate() {
    this._iface = null;
    this._ver += 1;
  }

  /** @returns {{dx: number, dy: number, dtheta: number}} */
  interface() {
    if (this._iface) return this._iface;
    this._iface = this.computeInterface();
    return this._iface;
  }

  computeInterface() {
    return { ...IFACE0 };
  }

  /**
   * @param {{k?: number, name?: string}} [_ctx]
   * @returns {Generator<[number, number, object]>}
   */
  *arcs(_ctx = {}) {}

  flatten(ctx = {}) {
    return [...this.arcs(ctx)];
  }

  turtlePath() {
    return this.flatten().map(([s, da]) => [s, da]);
  }

  extra() {
    return { block: this.name || this.id, type: this.type };
  }

  describe() {
    const I = this.interface();
    const nm = this.name ? ` ${this.name}` : "";
    return `${this.type}${nm}  Δ=(${fmt(I.dx)}, ${fmt(I.dy)})  Δθ=${fmt(I.dtheta)}°`;
  }
}

function fmt(n) {
  if (!Number.isFinite(n)) return "?";
  const a = Math.abs(n);
  if (a >= 100) return n.toFixed(1);
  if (a >= 1) return n.toFixed(2);
  return n.toFixed(3);
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

  computeInterface() {
    return arcIface(this.s, this.dtheta);
  }

  *arcs(ctx = {}) {
    yield [
      this.s,
      this.dtheta,
      { ...this.extra(), k: ctx.k ?? 0 },
    ];
  }
}

/** Concatenate children as one relative walk (tape `cat`). */
export class Seq extends Block {
  /** @param {Block[]} items */
  constructor(items = [], fields = {}) {
    super("seq", fields);
    this.items = items.map(asBlock);
  }

  computeInterface() {
    return foldIface(this.items);
  }

  *arcs(ctx = {}) {
    for (const child of this.items) yield* child.arcs(ctx);
  }
}

/** Replay the child n times (Python TL / tape `loop`). */
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

  computeInterface() {
    const one = this.of.interface();
    let acc = { ...IFACE0 };
    for (let i = 0; i < this.n; i++) acc = composeIface(acc, one);
    return acc;
  }

  *arcs(ctx = {}) {
    for (let k = 0; k < this.n; k++) {
      yield* this.of.arcs({ ...ctx, k });
    }
  }
}

/** Multiply lengths; leave turns. */
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

  computeInterface() {
    const I = this.of.interface();
    return { dx: I.dx * this.k, dy: I.dy * this.k, dtheta: I.dtheta };
  }

  *arcs(ctx = {}) {
    for (const [s, da, extra] of this.of.arcs(ctx)) {
      yield [s * this.k, da, extra];
    }
  }
}

/**
 * Mirror content across the incoming heading axis, then rotate that
 * axis by `axisDeg` in the local frame. Leaf rows get Δθ → −Δθ.
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

  computeInterface() {
    const I = this.of.interface();
    const a = this.axisDeg * DEG;
    const c = Math.cos(-a);
    const s = Math.sin(-a);
    let x = c * I.dx - s * I.dy;
    let y = s * I.dx + c * I.dy;
    y = -y;
    const c2 = Math.cos(a);
    const s2 = Math.sin(a);
    return {
      dx: c2 * x - s2 * y,
      dy: s2 * x + c2 * y,
      dtheta: -I.dtheta,
    };
  }

  *arcs(ctx = {}) {
    const axis = this.axisDeg;
    if (Math.abs(axis) < 1e-12) {
      for (const [s, da, extra] of this.of.arcs(ctx)) {
        yield [s, -da, extra];
      }
      return;
    }
    yield* new Seq([new Arc(0, axis), new Mirror(this.of, 0), new Arc(0, -axis)]).arcs(ctx);
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
    return [
      new Arc(0, α * RAD),
      new Arc(h, 0),
      new Arc(0, θ * RAD),
      new Arc(width, 0),
      new Arc(0, θ * RAD),
      new Arc(h, 0),
      new Arc(0, ω * RAD),
    ];
  }

  computeInterface() {
    return foldIface(this.leaves());
  }

  *arcs(ctx = {}) {
    for (const leaf of this.leaves()) yield* leaf.arcs(ctx);
  }
}

/**
 * n copies rotated in the plane and joined (tape `orbit`).
 * Flatten uses path-xform; the node still stores (of, n, deg).
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
    this._baked = null;
  }

  invalidate() {
    super.invalidate();
    this._baked = null;
  }

  baked() {
    if (this._baked) return this._baked;
    const segs = this.of.turtlePath();
    const stroke = { startPoint: [0, 0], startAngle: 0, turtlePath: segs };
    const out = repeatRotate(stroke, this.n, this.deg, [0, 0]);
    this._baked = (out.turtlePath || []).map((seg) => [Number(seg[0]), Number(seg[1])]);
    return this._baked;
  }

  computeInterface() {
    return this.baked().reduce((acc, [s, da]) => composeIface(acc, arcIface(s, da)), { ...IFACE0 });
  }

  *arcs(ctx = {}) {
    let i = 0;
    for (const [s, da] of this.baked()) {
      yield [s, da, { ...this.extra(), k: ctx.k ?? i++ }];
    }
  }
}

/** Look up a named definition at eval time. */
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

  computeInterface() {
    return this.target().interface();
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
