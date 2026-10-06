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
  asBlock,
  isBlock,
} from "./blocks.js";

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

export const API_HELP = [
  "seg(s, dθ)           one arc — degrees",
  "turn(dθ)             hinge, s = 0",
  "ah(w, l)             arrowhead (Python AH)",
  "seq(a, b, …) / cat   relative concatenate",
  "repeat(b, n) / loop  replay moves n times",
  "scale(b, k)          scale lengths",
  "reverse(b)           leaf arcs last-to-first, same turns",
  "mirror(b, axisDeg?)  flip handedness across start axis",
  "orbit(b, n, deg)     n rotated copies, joined",
  "ref(name)            block from the store",
  "store(name, b)       keep in the global object list",
  "define(name, b)      same as store",
  "forget(name)         drop one stored name",
  "show(b, {at, heading, stroke, width, fill, name})",
  "clear()              remove page uses (store stays)",
  "resetStore()         drop all stored names",
  "list()               stored names",
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
  store(name, block) {
    const key = String(name);
    if (!key) throw new Error("store: empty name");
    const b = asBlock(block);
    b.name = key;
    this.dict.set(key, b);
    return b;
  }

  define(name, block) {
    return this.store(name, block);
  }

  forget(name) {
    const key = String(name);
    const ok = this.dict.delete(key);
    if (!ok) this.note("forget: no " + key);
    return ok;
  }

  resetStore() {
    this.dict = new Map();
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
      reverse(b) {
        return new Reverse(b);
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
      store(name, b) {
        return self.store(name, b);
      },
      define(name, b) {
        return self.store(name, b);
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
  run(src, { scriptId = "" } = {}) {
    const prevDict = new Map(this.dict);
    const prevUses = this.uses.slice();
    if (scriptId) this.uses = this.uses.filter((u) => u.scriptId !== scriptId);
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
      this.uses = prevUses;
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
      arcs: block.arcCount(),
      length: block.length(),
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

function clampIndex(i, n) {
  const v = Number(i);
  if (!n) return 0;
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(n - 1, v | 0));
}
