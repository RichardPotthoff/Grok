/**
 * anyui views for the drawing REPL.
 * State lives on the model so Tab remount does not drop it.
 */

import { walkPath, boundsOf } from "./path-utils.js";

const INK = {
  ink: "#2a241c",
  accent: "#3d6b64",
  muted: "#8a8478",
  danger: "#a33c3c",
  paper: "#f3ead8",
};

/** Sample one arc straight into lineTo. No point array. */
function traceArc(ctx, x, y, hd, s, da, tol) {
  const ang = da || 0;
  if (Math.abs(ang) < 1e-9 || Math.abs(s) < 1e-9) {
    ctx.lineTo(x + s * Math.cos(hd), y + s * Math.sin(hd));
    return;
  }
  const R = s / ang;
  const cx = x - R * Math.sin(hd);
  const cy = y + R * Math.cos(hd);
  const err = Math.min(Math.abs(R), tol);
  const maxStep = 2 * Math.acos(Math.max(-1, 1 - err / Math.abs(R)));
  const n = Math.max(1, Math.ceil(Math.abs(ang) / (maxStep || 1)));
  for (let i = 1; i <= n; i++) {
    const a = hd + ang * (i / n);
    ctx.lineTo(cx + R * Math.sin(a), cy - R * Math.cos(a));
  }
}

function stepTo(x, y, hd, s, da) {
  const ang = da || 0;
  if (Math.abs(ang) < 1e-12) return [x + s * Math.cos(hd), y + s * Math.sin(hd), hd];
  const half = ang / 2;
  const chord = (s * Math.sin(half)) / half;
  const mid = hd + half;
  return [x + chord * Math.cos(mid), y + chord * Math.sin(mid), hd + ang];
}

function paintUse(ctx, use, cam) {
  const base = {
    stroke: use.stroke || "ink",
    width: use.width == null ? null : use.width,
    fill: use.fill || null,
    dash: null,
  };
  const root = use.root;
  if (!root || typeof root.arcs !== "function") {
    drawRun(ctx, iterPoints(use, 0.04), base, cam);
    return;
  }
  const tol = 0.04;
  fillPass(ctx, root, use, base, tol);
  strokePass(ctx, root, use, base, cam, tol);
}

function fillPass(ctx, root, use, base, tol) {
  let x = (use.startPoint || [0, 0])[0];
  let y = (use.startPoint || [0, 0])[1];
  let hd = use.startAngle || 0;
  let open = false;
  let fill = null;
  const close = () => {
    if (open && fill) ctx.fill();
    open = false;
  };
  for (const [s, da, extra] of root.arcs({ paint: base })) {
    const src = extra || {};
    const next = src.fill != null ? src.fill : base.fill;
    const w = src.width != null ? src.width : base.width;
    const penUp = w === 0 && !src.dash;
    if (open && (next !== fill || penUp)) close();
    fill = next;
    if (fill && !penUp) {
      if (!open) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.fillStyle = INK[fill] || fill;
        open = true;
      }
      traceArc(ctx, x, y, hd, s, da, tol);
    }
    [x, y, hd] = stepTo(x, y, hd, s, da);
  }
  close();
}

function strokePass(ctx, root, use, base, cam, tol) {
  let x = (use.startPoint || [0, 0])[0];
  let y = (use.startPoint || [0, 0])[1];
  let hd = use.startAngle || 0;
  let open = false;
  let stroke = base.stroke;
  let width = base.width;
  let dash = base.dash;
  const strokeNow = () => {
    if (!open) return;
    applyStyle(ctx, stroke, width, null, dash, cam);
    if (!(width === 0 && !dash)) ctx.stroke();
    open = false;
  };
  for (const [s, da, extra] of root.arcs({ paint: base })) {
    const src = extra || {};
    const ns = src.stroke != null ? src.stroke : base.stroke;
    const nw = src.width != null ? src.width : base.width;
    const nd = src.dash != null ? src.dash : base.dash;
    if (open && (ns !== stroke || nw !== width || nd !== dash)) strokeNow();
    stroke = ns;
    width = nw;
    dash = nd;
    const penUp = width === 0 && !dash;
    if (!open) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      open = true;
    }
    if (!penUp) traceArc(ctx, x, y, hd, s, da, tol);
    [x, y, hd] = stepTo(x, y, hd, s, da);
    if (penUp) strokeNow();
  }
  strokeNow();
}

function dashPattern(dash) {
  if (!dash || dash === "solid") return [];
  if (Array.isArray(dash)) return dash.map(Number);
  if (dash === "dotted" || dash === "dot") return [0.15, 0.55];
  return [1.1, 0.7];
}

