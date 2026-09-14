/**
 * Touch-first turtle path editor.
 * Coordinates are math (y-up). Canvas is flipped at draw time.
 *
 *   const ed = new CurveEditor(canvas, { outline, onChange, onSelect });
 *   ed.setOutline(outline);
 *   ed.insertSegment();
 *   ed.deleteSegment();
 *   ed.destroy();
 *
 * Drag a handle to edit that segment. Drag the red end-dot to append.
 * Insert / Delete are methods — the HTML chrome just calls them.
 */

import { walkPath, boundsOf, fitArc, DEG } from "./path-utils.js";
import { closePath, closureInfo, CLOSE_MODES } from "./close-path.js";
import {
  applyBiarc,
  applyVertexStable,
  recoverP,
  splitSeg,
  pairIdx,
  quadIdx,
  jointPose,
  locusCircle,
  projectToCircle,
  extractSpan,
  commitSpan,
  cloneOutline,
  spanCollapsed,
  arr,
  xy,
} from "./biarc.js";

export const EDITOR_TOOLS = ["select", "add", "pan", "arc", "p", "locus", "move", "tan"];
export const TOOL_ALIAS = { vertex: "move" };
export const SPAN2 = new Set(["p", "locus"]);
export const SPAN4 = new Set(["move", "tan"]);
export const JOINT_LOCK = new Set(["p", "locus", "move", "tan"]);

const HIT_PX = 26;
const ADD_PX = 22;
const SLOP_PX = 10;
const STEM_PX = 24;

export class CurveEditor {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onChange = opts.onChange || (() => {});
    this.onSelect = opts.onSelect || (() => {});
    this.outline = normalizeOutline(opts.outline);
    const n = this.outline.turtlePath.length;
    this.editIdx = opts.editIdx ?? (n ? n - 1 : -1);
    this.view = { cx: 0, cy: 0, scale: 12 };
    this._drag = null;
    this._pointers = new Map();
    this._pinch = null;
    this._raf = 0;
    this._ro = null;
    this._moved = false;
    this.tool = opts.tool || "select";
    this.onTool = opts.onTool || (() => {});
    this.closeMode = CLOSE_MODES.includes(opts.closeMode) ? opts.closeMode : "ends";
    const n0 = this.outline.turtlePath.length;
    this.joint = n0;
    this.pVal = 1;
    this._base = null;
    this._span = null;
    this.onLog = opts.onLog || (() => {});
    this._hist = [{ t: Date.now(), kind: "load", summary: "load", outline: this.getOutline() }];
    this._histAt = 0;
    this._notes = [];

    this._onPtrDown = this._onPtrDown.bind(this);
    this._onPtrMove = this._onPtrMove.bind(this);
    this._onPtrUp = this._onPtrUp.bind(this);
    this._onWheel = this._onWheel.bind(this);

