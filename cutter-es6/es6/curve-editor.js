/**
 * Touch-first turtle path editor.
 * Coordinates are math (y-up). Canvas is flipped at draw time.
 *
 *   const ed = new CurveEditor(canvas, { outline, onChange, onSelect });
 *   ed.setOutline(outline);
 *   ed.destroy();
 */

import { walkPath, boundsOf, fitArc, headingFromDeg, DEG } from "./path-utils.js";

export class CurveEditor {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onChange = opts.onChange || (() => {});
    this.onSelect = opts.onSelect || (() => {});
    this.outline = normalizeOutline(opts.outline);
    this.editIdx = opts.editIdx ?? -1;
    this.view = { cx: 0, cy: 0, scale: 12 };
    this._drag = null;
    this._pointers = new Map();
    this._pinch = null;
    this._raf = 0;
    this._ro = null;

    this._onPtrDown = this._onPtrDown.bind(this);
    this._onPtrMove = this._onPtrMove.bind(this);
    this._onPtrUp = this._onPtrUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onLost = this._onPtrUp.bind(this);

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this._onPtrDown);
    canvas.addEventListener("pointermove", this._onPtrMove);
    canvas.addEventListener("pointerup", this._onPtrUp);
    canvas.addEventListener("pointercancel", this._onPtrUp);
    canvas.addEventListener("lostpointercapture", this._onLost);
    canvas.addEventListener("wheel", this._onWheel, { passive: false });

    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this.redraw());
      this._ro.observe(canvas);
    }
    this.fit();
    this.redraw();
  }

  setOutline(outline, { fit = false } = {}) {
    this.outline = normalizeOutline(outline);
    if (this.editIdx >= this.outline.turtlePath.length) this.editIdx = -1;
    if (fit) this.fit();
    this.redraw();
  }

  setSelected(idx) {
    this.editIdx = idx;
    this.redraw();
    this.onSelect(idx);
  }

  getOutline() {
    return {
      name: this.outline.name,
      startPoint: this.outline.startPoint.slice(),
      startAngle: this.outline.startAngle,
      turtlePath: this.outline.turtlePath.map(([l, a]) => [l, a]),
    };
  }

  fit() {
    const samples = walkPath(this.outline, { scale: 1, tol: 0.08 });
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
  }

  destroy() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this._onPtrDown);
    c.removeEventListener("pointermove", this._onPtrMove);
    c.removeEventListener("pointerup", this._onPtrUp);
    c.removeEventListener("pointercancel", this._onPtrUp);
    c.removeEventListener("lostpointercapture", this._onLost);
    c.removeEventListener("wheel", this._onWheel);
    this._ro?.disconnect();
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  /* ── view transform ── */

  _size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return { w, h, dpr, cssW: rect.width, cssH: rect.height };
  }

  worldFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const { cssW, cssH } = { cssW: rect.width, cssH: rect.height };
    const sx = e.clientX - rect.left - cssW / 2;
    const sy = e.clientY - rect.top - cssH / 2;
    return [
      this.view.cx + sx / this.view.scale,
      this.view.cy - sy / this.view.scale,
    ];
  }

  /* ── pointer ── */

  _onPtrDown(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this._pointers.size === 2) {
      const pts = [...this._pointers.values()];
      this._pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        cx: this.view.cx,
        cy: this.view.cy,
        scale: this.view.scale,
        mid: [(pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2],
      };
      this._drag = null;
      return;
    }

    if (e.button === 1 || e.shiftKey) {
      this._drag = { mode: "pan", x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy };
      return;
    }

    const world = this.worldFromEvent(e);
    const samples = walkPath(this.outline, { scale: 1, tol: 0.04, returnStart: true });
    const hit = hitVertex(samples, world, 14 / this.view.scale);

    let idx = this.editIdx;
    if (hit === 0) {
      idx = -2;
    } else if (hit > 0) {
      idx = hit - 1;
    } else if (this.outline.turtlePath.length === 0 || this.editIdx === -1) {
      // start a new segment at the end
      this.outline.turtlePath.push([0, 0]);
      idx = this.outline.turtlePath.length - 1;
    }

    this.editIdx = idx;
    const startState = stateBefore(this.outline, idx < 0 ? 0 : idx);
    this._drag = {
      mode: "edit",
      idx,
      start: startState.point,
      heading: startState.heading,
      orig: idx >= 0 ? this.outline.turtlePath[idx].slice() : [0, 0],
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
      const ratio = dist / Math.max(this._pinch.dist, 1);
      this.view.scale = Math.max(2, Math.min(120, this._pinch.scale * ratio));
      this.redraw();
      return;
    }

    if (!this._drag) return;

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
      const last = segs[segs.length - 1];
      if (last && Math.abs(last[0]) < 1e-4 && Math.abs(last[1]) < 1e-4 && segs.length > 1) {
        segs.pop();
        this.editIdx = -1;
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

  /* ── draw ── */

  redraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._paint();
    });
  }

  _paint() {
    const { ctx } = this;
    const { w, h, dpr } = this._size();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const paper = getCss("--color-paper", "#f3ead8");
    const ink = getCss("--color-ink", "#2a241c");
    const accent = getCss("--color-primary", "#7a9e96");
    const grid = "rgba(42,36,28,0.08)";

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

    this._drawGrid(ctx, grid);
    const samples = walkPath(this.outline, { scale: 1, tol: 0.03, returnStart: true });
    if (!samples.length) return;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6 / this.view.scale;
    ctx.beginPath();
    ctx.moveTo(samples[0].point[0], samples[0].point[1]);
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(samples[i].point[0], samples[i].point[1]);
    }
    ctx.stroke();

    // highlight selected segment
    if (this.editIdx >= 0) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.2 / this.view.scale;
      ctx.beginPath();
      let started = false;
      for (const s of samples) {
        if (s.segmentIndex === this.editIdx) {
          if (!started) {
            // back up to previous sample
            started = true;
          }
          ctx.lineTo(s.point[0], s.point[1]);
        } else if (!started && s.segmentIndex === this.editIdx - 1) {
          ctx.moveTo(s.point[0], s.point[1]);
          started = true;
        } else if (s.segmentIndex === -1 && this.editIdx === 0) {
          ctx.moveTo(s.point[0], s.point[1]);
          started = true;
        }
      }
      ctx.stroke();
    }

    const r = 4.5 / this.view.scale;
    const start = samples[0].point;
    const end = samples[samples.length - 1].point;
    ctx.fillStyle = "#2f7a4a";
    disc(ctx, start[0], start[1], r);
    ctx.fillStyle = "#a33b2b";
    disc(ctx, end[0], end[1], r);

    // heading tick at turtle
    const a = samples[samples.length - 1].angle;
    ctx.strokeStyle = "#a33b2b";
    ctx.lineWidth = 1.4 / this.view.scale;
    ctx.beginPath();
    ctx.moveTo(end[0], end[1]);
    ctx.lineTo(end[0] + a[0] * r * 3.2, end[1] + a[1] * r * 3.2);
    ctx.stroke();
  }

  _drawGrid(ctx, color) {
    const step = niceStep(48 / this.view.scale);
    const { cssW, cssH } = this.canvas.getBoundingClientRect();
    const halfW = cssW / (2 * this.view.scale);
    const halfH = cssH / (2 * this.view.scale);
    const x0 = this.view.cx - halfW;
    const x1 = this.view.cx + halfW;
    const y0 = this.view.cy - halfH;
    const y1 = this.view.cy + halfH;
    ctx.strokeStyle = color;
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
}

function normalizeOutline(o = {}) {
  return {
    name: o.name || "Custom",
    startPoint: (o.startPoint || [0, 0]).slice(),
    startAngle: o.startAngle ?? 0,
    turtlePath: (o.turtlePath || []).map(([l, a]) => [Number(l), Number(a)]),
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

function hitVertex(samples, world, tol) {
  let best = -1;
  let bestD = tol;
  const ends = new Map();
  for (const s of samples) {
    ends.set(s.segmentIndex + 1, s.point);
  }
  for (const [k, p] of ends) {
    const d = Math.hypot(p[0] - world[0], p[1] - world[1]);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

function disc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
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

export { headingFromDeg };
