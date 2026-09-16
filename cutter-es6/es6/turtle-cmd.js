/**
 * Stack language for turtle paths.
 *
 * Numbers and path objects live on a stack. A word pops arguments and
 * pushes a result. The stored model is still [s, Δθ°] + start pose.
 *
 *   1 0 seg  0.25 -0.5 ah cat  0 180 seg cat  1 0 seg cat  0 90 seg cat  4 loop  emit
 *
 * is the Python  TL(((1,0), *AH(w=0.25,l=-0.5), (0,π), (1,0), (0,π/2)), 4)
 *
 * Angles in the tape are degrees. `rad` converts a radian value to degrees.
 */

import { normalizeStroke } from "./drawing-doc.js";
import {
  appendStroke,
  lastPose,
  mirrorStroke,
  repeatRotate,
  rotateStroke,
} from "./path-xform.js";

const RAD = 180 / Math.PI;

export function segsOf(x) {
  if (Array.isArray(x)) return x.map((s) => [Number(s[0]), Number(s[1])]);
  if (x && Array.isArray(x.turtlePath)) return x.turtlePath.map((s) => [Number(s[0]), Number(s[1])]);
  throw new Error("not a path");
}

export function asPath(x, paint = {}) {
  if (x && Array.isArray(x.turtlePath)) return normalizeStroke({ ...x, ...paint });
  if (Array.isArray(x)) return normalizeStroke({ turtlePath: x, ...paint });
  throw new Error("not a path");
}

export function emptyPath(paint = {}) {
  return normalizeStroke({ startPoint: [0, 0], startAngle: 0, turtlePath: [], ...paint });
}

/** Python AH(w, l) — yields (s, Δθ rad), converted to degrees. */
export function arrowhead(w, l) {
  const width = Number(w);
  const len = Number(l);
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
  const segs = [
    [0, α * RAD],
    [h, 0],
    [0, θ * RAD],
    [width, 0],
    [0, θ * RAD],
    [h, 0],
    [0, ω * RAD],
  ];
  return normalizeStroke({ turtlePath: segs, name: "ah" });
}

export function loopPath(path, n) {
  const segs = segsOf(path);
  const out = [];
  const times = Math.max(0, Math.floor(Number(n)));
  for (let i = 0; i < times; i++) for (const s of segs) out.push(s.slice());
  return normalizeStroke({ ...asPath(path), turtlePath: out });
}