function drawRun(ctx, pts, style, cam) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  applyStyle(ctx, style.stroke, style.width, style.fill, style.dash, cam);
  if (style.fill) ctx.fill();
  if (!(style.width === 0 && !style.dash)) ctx.stroke();
  ctx.setLineDash([]);
}
function applyStyle(ctx, stroke, width, fill, dash, cam) {
  const debugMove = width === 0 && dash;
  const penUp = width === 0 && !debugMove;
  ctx.strokeStyle = INK[stroke] || stroke || "#111";
  const hair = 1.25 / (cam.scale || 1);
  ctx.lineWidth = penUp ? 0 : debugMove ? hair : width == null ? hair : width;
  ctx.setLineDash(dashPattern(dash));
  if (fill && (INK[fill] || fill)) ctx.fillStyle = INK[fill] || fill;
}
/** Axis-aligned box of one use. Only the two corners are kept. */
function boundsOfUse(use) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  const x0 = (use.startPoint || [0, 0])[0];
  const y0 = (use.startPoint || [0, 0])[1];
  add(x0, y0);
  if (use.root && typeof use.root.arcs === "function") {
    let x = x0, y = y0, hd = use.startAngle || 0;
    for (const [s, da] of use.root.arcs()) {
      const ang = da || 0;
      if (Math.abs(ang) < 1e-9) {
        x += s * Math.cos(hd);
        y += s * Math.sin(hd);
        add(x, y);
        continue;
      }
      const R = s / ang;
      const cx = x - R * Math.sin(hd);
      const cy = y + R * Math.cos(hd);
      const end = stepTo(x, y, hd, s, ang);
      add(end[0], end[1]);
      const lo = Math.min(0, ang);
      const hi = Math.max(0, ang);
      for (let k = -4; k <= 4; k++) {
        const a = k * Math.PI / 2 - hd;
        if (a > lo + 1e-9 && a < hi - 1e-9) {
          const t = hd + a;
          add(cx + R * Math.sin(t), cy - R * Math.cos(t));
        }
      }
      x = end[0];
      y = end[1];
      hd = end[2];
    }
  }
  if (!Number.isFinite(minX)) return { minX: -1, minY: -1, maxX: 1, maxY: 1, cx: 0, cy: 0, w: 2, h: 2 };
  return {
    minX, minY, maxX, maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: Math.max(maxX - minX, 1e-6),
    h: Math.max(maxY - minY, 1e-6),
  };
}

function iterPoints(use, tol) {
  const pts = [];
  const samples = walkPath(use, { scale: 1, tol, returnStart: true });
  for (const row of samples) pts.push(row.point);
  if (!pts.length) pts.push((use.startPoint || [0, 0]).slice());
  return pts;
}

