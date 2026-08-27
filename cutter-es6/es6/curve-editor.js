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
import { closePath, closureInfo } from "./close-path.js";

export const EDITOR_TOOLS = ["select", "add", "pan"];

const HIT_PX = 26;
const ADD_PX = 22;

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

    this._onPtrDown = this._onPtrDown.bind(this);
    this._onPtrMove = this._onPtrMove.bind(this);
    this._onPtrUp = this._onPtrUp.bind(this);
    this._onWheel = this._onWheel.bind(this);

    canvas.style.touchAction = "none";
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
    const tool = EDITOR_TOOLS.includes(name) ? name : "select";
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

  closePath(opts = {}) {
    const next = closePath(this.outline, { smooth: opts.smooth !== false, mode: opts.mode });
    this.outline = next;
    const n = this.outline.turtlePath.length;
    this.editIdx = n ? n - 1 : -1;
    this.redraw();
    this.onSelect(this.editIdx);
    this.onChange(this.getOutline());
    return closureInfo(this.outline);
  }

  closureInfo() {
    return closureInfo(this.outline);
  }

  setOutline(outline, { fit = false, keepSelection = true } = {}) {
    this.outline = normalizeOutline(outline);
    const n = this.outline.turtlePath.length;
    if (!keepSelection || this.editIdx >= n) this.editIdx = n ? n - 1 : -1;
    if (fit) this.fit();
    this.redraw();
  }

  setSelected(idx) {
    const n = this.outline.turtlePath.length;
    this.editIdx = n === 0 ? -1 : Math.max(-1, Math.min(idx, n - 1));
    this.redraw();
    this.onSelect(this.editIdx);
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

  insertSegment(at) {
    const n = this.outline.turtlePath.length;
    const i = at == null ? (this.editIdx >= 0 ? this.editIdx + 1 : n) : at;
    const clamped = Math.max(0, Math.min(i, n));
    this.outline.turtlePath.splice(clamped, 0, [4, 0]);
    this.editIdx = clamped;
    this.redraw();
    this.onSelect(this.editIdx);
    this.onChange(this.getOutline());
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
    this.onChange(this.getOutline());
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
    this._ro?.disconnect();
    if (this._raf) cancelAnimationFrame(this._raf);
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
        .curve-tools {
          position: absolute; left: 8px; bottom: 8px; z-index: 3;
          display: flex; flex-wrap: wrap; gap: 4px;
          padding: 4px; border-radius: 10px;
          background: color-mix(in oklab, #1c1b18 82%, transparent);
          border: 1px solid color-mix(in oklab, #ece7dc 16%, transparent);
          backdrop-filter: blur(8px);
        }
        .curve-tools button {
          font: 600 12px/1.1 system-ui, sans-serif;
          min-height: 36px; min-width: 52px;
          padding: 6px 10px; border-radius: 8px;
          border: 1px solid color-mix(in oklab, #ece7dc 18%, transparent);
          background: #12110f; color: #ece7dc;
        }
        .curve-tools button[aria-pressed="true"] {
          background: #7a9e96; color: #12110f; border-color: transparent;
        }
        .curve-tools button.action { font-weight: 700; }
        .curve-close-status {
          position: absolute; left: 8px; top: 28px; z-index: 3;
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
      <button type="button" data-tool="select" title="Select and drag handles">Select</button>
      <button type="button" data-tool="add" title="Drag from the end to add an arc">Add</button>
      <button type="button" data-tool="pan" title="Drag to pan">Pan</button>
      <button type="button" data-action="close" class="action" title="Adjust last two arcs so the path meets with matching heading">Close</button>
    `;
    bar.addEventListener("pointerdown", (e) => e.stopPropagation());
    bar.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.tool) this.setTool(btn.dataset.tool);
      if (btn.dataset.action === "close") this.closePath();
    });
    parent.appendChild(bar);
    this._tools = bar;

    const status = document.createElement("div");
    status.className = "curve-close-status";
    parent.appendChild(status);
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
    if (info.g1) {
      this._status.className = "curve-close-status ok";
      this._status.textContent = "closed · G1";
      return;
    }
    this._status.className = "curve-close-status";
    const gap = info.gap < 0.001 ? info.gap.toExponential(2) : info.gap.toFixed(3);
    this._status.textContent = `gap ${gap} · Δθ ${info.dHeadingDeg.toFixed(2)}°`;
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
    const hitAdd = addPt && Math.hypot(addPt[0] - world[0], addPt[1] - world[1]) < tol;
    const hitV = hitVertex(vertices, world, tol);
    const n = this.outline.turtlePath.length;

    let idx = this.editIdx;
    let append = false;

    if (this.tool === "add" && !hitV && !hitAdd) {
      this.outline.turtlePath.push([0, 0]);
      idx = this.outline.turtlePath.length - 1;
      append = true;
    } else if (hitAdd) {
      this.outline.turtlePath.push([0, 0]);
      idx = this.outline.turtlePath.length - 1;
      append = true;
    } else if (hitV > 0) {
      idx = hitV - 1;
    } else if (hitV === 0 && n > 0) {
      idx = 0;
    } else {
      const hitSeg = hitSegment(samples, world, tol * 1.4);
      if (hitSeg >= 0) {
        idx = hitSeg;
      } else {
        this._drag = { mode: "pan", x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy };
        return;
      }
    }

    this.editIdx = idx;
    const startState = stateBefore(this.outline, idx);
    this._drag = {
      mode: "edit",
      idx,
      append,
      start: startState.point,
      heading: startState.heading,
    };
    this.onSelect(idx);
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

    const world = this.worldFromEvent(e);
    const { len, ang } = fitArc(this._drag.start, this._drag.heading, world);
    const idx = this._drag.idx;
    if (idx >= 0) {
      this.outline.turtlePath[idx] = [roundN(len, 4), roundN(ang, 3)];
    }
    this.redraw();
  }

  _onPtrUp(e) {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) this._pinch = null;
    if (this._drag?.mode === "edit") {
      const segs = this.outline.turtlePath;
      const idx = this._drag.idx;
      const last = segs[idx];
      if (this._drag.append && last && Math.abs(last[0]) < 1e-3 && Math.abs(last[1]) < 1e-3) {
        segs.splice(idx, 1);
        this.editIdx = segs.length ? segs.length - 1 : -1;
        this.onSelect(this.editIdx);
      }
      this.onChange(this.getOutline());
    }
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
    const samples = walkPath(this.outline, { scale: 1, tol: 0.03, returnStart: true });
    if (!samples.length) return;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6 / this.view.scale;
    ctx.beginPath();
    ctx.moveTo(samples[0].point[0], samples[0].point[1]);
    for (let i = 1; i < samples.length; i++) ctx.lineTo(samples[i].point[0], samples[i].point[1]);
    ctx.stroke();

    if (this.editIdx >= 0) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.4 / this.view.scale;
      ctx.beginPath();
      let pen = false;
      let prev = samples[0].point;
      for (const s of samples) {
        if (s.segmentIndex === this.editIdx) {
          if (!pen) {
            ctx.moveTo(prev[0], prev[1]);
            pen = true;
          }
          ctx.lineTo(s.point[0], s.point[1]);
        } else if (pen) {
          break;
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

    const end = vertices[vertices.length - 1];
    const tail = samples[samples.length - 1];
    if (end && tail && this.tool !== "pan") {
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