export function concatPath(a, b) {
  return normalizeStroke({
    ...asPath(a),
    turtlePath: [...segsOf(a), ...segsOf(b)],
  });
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const s = String(src);
  while (i < s.length) {
    const ch = s[i];
    if (ch === "#" || (ch === "\\" && (i === 0 || /\s/.test(s[i - 1])))) {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    if (ch === "(") {
      i++;
      while (i < s.length && s[i] !== ")") i++;
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"') {
      i++;
      let t = "";
      while (i < s.length && s[i] !== '"') t += s[i++];
      i++;
      tokens.push({ kind: "str", value: t });
      continue;
    }
    let j = i;
    while (j < s.length && !/\s/.test(s[j]) && s[j] !== "(" && s[j] !== "#") j++;
    const raw = s.slice(i, j);
    i = j;
    if (raw === "") continue;
    const num = Number(raw);
    if (raw !== "+" && raw !== "-" && raw !== "." && Number.isFinite(num) && /^-?\d/.test(raw)) {
      tokens.push({ kind: "num", value: num });
    } else {
      tokens.push({ kind: "word", value: raw.toLowerCase() });
    }
  }
  return tokens;
}

export class TurtleStack {
  constructor(opts = {}) {
    this.stack = [];
    this.log = [];
    this.onEmit = opts.onEmit || (() => {});
    this.onLog = opts.onLog || (() => {});
  }

  reset() {
    this.stack = [];
    return this;
  }

  push(v) {
    this.stack.push(v);
    return this;
  }

  pop(n = 1) {
    if (this.stack.length < n) throw new Error("stack underflow");
    if (n === 1) return this.stack.pop();
    return this.stack.splice(this.stack.length - n, n);
  }

  peek() {
    return this.stack[this.stack.length - 1];
  }

  note(msg) {
    this.log.push(String(msg));
    this.onLog(String(msg));
  }

  popNum() {
    const v = this.pop();
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error("expected number");
    return n;
  }

  popPath() {
    return asPath(this.pop());
  }

  eval(src) {
    const tokens = tokenize(src);
    for (const tok of tokens) {
      if (tok.kind === "num" || tok.kind === "str") {
        this.push(tok.value);
        continue;
      }
      const fn = WORDS[tok.value];
      if (!fn) throw new Error("unknown word: " + tok.value);
      fn(this);
    }
    return this;
  }

  dump() {
    return this.stack.map(describe);
  }
}

function describe(v) {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (v && Array.isArray(v.turtlePath)) {
    return `path[${v.turtlePath.length}]`;
  }
  if (Array.isArray(v)) return `segs[${v.length}]`;
  return String(v);
}

function need(st, n) {
  if (st.stack.length < n) throw new Error("stack underflow");
}

export const WORDS = {
  dup(st) {
    need(st, 1);
    st.push(st.peek());
  },
  drop(st) {
    st.pop();
  },
  swap(st) {
    const [a, b] = st.pop(2);
    st.push(b, a);
  },
  over(st) {
    need(st, 2);
    st.push(st.stack[st.stack.length - 2]);
  },
  rad(st) {
    st.push(st.popNum() * RAD);
  },
  pi(st) {
    st.push(Math.PI);
  },

  /** ( s θ -- path ) one turtle move */
  seg(st) {
    const θ = st.popNum();
    const s = st.popNum();
    st.push(normalizeStroke({ turtlePath: [[s, θ]] }));
  },

  /** ( w l -- path ) parametric arrowhead (Python AH) */
  ah(st) {
    const l = st.popNum();
    const w = st.popNum();
    st.push(arrowhead(w, l));
  },

  /** ( path n -- path ) repeat the move list n times (Python TL) */
  loop(st) {
    const n = st.popNum();
    const p = st.popPath();
    st.push(loopPath(p, n));
  },

  /** ( path path -- path ) append move lists, no pose join */
  cat(st) {
    const b = st.popPath();
    const a = st.popPath();
    st.push(concatPath(a, b));
  },

  /** ( path path -- path ) appendStroke with fit-arc if poses differ */
  join(st) {
    const b = st.popPath();
    const a = st.popPath();
    st.push(normalizeStroke(appendStroke(a, b)));
  },

  /** ( path n -- path ) append one more [s, θ] from two numbers? no: path s θ add */
  add(st) {
    const θ = st.popNum();
    const s = st.popNum();
    const p = st.popPath();
    st.push(normalizeStroke({ ...p, turtlePath: [...p.turtlePath, [s, θ]] }));
  },

  /** ( path deg -- path ) rotate about origin */
  rot(st) {
    const deg = st.popNum();
    const p = st.popPath();
    st.push(normalizeStroke(rotateStroke(p, deg, [0, 0])));
  },

  /** ( path axisDeg -- path ) mirror across line through origin */
  mirror(st) {
    const axis = st.popNum();
    const p = st.popPath();
    st.push(normalizeStroke(mirrorStroke(p, axis, [0, 0])));
  },

  /** ( path n deg -- path ) n rotated copies stitched in the plane */
  orbit(st) {
    const deg = st.popNum();
    const n = st.popNum();
    const p = st.popPath();
    st.push(normalizeStroke(repeatRotate(p, n, deg, [0, 0])));
  },

  /** ( path x y -- path ) set start point */
  at(st) {
    const y = st.popNum();
    const x = st.popNum();
    const p = st.popPath();
    st.push(normalizeStroke({ ...p, startPoint: [x, y] }));
  },

  /** ( path θ -- path ) set start heading */
  head(st) {
    const θ = st.popNum();
    const p = st.popPath();
    st.push(normalizeStroke({ ...p, startAngle: θ }));
  },

  /** ( path role -- path ) stroke paint */
  stroke(st) {
    const role = st.pop();
    const p = st.popPath();
    st.push(normalizeStroke({ ...p, stroke: String(role) }));
  },

  /** ( path role -- path ) fill paint; 0 or "" clears */
  fill(st) {
    const role = st.pop();
    const p = st.popPath();
    const fill = role === 0 || role === "" || role === "none" ? null : String(role);
    st.push(normalizeStroke({ ...p, fill }));
  },

  /** ( path w -- path ) line width */
  thick(st) {
    const w = st.popNum();
    const p = st.popPath();
    st.push(normalizeStroke({ ...p, width: w }));
  },

  /** ( path -- ) send to the host drawing */
  emit(st) {
    const p = st.popPath();
    st.onEmit(p);
    st.note("emit path[" + p.turtlePath.length + "]");
  },

  /** ( -- ) print stack */
  ["."](st) {
    st.note(st.dump().join(" "));
  },

  words(st) {
    st.note(Object.keys(WORDS).sort().join(" "));
  },

  /** inspect top path end pose */
  pose(st) {
    const p = st.peek();
    const end = lastPose(asPath(p));
    st.note(
      `end (${end.point[0].toFixed(3)}, ${end.point[1].toFixed(3)}) θ=${((end.heading * 180) / Math.PI).toFixed(2)}° n=${asPath(p).turtlePath.length}`,
    );
  },
};

export const TAPE_HELP = `\
# stack tape — numbers and paths. angles in degrees.
#   s θ seg          one move
#   w l ah           arrowhead (Python AH)
#   path n loop      repeat moves (Python TL)
#   path path cat    glue move lists
#   path deg rot     rotate about origin
#   path axis mirror mirror across a line through origin
#   path emit        become the active stroke
#
# four-arrow pan (same as the Python TL + AH example):`;

export const TAPE_PAN = `1 0 seg
0.25 -0.5 ah cat
0 180 seg cat
1 0 seg cat
0 90 seg cat
4 loop
2.2 thick
emit`;

export function evalTurtle(src, opts = {}) {
  const st = new TurtleStack(opts);
  st.eval(src);
  return st;
}