function fmt(n) {
  if (!Number.isFinite(n)) return "?";
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function renderStage({ model, el }) {
  el.replaceChildren();
  el.classList.add("stage-slot");
  el.style.display = "flex";
  el.style.flex = "1 1 auto";
  el.style.minWidth = "0";
  el.style.minHeight = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.position = "relative";

  const label = document.createElement("div");
  label.className = "panel-label";
  label.textContent = "Page";
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  el.append(label, canvas);

  const cam = { x: 0, y: 0, scale: 24 };
  let dragging = null;
  let fitted = false;

  function strokes() {
    return model.get("strokes") || [];
  }

  function syncSize() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return canvas.width > 8 && canvas.height > 8;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(r.width * dpr));
    const h = Math.max(1, Math.floor(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return canvas.width > 8 && canvas.height > 8;
  }

  function paint() {
    if (!syncSize()) return;
    const ctx = canvas.getContext("2d");
    const { width: W, height: H } = canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(cam.scale, 0, 0, -cam.scale, W / 2 - cam.x * cam.scale, H / 2 + cam.y * cam.scale);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1 / cam.scale;
    ctx.beginPath();
    ctx.moveTo(-200, 0);
    ctx.lineTo(200, 0);
    ctx.moveTo(0, -200);
    ctx.lineTo(0, 200);
    ctx.stroke();
    for (const use of strokes()) paintUse(ctx, use, cam);
  }

  function fit() {
    if (!syncSize()) return false;
    const view = window.drawingRepl && window.drawingRepl.repl && window.drawingRepl.repl.viewSize;
    if (view && view.w > 0 && view.h > 0) {
      const pad = 0.18;
      const sx = canvas.width / (view.w * (1 + pad));
      const sy = canvas.height / (view.h * (1 + pad));
      cam.scale = Math.max(4, Math.min(sx, sy) || 24);
      cam.x = 0;
      cam.y = 0;
      fitted = true;
      paint();
      return true;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const use of strokes()) {
      const b = boundsOfUse(use);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }
    if (!Number.isFinite(minX)) {
      minX = -1; minY = -1; maxX = 1; maxY = 1;
    }
    const w = Math.max(maxX - minX, 1e-6);
    const h = Math.max(maxY - minY, 1e-6);
    const pad = 0.18;
    const sx = canvas.width / (w * (1 + pad));
    const sy = canvas.height / (h * (1 + pad));
    cam.scale = Math.max(4, Math.min(sx, sy) || 24);
    cam.x = (minX + maxX) / 2;
    cam.y = (minY + maxY) / 2;
    fitted = true;
    paint();
    return true;
  }

  model._fit = fit;
  model._paint = paint;

  const ro = new ResizeObserver(() => {
    const changed = syncSize();
    if (!changed) return;
    if (!fitted) fit();
    else paint();
  });
  ro.observe(el);

  function canvasPx(ev) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    return [(ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr];
  }
  canvas.addEventListener("pointerdown", (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    const [px, py] = canvasPx(ev);
    dragging = { id: ev.pointerId, px, py, cx: cam.x, cy: cam.y };
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!dragging || dragging.id !== ev.pointerId) return;
    const [px, py] = canvasPx(ev);
    cam.x = dragging.cx - (px - dragging.px) / cam.scale;
    cam.y = dragging.cy + (py - dragging.py) / cam.scale;
    paint();
  });
  const endDrag = (ev) => {
    if (dragging && dragging.id === ev.pointerId) dragging = null;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      cam.scale = Math.max(4, Math.min(400, cam.scale * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
      paint();
    },
    { passive: false },
  );

  const onStrokes = () => {
    fitted = false;
    fit();
  };
  model.on("change:strokes", onStrokes);

  requestAnimationFrame(() => requestAnimationFrame(() => fit()));

  return () => {
    model.off("change:strokes", onStrokes);
    ro.disconnect();
    model._fit = null;
    model._paint = null;
  };
}

export function renderScript({ model, el }) {
  el.replaceChildren();
  el.style.display = "flex";
  el.style.flex = "1 1 auto";
  el.style.minHeight = "0";
  el.style.minWidth = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  const ta = document.createElement("textarea");
  ta.className = "script-field";
  ta.spellcheck = false;
  ta.autocapitalize = "off";
  ta.autocomplete = "off";
  ta.autocorrect = "off";
  ta.value = model.get("value") || "";
  ta.addEventListener("input", () => {
    model.set("value", ta.value);
    model.save_changes();
  });
  ta.addEventListener("keydown", (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
      ev.preventDefault();
      model.send({ event: "run" });
    }
  });
  const onValue = () => {
    const next = model.get("value") || "";
    if (ta.value !== next) ta.value = next;
  };
  model.on("change:value", onValue);
  el.appendChild(ta);
  return () => {
    model.off("change:value", onValue);
    ta.remove();
  };
}

export function renderLog({ model, el }) {
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.flex = "1 1 auto";
  el.style.minHeight = "0";
  el.style.minWidth = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  const pre = document.createElement("pre");
  pre.className = "log-field";
  const paint = () => {
    const lines = model.get("lines") || [];
    pre.innerHTML = "";
    for (const line of lines) {
      const div = document.createElement("div");
      if (String(line).startsWith("err ")) div.className = "err";
      div.textContent = line;
      pre.appendChild(div);
    }
    pre.scrollTop = pre.scrollHeight;
  };
  model.on("change:lines", paint);
  paint();
  el.appendChild(pre);
  return () => {
    model.off("change:lines", paint);
    pre.remove();
  };
}

export function renderObjects({ model, el }) {
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.flex = "1 1 auto";
  el.style.minHeight = "0";
  el.style.minWidth = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "auto";
  const list = document.createElement("div");
  list.className = "object-list";
  const paint = () => {
    const rows = model.get("items") || [];
    list.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "obj";
      empty.innerHTML = `<div class="nm">(none)</div><div class="meta">store("name", block)</div>`;
      list.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "obj";
      const I = Array.isArray(row.interface) ? row.interface : null;
      const meta = I
        ? `${escapeHtml(row.type)} · ${row.arcs} arcs<br>Δ (${fmt(I[0])}, ${fmt(I[1])})  Δθ ${fmt(I[2])}`
        : escapeHtml(row.type || "");
      btn.innerHTML = `<div class="nm">${escapeHtml(row.name)}</div>
        <div class="meta">${meta}</div>`;
      btn.addEventListener("click", () => model.send({ event: "pick", name: row.name }));
      list.appendChild(btn);
    }
  };
  model.on("change:items", paint);
  paint();
  el.appendChild(list);
  return () => {
    model.off("change:items", paint);
    list.remove();
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}
