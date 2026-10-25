/**
 * Constrained JS REPL over lazy blocks.
 *
 * The script is the document. `define` publishes a named block.
 * `show` places a use on the page (pose + paint + root).
 * Flatten happens at show / paint, not inside seq / repeat.
 */

import {
  Ah,
  Arc,
  Block,
  Mirror,
  Orbit,
  Ref,
  Repeat,
  Reverse,
  Scale,
  Seq,
  Slice,
  Offset,
  Paint,
  asBlock,
  isBlock,
} from "./blocks.js";
import { connect as connectPoses } from "./connector.js";

export const STORAGE_KEY = "arc-drawing-repl-v2";

export const DEFAULT_SCRIPT = `// Spoke × 4  (same moves as the Forth pan example)
const spoke = seq(
  seg(1, 0),
  ah(1, -2),
  seg(0, 180),
  seg(1, 0),
  seg(0, 90),
);
store("spoke", spoke);
show(repeat(spoke, 4));
`;

export const STAR6_SCRIPT = `// 1/12 of the outline, then reverse + repeat 6
const star6_ray = seq(
  seg(3, -30),
  seg(15, 0),
  seg(4, 60),
);
store("star6_ray", star6_ray);
const star6 = repeat(seq(star6_ray, reverse(star6_ray)), 6);
store("star6", star6);
show(star6);
`;

export const SLICE_SCRIPT = `// Rounded square, a slice of it, and a parallel offset.
const side = seq(seg(20, 0), seg(2 * Math.PI, 90));
const roundSq = repeat(side, 4);
store("roundSq", roundSq);
print("roundSq", roundSq);

show(roundSq, { name: "roundSq", stroke: "ink" });

const part = slice(roundSq, 10, 40);
store("slice", part);
print("slice", part);
show(part, { at: [36, 0], name: "slice", stroke: "accent" });

const rim = offset(roundSq, 3);
store("offset", rim);
print("offset", rim);
show(rim, { at: [0, -36], name: "offset", stroke: "danger" });

const c = circle(roundSq);
print("bound", c.cx, c.cy, c.r);
show(c.path, { at: c.at, name: "bound", stroke: "muted" });
print("nearest", nearest(roundSq, 8, 6));
`;

export const API_HELP = [
  "seg(s, dθ)           one arc — degrees",
  "turn(dθ)             hinge, s = 0",
  "ah(w, l)             arrowhead (Python AH)",
  "seq(a, b, …) / cat   relative concatenate",
  "repeat(b, n) / loop  replay moves n times",
  "scale(b, k)          scale lengths",
  "offset(b, d)         parallel curve, d to the right",
  "circle(b)            bounding circle {cx, cy, r, path, at}",
  "nearest(b, x, y)     nearest point on the path",
  "reverse(b)           leaf arcs last-to-first, same turns",
  "mirror(b, axisDeg?)  flip handedness across start axis",
  "orbit(b, n, deg)     n rotated copies, joined",
  "ref(name)            block from the store",
  "store(name, value)   register anything; relative name → script/name",
  "load(path)           stored value, or {name: value} for a script prefix",
  "script               this script's path",
  "define(name, b)      same as store",
  "forget(name)         drop one stored name",
  "paint(b, {stroke, width, fill})  restyle; width 0 is a move",
  "show(b, {at, heading, stroke, width, fill, name})",
  "connect(from, to, {mode, p, r0, r1, stroke, width, fill, dash})",
  "  from/to = [x, y, heading°]; mode line | biarc | ata; dash shows a move",
  "clear()              remove page uses (store stays)",
  "resetStore()         drop all stored names",
  "list()               stored names",
  "print(...)           log pane",
].join("\n");

export class DrawingRepl {
  constructor() {
    this.dict = new Map();
    this.owners = new Map();
    this.uses = [];
    this.log = [];
    this._scriptId = "";
    this._scriptName = "";
  }

  reset() {
    this.dict = new Map();
    this.owners = new Map();
    this.uses = [];
  }

  note(msg) {
    const line = String(msg);
    this.log.push(line);
    if (this.log.length > 80) this.log.splice(0, this.log.length - 80);
    return line;
  }

  /**
   * Register any value. A relative name is stored under the script path.
   * A name that already contains `/` is used as given.
   */
  qualify(name, scriptName = this._scriptName) {
    const n = String(name || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!n) throw new Error("store: empty name");
    if (n.includes("/")) return n;
    const script = String(scriptName || "").replace(/\\/g, "/").replace(/\/+$/g, "");
    return script ? `${script}/${n}` : n;
  }

