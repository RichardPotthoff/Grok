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
  Scale,
  Seq,
  asBlock,
  isBlock,
} from "./blocks.js";

export const STORAGE_KEY = "arc-drawing-repl-v1";

export const DEFAULT_SCRIPT = `// Spoke × 4  (same moves as the Forth pan example)
const spoke = seq(
  seg(1, 0),
  ah(1, -2),
  seg(0, 180),
  seg(1, 0),
  seg(0, 90),
);
define("spoke", spoke);
show(repeat(spoke, 4));
`;

export const API_HELP = [
  "seg(s, dθ)           one arc — degrees",
  "turn(dθ)             hinge, s = 0",
  "ah(w, l)             arrowhead (Python AH)",
  "seq(a, b, …) / cat   relative concatenate",
  "repeat(b, n) / loop  replay moves n times",
  "scale(b, k)          scale lengths",
  "mirror(b, axisDeg?)  flip handedness",
  "orbit(b, n, deg)     n rotated copies, joined",
  "ref(name)            named block",
  "define(name, b)      publish to the object list",
  "show(b, {at, heading, stroke, width, fill, name})",
  "clear()              remove page uses",
  "list()               defined names",
  "print(...)           log pane",
].join("\n");

export class DrawingRepl {
  constructor() {
    this.dict = new Map();
    this.uses = [];
    this.log = [];
  }

  reset() {
    this.dict = new Map();
    this.uses = [];
  }

  note(msg) {
    const line = String(msg);
    this.log.push(line);
    if (this.log.length > 80) this.log.splice(0, this.log.length - 80);
    return line;
  }

  /**
   * @param {string} name
   * @param {Block} block
   */
  define(name, block) {
    const key = String(name);
    if (!key) throw new Error("define: empty name");
    const b = asBlock(block);
    b.name = key;
    this.dict.set(key, b);
    return b;
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
      seg(s, dtheta) {
        return new Arc(s, dtheta);
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
      mirror(b, axisDeg) {
        return new Mirror(b, axisDeg ?? 0);
      },
      orbit(b, n, deg) {
        return new Orbit(b, n, deg);
      },
      ref(name) {
        return new Ref(name, (n) => self.dict.get(n));
      },
      define(name, b) {
        return self.define(name, b);
      },
      show(b, opts) {
        return self.show(b, opts);
      },
      clear() {
        self.uses = [];
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
   * Run `src` from an empty dictionary and page.
   * On throw, restore the previous dict/uses and rethrow.
   */
  run(src) {
    const prevDict = this.dict;
    const prevUses = this.uses;
    this.reset();
    const api = this.api();
    const names = Object.keys(api);
    try {
      const fn = new Function(...names, `"use strict";\n${src}\n`);
      fn(...names.map((k) => api[k]));
      this.note(
        `ok · ${this.dict.size} named · ${this.uses.length} shown · ${this.totalArcs()} arcs`,
      );
    } catch (err) {
      this.dict = prevDict;
      this.uses = prevUses;
      this.note("err " + (err && err.message ? err.message : String(err)));
      throw err;
    }
  }

  totalArcs() {
    let n = 0;
    for (const use of this.uses) {
      try {
        n += use.root.turtlePath().length;
      } catch {
        /* ignore */
      }
    }
    return n;
  }

  flattenUse(use) {
    const tagged = use.root.flatten({ k: 0 });
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
    return [...this.dict.entries()].map(([name, block]) => ({
      name,
      type: block.type,
      id: block.id,
      interface: block.interface(),
      arcs: block.turtlePath().length,
      text: block.describe(),
    }));
  }
}

export function describe(v) {
  if (v == null) return String(v);
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (isBlock(v)) return v.describe();
  if (v && v.root instanceof Block) {
    return `use ${v.id} ${v.root.describe()}`;
  }
  return String(v);
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { script: DEFAULT_SCRIPT };
    const data = JSON.parse(raw);
    if (data && typeof data.script === "string") return { script: data.script };
  } catch {
    /* ignore */
  }
  return { script: DEFAULT_SCRIPT };
}

export function saveSession(script) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ script: String(script), saved: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}