    canvas.style.touchAction = "none";
    this._onTouchGuard = (ev) => ev.preventDefault();
    canvas.addEventListener("touchstart", this._onTouchGuard, { passive: false });
    canvas.addEventListener("gesturestart", this._onTouchGuard, { passive: false });
    canvas.addEventListener("pointerdown", this._onPtrDown);
    canvas.addEventListener("pointermove", this._onPtrMove);
    canvas.addEventListener("pointerup", this._onPtrUp);
    canvas.addEventListener("pointercancel", this._onPtrUp);
    canvas.addEventListener("wheel", this._onWheel, { passive: false });

    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this.redraw());
      this._ro.observe(canvas);
    }
    this._mountTools();
    this.fit();
    this.redraw();
  }

  setTool(name) {
    const raw = TOOL_ALIAS[name] || name;
    const tool = EDITOR_TOOLS.includes(raw) ? raw : "select";
    if (this.tool === tool) {
      this._syncToolButtons();
      return this.tool;
    }
    this.tool = tool;
    this._syncToolButtons();
    this.onTool(this.tool);
    this.redraw();
    return this.tool;
  }

  getTool() {
    return this.tool;
  }

  setCloseMode(mode) {
    const next = CLOSE_MODES.includes(mode) ? mode : "ends";
    this.closeMode = next;
    const sel = this._tools?.querySelector("[data-close-mode]");
    if (sel) sel.value = next;
    return this.closeMode;
  }

  splitSegment(at) {
    const n = this.outline.turtlePath.length;
    const i = at == null ? (this.editIdx >= 0 ? this.editIdx : n - 1) : at;
    const next = splitSeg(this.outline, i);
    this.outline = next;
    this.editIdx = i;
    this.joint = i + 1;
    this.redraw();
    this.onSelect(this.editIdx);
    this._commit("split");
    return this.editIdx;
  }

  closePath(opts = {}) {
    const mode = opts.mode || this.closeMode || "ends";
    const next = closePath(this.outline, { smooth: opts.smooth !== false, mode });
    this.outline = next;
    const n = this.outline.turtlePath.length;
    this.editIdx = n ? n - 1 : -1;
    this.redraw();
    this.onSelect(this.editIdx);
    this._commit(`close ${mode}`);
    return closureInfo(this.outline);
  }

  closureInfo() {
    return closureInfo(this.outline);
  }

  setOutline(outline, { fit = false, keepSelection = true, commit = false } = {}) {
    this.outline = normalizeOutline(outline);
    const n = this.outline.turtlePath.length;
    if (!keepSelection || this.editIdx >= n) this.editIdx = n ? n - 1 : -1;
    if (fit) this.fit();
    this.redraw();
    if (commit) this._commit(typeof commit === "string" ? commit : "set", { reset: commit === "load" });
  }

  setSelected(idx) {
    const n = this.outline.turtlePath.length;
    this.editIdx = n === 0 ? -1 : Math.max(-1, Math.min(idx, n - 1));
    if (this.editIdx >= 0) this.joint = this.editIdx + 1;
    this.redraw();
    this.onSelect(this.editIdx);
  }

  span() {
    const n = this.outline.turtlePath.length;
    if (n <= 0 || this.editIdx < 0) return [];
    if (SPAN4.has(this.tool)) return quadIdx(this.joint, n) || [this.editIdx];
    if (SPAN2.has(this.tool)) return pairIdx(this.joint, n) || [this.editIdx];
    return [this.editIdx];
  }

  getSelected() {
    return this.editIdx;
  }

  getOutline() {
    return {
      name: this.outline.name,
      startPoint: this.outline.startPoint.slice(),
      startAngle: this.outline.startAngle,
      turtlePath: this.outline.turtlePath.map(([l, a]) => [l, a]),
    };
  }

  getLog() {
    return this._notes.slice();
  }

  noteFromHost(kind, summary, extra = {}) {
    return this._note(kind, summary, extra);
  }

  canUndo() {
    return this._histAt > 0;
  }

  undo() {
    if (!this.canUndo()) return false;
    const last = this._hist[this._histAt];
    this._histAt -= 1;
    this.outline = normalizeOutline(this._hist[this._histAt].outline);
    this._note("undo", last?.summary || "edit", { replay: this._histAt });
    this.redraw();
    this.onSelect(this.editIdx);
    this.onChange(this.getOutline());
    return true;
  }

  _note(kind, summary, extra = {}) {
    const row = {
      t: Date.now(),
      kind,
      summary,
      tool: this.tool,
      joint: this.joint,
      extra,
    };
    const last = this._notes[this._notes.length - 1];
    if (last?.kind === "live" && (kind === "live" || kind === "edit" || kind === "reject")) {
      this._notes[this._notes.length - 1] = row;
    } else {
      this._notes.push(row);
    }
    if (this._notes.length > 250) this._notes.shift();
    this.onLog(this.getLog());
    return row;
  }

  _describeChange(before, after) {
    if (!before || !after) return this.tool;
    const bits = [`${this.tool} j=${this.joint}`];
    const sp0 = before.startPoint || [0, 0];
    const sp1 = after.startPoint || [0, 0];
    if (Math.hypot(sp1[0] - sp0[0], sp1[1] - sp0[1]) > 1e-4 || Math.abs((after.startAngle ?? 0) - (before.startAngle ?? 0)) > 1e-3) {
      bits.push(`start (${fmtN(sp1[0], 2)},${fmtN(sp1[1], 2)}) θ=${fmtN(after.startAngle, 1)}°`);
    }
    const a = before.turtlePath || [];
    const b = after.turtlePath || [];
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const u = a[i];
      const v = b[i];
      if (!u && v) {
        bits.push(`#${i + 1} +[${fmtN(v[0], 2)},${fmtN(v[1], 1)}]`);
        continue;
      }
      if (u && !v) {
        bits.push(`#${i + 1} del`);
        continue;
      }
      if (!u || !v) continue;
      if (Math.abs(u[0] - v[0]) < 1e-4 && Math.abs(u[1] - v[1]) < 1e-3) continue;
      bits.push(`#${i + 1} s ${fmtN(u[0], 2)}→${fmtN(v[0], 2)}  Δθ ${fmtN(u[1], 1)}→${fmtN(v[1], 1)}`);
    }
    const bi = after._biarc;
    if (bi?.pR != null) bits.push(`pL ${fmtP(bi.pL)} pR ${fmtP(bi.pR)}`);
    else if (bi?.p != null) bits.push(`p ${fmtP(bi.p)}`);
    return bits.join(" · ");
  }

  _commit(summary, { reset = false, extra = {} } = {}) {
    const outline = this.getOutline();
    if (reset) {
      this._hist = [{ t: Date.now(), kind: "load", summary, outline }];
      this._histAt = 0;
    } else {
      this._hist = this._hist.slice(0, this._histAt + 1);
      this._hist.push({ t: Date.now(), kind: "edit", summary, outline });
      this._histAt = this._hist.length - 1;
    }
    this._note(reset ? "load" : "edit", summary, extra);
    this.onChange(outline);
  }

  _spanIdx() {
    const n = this.outline.turtlePath.length;
    if (SPAN4.has(this.tool)) return quadIdx(this.joint, n);
    if (SPAN2.has(this.tool)) return pairIdx(this.joint, n);
    return null;
  }

  _beginSpan() {
    const idx = this._spanIdx();
    if (!idx) {
      this._base = null;
      this._span = null;
      return null;
    }
    this._base = cloneOutline(this.outline);
    this._span = extractSpan(this._base, idx);
    this._span0 = this.getOutline();
    this._liveSummary = "";
    return this._span;
  }

  _previewSpan(nextSpan) {
    if (!this._base || !nextSpan) return false;
    if (spanCollapsed(this._span || this._base, nextSpan, nextSpan.indices.map((_, i) => i))) {
      this._note("reject", "collapsed span", {
        p: nextSpan._biarc?.p ?? nextSpan._biarc?.pL,
        pR: nextSpan._biarc?.pR,
      });
      return false;
    }
    this._span = nextSpan;
    this.outline = commitSpan(this._base, this._span);
    this._liveSummary = this._describeChange(this._span0 || this._base, this.outline);
    this._note("live", this._liveSummary, {
      p: nextSpan._biarc?.p ?? nextSpan._biarc?.pL,
      pR: nextSpan._biarc?.pR,
    });
    return true;
  }

  _endSpan(didEdit) {
    const summary = this._liveSummary || this.tool;
    this._base = null;
    this._span = null;
    this._span0 = null;
    this._liveSummary = "";
    if (didEdit) this._commit(summary);
  }

  insertSegment(at) {
    const n = this.outline.turtlePath.length;
    const i = at == null ? (this.editIdx >= 0 ? this.editIdx + 1 : n) : at;
    const clamped = Math.max(0, Math.min(i, n));
    this.outline.turtlePath.splice(clamped, 0, [4, 0]);
    this.editIdx = clamped;
    this.redraw();
    this.onSelect(this.editIdx);
    this._commit("insert");
    return this.editIdx;
  }

  deleteSegment(at) {
    const n = this.outline.turtlePath.length;
    if (!n) return -1;
    const i = at == null ? (this.editIdx >= 0 ? this.editIdx : n - 1) : at;
    if (i < 0 || i >= n) return this.editIdx;
    this.outline.turtlePath.splice(i, 1);
    const m = this.outline.turtlePath.length;
    this.editIdx = m ? Math.min(i, m - 1) : -1;
    this.redraw();
    this.onSelect(this.editIdx);
    this._commit("delete");
    return this.editIdx;
  }

  fit() {
    const samples = walkPath(this.outline, { scale: 1, tol: 0.08, returnStart: true });
    const pts = samples.map((s) => s.point);
    if (!pts.length) pts.push([0, 0]);
    const b = boundsOf(pts);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 40);
    const h = Math.max(rect.height, 40);
    const pad = 0.78;
    this.view.cx = b.cx;
    this.view.cy = b.cy;
    this.view.scale = Math.min((w * pad) / b.w, (h * pad) / b.h);
    this.view.scale = Math.max(4, Math.min(this.view.scale, 80));
    this.redraw();
  }

  destroy() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this._onPtrDown);
    c.removeEventListener("pointermove", this._onPtrMove);
    c.removeEventListener("pointerup", this._onPtrUp);
    c.removeEventListener("pointercancel", this._onPtrUp);
    c.removeEventListener("wheel", this._onWheel);
    c.removeEventListener("touchstart", this._onTouchGuard);
    c.removeEventListener("gesturestart", this._onTouchGuard);
    this._ro?.disconnect();
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._shell?.parentElement) {
      this._shell.parentElement.insertBefore(c, this._shell);
      this._shell.remove();
    }
    this._tools?.remove();
    this._status?.remove();
  }

  _mountTools() {
    const parent = this.canvas.parentElement;
    if (!parent || this._tools) return;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";

    if (!document.getElementById("curve-editor-tools-css")) {
      const style = document.createElement("style");
      style.id = "curve-editor-tools-css";
      style.textContent = `
        .curve-shell {
          display: flex; flex-direction: row; align-items: stretch;
          width: 100%; height: 100%; min-height: 0;
        }
        .curve-tools {
          flex: 0 0 56px; display: flex; flex-direction: column; gap: 3px;
          padding: 6px 4px; overflow: auto;
          background: #1c1b18;
          border-right: 1px solid color-mix(in oklab, #ece7dc 16%, transparent);
          -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
        }
        .curve-stage { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; }
        .curve-stage canvas { width: 100%; height: 100%; display: block; }
        .curve-tools .grp { display: flex; flex-direction: column; gap: 3px; }
        .curve-tools .gap { height: 8px; }
        .curve-tools button, .curve-tools select, .curve-tools input {
          font: 600 11px/1.1 system-ui, sans-serif;
          min-height: 32px; width: 100%;
          padding: 4px 2px; border-radius: 7px;
          border: 1px solid color-mix(in oklab, #ece7dc 18%, transparent);
          background: #12110f; color: #ece7dc;
        }
        .curve-tools button[aria-pressed="true"] {
          background: #7a9e96; color: #12110f; border-color: transparent;
        }
        .curve-tools button.action { font-weight: 700; }
        .curve-tools input { text-align: center; }
        .curve-close-status {
          position: absolute; left: 8px; top: 8px; z-index: 3;
          font: 11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #6b3b32; background: color-mix(in oklab, #f3ead8 80%, transparent);
          border-radius: 6px; padding: 3px 7px; pointer-events: none;
        }
        .curve-close-status.ok { color: #2f7a4a; }
      `;
      document.head.appendChild(style);
    }

    const bar = document.createElement("div");
    bar.className = "curve-tools";
    bar.innerHTML = `
      <div class="grp">
        <button type="button" data-tool="pan" title="Pan view">Pan</button>
        <button type="button" data-action="fit" title="Fit path in view">Fit</button>
      </div>
      <div class="gap"></div>
      <div class="grp">
        <button type="button" data-tool="select" title="Select only">Select</button>
        <button type="button" data-tool="add" title="Add arc">Add</button>
        <button type="button" data-tool="arc" title="Edit one arc">Arc</button>
        <button type="button" data-tool="p" title="Biarc family p">p</button>
        <input data-pval type="number" step="0.1" value="1" title="p" />
        <button type="button" data-tool="locus" title="Drag junction on locus">Locus</button>
        <button type="button" data-tool="move" title="Move joint, keep heading">Move</button>
        <button type="button" data-tool="tan" title="Rotate heading, keep joint">Tan</button>
      </div>
      <div class="gap"></div>
      <div class="grp">
        <select data-close-mode title="Close method">
          <option value="ends">Ends</option>
          <option value="last-two">Tail</option>
          <option value="append">Cap</option>
          <option value="spread">Sprd</option>
          <option value="corner">Corn</option>
        </select>
        <button type="button" data-action="close" class="action" title="Close path">Close</button>
        <button type="button" data-action="split" title="Split selected arc">Split</button>
        <button type="button" data-action="insert" title="Insert dummy arc">Ins</button>
        <button type="button" data-action="del" title="Delete selected arc">Del</button>
        <button type="button" data-action="undo" title="Undo last committed edit">Undo</button>
      </div>
    `;
    bar.addEventListener("pointerdown", (e) => e.stopPropagation());
    bar.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.tool) this.setTool(btn.dataset.tool);
      if (btn.dataset.action === "close") this.closePath({ mode: this.closeMode });
      if (btn.dataset.action === "split") this.splitSegment();
      if (btn.dataset.action === "insert") this.insertSegment();
      if (btn.dataset.action === "del") this.deleteSegment();
      if (btn.dataset.action === "fit") this.fit();
      if (btn.dataset.action === "undo") this.undo();
    });
    const modeSel = bar.querySelector("[data-close-mode]");
    if (modeSel) {
      modeSel.value = this.closeMode;
      modeSel.addEventListener("change", () => this.setCloseMode(modeSel.value));
    }
    const pIn = bar.querySelector("[data-pval]");
    if (pIn) {
      pIn.addEventListener("change", () => {
        const v = Number(pIn.value);
        if (!Number.isFinite(v)) return;
        this.pVal = v;
        if (SPAN2.has(this.tool) || this.tool === "p") {
          this._beginSpan();
          const localJ = 1;
          const next = applyBiarc(this._span || this.outline, localJ, { p: v });
          if (this._span) this._previewSpan(next);
          else this.outline = next;
          this._endSpan(true);
          this.redraw();
        }
      });
    }
    const shell = document.createElement("div");
    shell.className = "curve-shell";
    const stage = document.createElement("div");
    stage.className = "curve-stage";
    parent.insertBefore(shell, this.canvas);
    shell.appendChild(bar);
    shell.appendChild(stage);
    stage.appendChild(this.canvas);
    this._shell = shell;
    this._tools = bar;

    const status = document.createElement("div");
    status.className = "curve-close-status";
    stage.appendChild(status);
    this._status = status;
    this._syncToolButtons();
  }

  _syncToolButtons() {
    if (!this._tools) return;
    this._tools.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.tool === this.tool ? "true" : "false");
    });
  }

  _syncStatus(info) {
    if (!this._status) return;
    if (!info || info.n === 0) {
      this._status.textContent = "";
      return;
    }
    const bi = this.outline._biarc;
    const pBit = bi
      ? bi.pR != null
        ? ` · pL ${fmtP(bi.pL)} pR ${fmtP(bi.pR)}`
        : ` · p ${fmtP(bi.p)}`
      : "";
    if (info.g1) {
      this._status.className = "curve-close-status ok";
      this._status.textContent = "closed · G1" + pBit;
      return;
    }
    this._status.className = "curve-close-status";
    const gap = info.gap < 0.001 ? info.gap.toExponential(2) : info.gap.toFixed(3);
    this._status.textContent = `gap ${gap} · Δθ ${info.dHeadingDeg.toFixed(2)}°` + pBit;
  }

  worldFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left - rect.width / 2;
    const sy = e.clientY - rect.top - rect.height / 2;
    return [
      this.view.cx + sx / this.view.scale,
      this.view.cy - sy / this.view.scale,
    ];
  }

  _onPtrDown(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._moved = false;

    if (this._pointers.size === 2) {
      const pts = [...this._pointers.values()];
      this._pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        scale: this.view.scale,
      };
      this._drag = null;
      return;
    }

    if (e.button === 1 || e.shiftKey || e.altKey || this.tool === "pan") {
      this._drag = { mode: "pan", x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy };
      return;
    }

    const world = this.worldFromEvent(e);
    const samples = walkPath(this.outline, { scale: 1, tol: 0.04, returnStart: true });
    const vertices = vertexList(samples, this.outline);
    const tol = HIT_PX / this.view.scale;
    const addPt = addHandlePoint(samples, ADD_PX / this.view.scale);
    const hitAdd = this.tool === "add" && addPt && Math.hypot(addPt[0] - world[0], addPt[1] - world[1]) < tol;
    const hitV = hitVertex(vertices, world, tol);
    const n = this.outline.turtlePath.length;

    let idx = this.editIdx;
    let append = false;
    const lockJoint = JOINT_LOCK.has(this.tool);

    if (this.tool === "add" && (hitAdd || hitV < 0)) {
      this.outline.turtlePath.push([0, 0]);
      idx = this.outline.turtlePath.length - 1;
      append = true;
    } else if (hitV >= 0) {
      idx = hitV === 0 ? 0 : hitV - 1;
    } else if (!lockJoint) {
      const hitSeg = hitSegment(samples, world, tol * 1.4);
      if (hitSeg >= 0) {
        idx = hitSeg;
      } else {
        this._drag = { mode: "pan", x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy };
        return;
      }
    } else {
      const hitSeg = hitSegment(samples, world, tol * 1.4);
      if (hitSeg < 0) {
        this._drag = { mode: "pan", x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy };
        return;
      }
    }

    if (!lockJoint || hitV >= 0 || append) {
      this.editIdx = idx;
      this.joint = hitV >= 0 ? hitV : idx + 1;
      this.onSelect(idx);
    }

    if (this.tool === "select") {
      this._drag = { mode: "maybe-pan", x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy };
      this.redraw();
      return;
    }
    if (this.tool === "p") {
      this.pVal = recoverP(this.outline, this.joint);
      const pIn = this._tools?.querySelector("[data-pval]");
      if (pIn) pIn.value = String(roundN(this.pVal, 3));
      this._drag = { mode: "maybe-pan", x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy };
      this.redraw();
      return;
    }

    const startState = stateBefore(this.outline, idx);
    const endPt = vertices[idx + 1] || vertices[vertices.length - 1];
    if (this.tool === "arc" || this.tool === "add") {
      this._span0 = this.getOutline();
      this._drag = {
        mode: "edit",
        idx,
        append,
        start: startState.point,
        heading: startState.heading,
        ox: endPt[0] - world[0],
        oy: endPt[1] - world[1],
        sx: e.clientX,
        sy: e.clientY,
        armed: false,
      };
      this.redraw();
      return;
    }
    if (this.tool === "locus") {
      this._beginSpan();
      const loc = locusCircle(this.outline, this.joint);
      const Pm = loc?.Pm ? arr(loc.Pm) : jointPose(this.outline, this.joint === n ? 0 : this.joint).point;
      this._drag = {
        mode: "locus",
        j: this.joint,
        localJ: 1,
        loc,
        ox: Pm[0] - world[0],
        oy: Pm[1] - world[1],
        sx: e.clientX,
        sy: e.clientY,
        armed: false,
      };
      this.redraw();
      return;
    }
    if (SPAN4.has(this.tool)) {
      this._beginSpan();
      const jp = jointPose(this.outline, this.joint === n ? 0 : this.joint);
      const tick = STEM_PX / this.view.scale;
      const tx = jp.point[0] + Math.cos(jp.heading) * tick;
      const ty = jp.point[1] + Math.sin(jp.heading) * tick;
      const tangent = this.tool === "tan";
      const q = quadIdx(this.joint, n);
      this._pL = q ? recoverP(this.outline, q[1]) : 1;
      this._pR = q ? recoverP(this.outline, q[3]) : 1;
      const hx = tangent ? tx : jp.point[0];
      const hy = tangent ? ty : jp.point[1];
      this._drag = {
        mode: tangent ? "tangent" : "vertex",
        j: this.joint,
        localJ: 2,
        P: jp.point.slice(),
        θ: jp.heading,
        ox: hx - world[0],
        oy: hy - world[1],
        sx: e.clientX,
        sy: e.clientY,
        armed: false,
      };
      this.redraw();
      return;
    }

    this._drag = { mode: "maybe-pan", x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy };
    this.redraw();
  }

  _onPtrMove(e) {
    if (this._pointers.has(e.pointerId)) {
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this._pointers.size >= 2 && this._pinch) {
      const pts = [...this._pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.view.scale = Math.max(2, Math.min(120, this._pinch.scale * (dist / Math.max(this._pinch.dist, 1))));
      this.redraw();
      return;
    }

    if (!this._drag) return;
    this._moved = true;

    if (this._drag.mode === "pan") {
      const dx = e.clientX - this._drag.x;
      const dy = e.clientY - this._drag.y;
      this.view.cx = this._drag.cx - dx / this.view.scale;
      this.view.cy = this._drag.cy + dy / this.view.scale;
      this.redraw();
      return;
    }

    if (this._drag.mode === "maybe-pan") {
      const d = Math.hypot(e.clientX - this._drag.x, e.clientY - this._drag.y);
      if (d < SLOP_PX) return;
      this._drag = { mode: "pan", x: this._drag.x, y: this._drag.y, cx: this._drag.cx, cy: this._drag.cy };
      return;
    }

    if (this._drag.armed === false) {
      const d = Math.hypot(e.clientX - this._drag.sx, e.clientY - this._drag.sy);
      if (d < SLOP_PX) return;
      this._drag.armed = true;
    }

    const raw = this.worldFromEvent(e);
    const world = [raw[0] + (this._drag.ox || 0), raw[1] + (this._drag.oy || 0)];
    try {
      if (this._drag.mode === "locus") {
        const loc = this._drag.loc;
        let P = xy(world);
        if (loc?.c && Number.isFinite(loc.r)) P = projectToCircle(loc.c, loc.r, P);
        const src = this._span || this.outline;
        const j = this._span ? this._drag.localJ : this._drag.j;
        const next = applyBiarc(src, j, { P });
        if (this._span) this._previewSpan(next);
        else this.outline = next;
        this.redraw();
        return;
      }
      if (this._drag.mode === "vertex") {
        this._drag.P = world.slice();
        const src = this._span || this.outline;
        const j = this._span ? this._drag.localJ : this._drag.j;
        const next = applyVertexStable(src, j, this._drag.P, this._drag.θ, this._pL, this._pR);
        if (this._span) this._previewSpan(next);
        else this.outline = next;
        this.redraw();
        return;
      }
      if (this._drag.mode === "tangent") {
        const P = this._drag.P;
        this._drag.θ = Math.atan2(world[1] - P[1], world[0] - P[0]);
        const src = this._span || this.outline;
        const j = this._span ? this._drag.localJ : this._drag.j;
        const next = applyVertexStable(src, j, P, this._drag.θ, this._pL, this._pR);
        if (this._span) this._previewSpan(next);
        else this.outline = next;
        this.redraw();
        return;
      }
      if (this._drag.mode !== "edit") return;
      const { len, ang } = fitArc(this._drag.start, this._drag.heading, world);
      const idx = this._drag.idx;
      if (idx >= 0) {
        this.outline.turtlePath[idx] = [roundN(len, 4), roundN(ang, 3)];
        this._liveSummary = this._describeChange(this._span0 || this.outline, this.outline);
        this._note("live", this._liveSummary);
      }
    } catch (err) {
      this._note("err", err?.message || String(err), { stack: err?.stack });
    }
    this.redraw();
  }

  _onPtrUp(e) {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) this._pinch = null;
    const mode = this._drag?.mode;
    const edited = mode && mode !== "pan" && mode !== "maybe-pan" && this._drag.armed !== false;
    if (mode === "edit" && this._drag.append) {
      const segs = this.outline.turtlePath;
      const idx = this._drag.idx;
      const last = segs[idx];
      if (last && Math.abs(last[0]) < 1e-3 && Math.abs(last[1]) < 1e-3) {
        segs.splice(idx, 1);
        this.editIdx = segs.length ? segs.length - 1 : -1;
        this.onSelect(this.editIdx);
      }
    }
    if (this._base) this._endSpan(!!edited);
    else if (edited) this._commit(this.tool === "add" ? "add" : this.tool);
    this._drag = null;
    this.redraw();
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    this.view.scale = Math.max(2, Math.min(120, this.view.scale * factor));
    this.redraw();
  }

  redraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._paint();
    });
  }

  _size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return { w, h, dpr };
  }

  _paint() {
    const { ctx } = this;
    const { w, h, dpr } = this._size();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const paper = getCss("--color-paper", "#f3ead8");
    const ink = getCss("--color-ink", "#2a241c");
    const accent = getCss("--color-primary", "#7a9e96");

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);

    ctx.setTransform(
      this.view.scale * dpr,
      0,
      0,
      -this.view.scale * dpr,
      w / 2 - this.view.cx * this.view.scale * dpr,
      h / 2 + this.view.cy * this.view.scale * dpr,
    );

    this._drawGrid(ctx);
    const overlay = this._base && this._span;
    const samples = walkPath(this.outline, { scale: 1, tol: 0.03, returnStart: true });
    if (!samples.length) return;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (overlay) {
      const frozen = walkPath(this._base, { scale: 1, tol: 0.03, returnStart: true });
      const hide = new Set(this._span.indices);
      ctx.strokeStyle = "rgba(42,36,28,0.28)";
      ctx.lineWidth = 1.4 / this.view.scale;
      strokePath(ctx, frozen, (s) => !hide.has(s.segmentIndex));
      const over = walkPath(this._span, { scale: 1, tol: 0.03, returnStart: true });
      ctx.strokeStyle = "#6b3b9a";
      ctx.lineWidth = 3.2 / this.view.scale;
      strokePath(ctx, over, () => true);
    } else {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6 / this.view.scale;
      strokePath(ctx, samples, () => true);
    }

    const span = new Set(this.span());
    if (span.size && !overlay) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.4 / this.view.scale;
      ctx.beginPath();
      let pen = false;
      let prev = samples[0].point;
      for (const s of samples) {
        if (span.has(s.segmentIndex)) {
          if (!pen) {
            ctx.moveTo(prev[0], prev[1]);
            pen = true;
          }
          ctx.lineTo(s.point[0], s.point[1]);
        } else {
          pen = false;
        }
        prev = s.point;
      }
      ctx.stroke();
    }

    const vertices = vertexList(samples, this.outline);
    const r = 4.2 / this.view.scale;
    vertices.forEach((p, i) => {
      const last = i === vertices.length - 1;
      const sel = i === this.editIdx + 1;
      ctx.fillStyle = i === 0 ? "#2f7a4a" : last ? "#a33b2b" : sel ? accent : ink;
      disc(ctx, p[0], p[1], sel || last || i === 0 ? r * 1.25 : r);
    });

    const info = closureInfo(this.outline);
    this._syncStatus(info);
    this._drawClosure(ctx, info, paper);
    this._drawToolHandles(ctx, paper, r);

    const end = vertices[vertices.length - 1];
    const tail = samples[samples.length - 1];
    if (end && tail && this.tool === "add") {
      const add = addHandlePoint(samples, ADD_PX / this.view.scale);
      ctx.strokeStyle = "#a33b2b";
      ctx.lineWidth = 1.4 / this.view.scale;
      ctx.beginPath();
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(add[0], add[1]);
      ctx.stroke();
      ctx.fillStyle = paper;
      disc(ctx, add[0], add[1], r * 1.15);
      ctx.strokeStyle = "#a33b2b";
      ctx.beginPath();
      ctx.arc(add[0], add[1], r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(add[0] - r * 0.7, add[1]);
      ctx.lineTo(add[0] + r * 0.7, add[1]);
      ctx.moveTo(add[0], add[1] - r * 0.7);
      ctx.lineTo(add[0], add[1] + r * 0.7);
      ctx.stroke();
    }
  }

  _drawToolHandles(ctx, paper, r) {
    const n = this.outline.turtlePath.length;
    if (n < 2) return;
    const j = this.joint;
    const jp = jointPose(this.outline, j === n ? 0 : j);
    const sc = this.view.scale;

    if (this.tool === "locus" || this.tool === "p") {
      const loc = locusCircle(this.outline, j);
      if (loc?.c && Number.isFinite(loc.r) && loc.r < 1e4) {
        ctx.save();
        ctx.strokeStyle = "rgba(122,158,150,0.55)";
        ctx.setLineDash([5 / sc, 4 / sc]);
        ctx.lineWidth = 1.2 / sc;
        ctx.beginPath();
        ctx.arc(loc.c.x, loc.c.y, loc.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const Pm = this.outline._biarc?.Pm || jp.point;
      ctx.fillStyle = "#6b3b9a";
      disc(ctx, Pm[0], Pm[1], r * 1.05);
      if (this.tool === "locus") {
        let hx = Pm[0];
        let hy = Pm[1] + STEM_PX / sc;
        if (loc?.c) {
          const vx = Pm[0] - loc.c.x;
          const vy = Pm[1] - loc.c.y;
          const L = Math.hypot(vx, vy) || 1;
          hx = Pm[0] + (vx / L) * (STEM_PX / sc);
          hy = Pm[1] + (vy / L) * (STEM_PX / sc);
        }
        ctx.strokeStyle = "#6b3b9a";
        ctx.lineWidth = 1.4 / sc;
        ctx.beginPath();
        ctx.moveTo(Pm[0], Pm[1]);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = paper;
        disc(ctx, hx, hy, r * 1.15);
        ctx.strokeStyle = "#6b3b9a";
        ctx.beginPath();
        ctx.arc(hx, hy, r * 1.15, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (SPAN4.has(this.tool)) {
      const tan = this.tool === "tan";
      ctx.fillStyle = "#6b3b9a";
      disc(ctx, jp.point[0], jp.point[1], r * (tan ? 1.1 : 1.35));
      const tick = STEM_PX / sc;
      const tx = jp.point[0] + Math.cos(jp.heading) * tick;
      const ty = jp.point[1] + Math.sin(jp.heading) * tick;
      ctx.strokeStyle = tan ? "#6b3b9a" : "rgba(107,59,154,0.45)";
      ctx.lineWidth = (tan ? 1.6 : 1.1) / sc;
      ctx.beginPath();
      ctx.moveTo(jp.point[0], jp.point[1]);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (tan) {
        ctx.fillStyle = paper;
        disc(ctx, tx, ty, r * 0.95);
        ctx.strokeStyle = "#6b3b9a";
        ctx.beginPath();
        ctx.arc(tx, ty, r * 0.95, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  _drawGrid(ctx) {
    const step = niceStep(48 / this.view.scale);
    const rect = this.canvas.getBoundingClientRect();
    const halfW = rect.width / (2 * this.view.scale);
    const halfH = rect.height / (2 * this.view.scale);
    const x0 = this.view.cx - halfW;
    const x1 = this.view.cx + halfW;
    const y0 = this.view.cy - halfH;
    const y1 = this.view.cy + halfH;
    ctx.strokeStyle = "rgba(42,36,28,0.08)";
    ctx.lineWidth = 1 / this.view.scale;
    ctx.beginPath();
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(42,36,28,0.22)";
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x1, 0);
    ctx.moveTo(0, y0);
    ctx.lineTo(0, y1);
    ctx.stroke();
  }

  _drawClosure(ctx, info, paper) {
    const a = info.startPoint;
    const b = info.endPoint;
    if (!a || !b) return;

    const tick = 14 / this.view.scale;
    ctx.lineWidth = 1.3 / this.view.scale;
    ctx.strokeStyle = "#2f7a4a";
    headingTick(ctx, a, info.startHeading, tick);
    ctx.strokeStyle = "#a33b2b";
    headingTick(ctx, b, info.endHeading, tick);

    if (info.g1) return;
    ctx.save();
    ctx.strokeStyle = info.g0 ? "rgba(122,158,150,0.85)" : "rgba(163,59,43,0.85)";
    ctx.setLineDash([6 / this.view.scale, 5 / this.view.scale]);
    ctx.lineWidth = 1.5 / this.view.scale;
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(a[0], a[1]);
    ctx.stroke();
    ctx.restore();
  }
}

function strokePath(ctx, samples, keep) {
  if (!samples.length) return;
  ctx.beginPath();
  let pen = false;
  let prev = samples[0].point;
  for (const s of samples) {
    if (keep(s)) {
      if (!pen) {
        ctx.moveTo(prev[0], prev[1]);
        pen = true;
      }
      ctx.lineTo(s.point[0], s.point[1]);
    } else {
      pen = false;
    }
    prev = s.point;
  }
  ctx.stroke();
}

function fmtP(v) {
  if (!Number.isFinite(v)) return "·";
  return Math.abs(v) >= 100 ? v.toExponential(1) : v.toFixed(2);
}

function fmtN(v, n) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "·";
  return x.toFixed(n);
}

function headingTick(ctx, p, heading, len) {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[0] + c * len, p[1] + s * len);
  ctx.stroke();
}

function normalizeOutline(o = {}) {
  return {
    name: o.name || "Custom",
    startPoint: (o.startPoint || [0, 0]).slice(),
    startAngle: o.startAngle ?? 0,
    turtlePath: (o.turtlePath || []).map((s) => [Number(s[0]), Number(s[1])]),
  };
}

function stateBefore(outline, idx) {
  const prefix = {
    ...outline,
    turtlePath: outline.turtlePath.slice(0, Math.max(0, idx)),
  };
  const samples = walkPath(prefix, { scale: 1, tol: 0.05, returnStart: true });
  const last = samples[samples.length - 1];
  const heading = last
    ? Math.atan2(last.angle[1], last.angle[0])
    : (outline.startAngle ?? 0) * DEG;
  return { point: last ? last.point : outline.startPoint || [0, 0], heading };
}

function vertexList(samples, outline) {
  if (!samples.length) return [outline.startPoint || [0, 0]];
  const lastOf = new Map();
  for (const s of samples) lastOf.set(s.segmentIndex, s.point);
  const verts = [samples[0].point];
  const keys = [...lastOf.keys()].filter((k) => k >= 0).sort((a, b) => a - b);
  for (const k of keys) verts.push(lastOf.get(k));
  return verts;
}

function addHandlePoint(samples, dist) {
  const last = samples[samples.length - 1];
  if (!last) return [0, 0];
  return [last.point[0] + last.angle[0] * dist, last.point[1] + last.angle[1] * dist];
}

function hitVertex(vertices, world, tol) {
  let best = -1;
  let bestD = tol;
  vertices.forEach((p, i) => {
    const d = Math.hypot(p[0] - world[0], p[1] - world[1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function hitSegment(samples, world, tol) {
  let best = -1;
  let bestD = tol;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].point;
    const b = samples[i].point;
    const d = distToSeg(world, a, b);
    const idx = samples[i].segmentIndex;
    if (idx >= 0 && d < bestD) {
      bestD = d;
      best = idx;
    }
  }
  return best;
}

function distToSeg(p, a, b) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy;
  if (l2 < 1e-12) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
}

function disc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const n = raw / p;
  if (n < 2) return 2 * p;
  if (n < 5) return 5 * p;
  return 10 * p;
}

function roundN(v, n) {
  const f = 10 ** n;
  return Math.round(v * f) / f;
}

function getCss(name, fallback) {
  if (typeof getComputedStyle === "undefined" || typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