  store(name, value) {
    const key = this.qualify(name);
    if (isBlock(value)) value.name = key;
    this.dict.set(key, value);
    if (this._scriptId) this.owners.set(key, this._scriptId);
    return value;
  }

  define(name, value) {
    return this.store(name, value);
  }

  /**
   * Exact key, or every export under a script path as `{ baseName: value }`.
   */
  load(path) {
    const key = String(path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!key) return undefined;
    if (this.dict.has(key)) return this.dict.get(key);
    const prefix = key + "/";
    const bag = {};
    let n = 0;
    for (const [k, v] of this.dict) {
      if (k === key || k.startsWith(prefix)) {
        bag[k.slice(prefix.length) || k] = v;
        n++;
      }
    }
    if (!n) {
      this.note("load: no " + key);
      return undefined;
    }
    return bag;
  }

  forget(name) {
    const key = String(name);
    const ok = this.dict.delete(key);
    this.owners.delete(key);
    if (!ok) this.note("forget: no " + key);
    return ok;
  }

  dropOwned(scriptId) {
    if (!scriptId) return;
    for (const [k, owner] of [...this.owners]) {
      if (owner === scriptId) {
        this.dict.delete(k);
        this.owners.delete(k);
      }
    }
  }

  resetStore() {
    this.dict = new Map();
    this.owners = new Map();
  }

  /**
   * @param {Block | string} block
   * @param {object} [opts]
   */
  show(block, opts = {}) {
    const root =
      typeof block === "string"
        ? this.dict.get(block)
        : asBlock(block);
    if (!root) throw new Error("show: not a block");
    const use = {
      id: opts.id || `u${this.uses.length + 1}`,
      name: opts.name || root.name || "",
      startPoint: Array.isArray(opts.at)
        ? opts.at.map(Number)
        : Array.isArray(opts.startPoint)
          ? opts.startPoint.map(Number)
          : [0, 0],
      startAngle: opts.heading ?? opts.startAngle ?? 0,
      stroke: opts.stroke || "ink",
      width: opts.width == null ? 1.6 : Number(opts.width),
      fill: opts.fill || null,
      root,
    };
    this.uses.push(use);
    return use;
  }

  lookup(name) {
    return this.dict.get(String(name));
  }

  api() {
    const self = this;
    return {
      seg(s, dtheta, fields) {
        return new Arc(s, dtheta, fields);
      },
      turn(dtheta) {
        return new Arc(0, dtheta);
      },
      ah(w, l) {
        return new Ah(w, l);
      },
      seq(...items) {
        return new Seq(items.flat());
      },
      cat(...items) {
        return new Seq(items.flat());
      },
      repeat(b, n) {
        return new Repeat(b, n);
      },
      loop(b, n) {
        return new Repeat(b, n);
      },
      scale(b, k) {
        return new Scale(b, k);
      },
      offset(b, d) {
        return new Offset(b, d);
      },
      paint(b, style) {
        return new Paint(b, style);
      },
      slice(b, from, to) {
        return new Slice(b, from, to);
      },
      circle(b) {
        const block = asBlock(b);
        const bound = block.bound();
        return {
          cx: bound.cx,
          cy: bound.cy,
          r: bound.r,
          path: new Arc(2 * Math.PI * bound.r, 360),
          at: [bound.cx, bound.cy - bound.r],
        };
      },
      nearest(b, x, y) {
        return asBlock(b).nearest(Number(x) || 0, Number(y) || 0);
      },
      reverse(b) {
        return new Reverse(b);
      },
      mirror(b, axisDeg) {
        return new Mirror(b, axisDeg ?? 0);
      },
      orbit(b, n, deg) {
        return new Orbit(b, n, deg);
      },
      connect(from, to, opts) {
        return connectPoses(from, to, opts);
      },
      ref(name) {
        return new Ref(name, (n) => self.dict.get(n));
      },
      store(name, value) {
        return self.store(name, value);
      },
      define(name, value) {
        return self.store(name, value);
      },
      load(path) {
        return self.load(path);
      },
      get script() {
        return self._scriptName;
      },
      forget(name) {
        return self.forget(name);
      },
      show(b, opts) {
        return self.show(b, opts);
      },
      clear() {
        self.uses = [];
      },
      resetStore() {
        self.resetStore();
        self.note("store cleared");
      },
      list() {
        const names = [...self.dict.keys()];
        self.note(names.join(" ") || "(empty)");
        return names;
      },
      help() {
        self.note(API_HELP);
        return API_HELP;
      },
      print(...args) {
        self.note(args.map(describe).join(" "));
      },
    };
  }

  /**
   * Run `src` against the existing store.
   * Uses previously shown by this scriptId are replaced.
   * On throw, restore dict and uses.
   */
  run(src, { scriptId = "", scriptName = "" } = {}) {
    const prevDict = new Map(this.dict);
    const prevOwners = new Map(this.owners);
    const prevUses = this.uses.slice();
    const prevId = this._scriptId;
    const prevName = this._scriptName;
    this.dropOwned(scriptId);
    if (scriptId) this.uses = this.uses.filter((u) => u.scriptId !== scriptId);
    this._scriptId = scriptId;
    this._scriptName = scriptName;
    const api = this.api();
    const names = Object.keys(api);
    const markedFrom = this.uses.length;
    try {
      const fn = new Function(...names, `"use strict";\n${src}\n`);
      fn(...names.map((k) => api[k]));
      if (scriptId) {
        for (let i = markedFrom; i < this.uses.length; i++) {
          this.uses[i].scriptId = scriptId;
        }
      }
      this.note(
        `ok · ${this.dict.size} stored · ${this.uses.length} shown · ${this.totalArcs()} arcs`,
      );
    } catch (err) {
      this.dict = prevDict;
      this.owners = prevOwners;
      this.uses = prevUses;
      this._scriptId = prevId;
      this._scriptName = prevName;
      this.note("err " + (err && err.message ? err.message : String(err)));
      throw err;
    }
  }

  totalArcs() {
    let n = 0;
    for (const use of this.uses) {
      try {
        n += use.root.arcCount();
      } catch {
        /* ignore */
      }
    }
    return n;
  }

  flattenUse(use) {
    const tagged = use.root.flatten({ paint: usePaint(use) });
    return {
      id: use.id,
      name: use.name,
      startPoint: use.startPoint.slice(),
      startAngle: use.startAngle,
      stroke: use.stroke,
      width: use.width,
      fill: use.fill,
      turtlePath: tagged.map(([s, da]) => [s, da]),
      tagged,
      interface: use.root.interface(),
    };
  }

  flattened() {
    return this.uses.map((u) => this.flattenUse(u));
  }

  namedList() {
    return [...this.dict.entries()].map(([name, value]) => describeStored(name, value));
  }
}

function describeStored(name, value) {
  if (isBlock(value)) {
    return {
      name,
      type: value.type,
      id: value.id,
      interface: value.interface(),
      arcs: value.arcCount(),
      length: value.length(),
      text: value.describe(),
    };
  }
  const type = value == null ? "null" : Array.isArray(value) ? "array" : typeof value;
  const label = type === "function" ? value.name || "function" : type;
  return {
    name,
    type: label,
    id: "",
    interface: null,
    arcs: "",
    length: "",
    text: `${label} ${name}`,
  };
}

export function describe(v) {
  if (v == null) return String(v);
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (isBlock(v)) return v.describe();
  if (v && v.root instanceof Block) {
    return `use ${v.id} ${v.root.describe()}`;
  }
  if (v && typeof v === "object") {
    const bits = Object.entries(v)
      .filter(([, val]) => typeof val !== "object")
      .map(([k, val]) => `${k}=${typeof val === "number" ? Number(val.toFixed(4)) : val}`);
    if (bits.length) return bits.join(" ");
  }
  return String(v);
}

export function newScript(name = "Script", text = "") {
  return {
    id: "s" + Math.random().toString(36).slice(2, 8),
    name,
    text,
  };
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("arc-drawing-repl-v1");
    if (!raw) {
      return {
        scripts: [newScript("spoke", DEFAULT_SCRIPT)],
        active: 0,
      };
    }
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.scripts) && data.scripts.length) {
      return {
        scripts: data.scripts.map((s, i) => ({
          id: s.id || "s" + i,
          name: s.name || "Script " + (i + 1),
          text: String(s.text || ""),
        })),
        active: clampIndex(data.active, data.scripts.length),
      };
    }
    if (data && typeof data.script === "string") {
      return { scripts: [newScript("Script", data.script)], active: 0 };
    }
  } catch {
    /* ignore */
  }
  return { scripts: [newScript("spoke", DEFAULT_SCRIPT)], active: 0 };
}

export function saveSession(session) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scripts: session.scripts.map((s) => ({ id: s.id, name: s.name, text: s.text })),
        active: session.active,
        saved: Date.now(),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

function usePaint(use) {
  return {
    stroke: use.stroke || "ink",
    width: use.width == null ? 1.6 : use.width,
    fill: use.fill || null,
  };
}

function clampIndex(i, n) {
  const v = Number(i);
  if (!n) return 0;
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(n - 1, v | 0));
}
