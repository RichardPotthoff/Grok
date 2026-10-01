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

function fmt(n) {
  if (!Number.isFinite(n)) return "?";
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function renderStage({ model, el }) {
  el.classList.add("stage-slot");
  el.style.display = "flex";
  el.style.flex = "1 1 auto";
  el.style.minWidth = "0";
  el.style.minHeight = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.position = "relative";
  el.style.background = INK.paper;

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
    if (r.width < 8 || r.height < 8) return false;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(r.width * dpr));
    const h = Math.max(1, Math.floor(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return true;
  }

  function paint() {
    if (!syncSize()) return;
    const ctx = canvas.getContext("2d");
    const { width: W, height: H } = canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = INK.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(cam.scale, 0, 0, -cam.scale, W / 2 - cam.x * cam.scale, H / 2 + cam.y * cam.scale);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(42,36,28,0.12)";
    ctx.lineWidth = 1 / cam.scale;
    ctx.beginPath();
    ctx.moveTo(-200, 0);
    ctx.lineTo(200, 0);
    ctx.moveTo(0, -200);
    ctx.lineTo(0, 200);
    ctx.stroke();
    for (const use of strokes()) {
      const samples = walkPath(use, { scale: 1, tol: 0.04, returnStart: true });
      if (!samples.length) continue;
      ctx.beginPath();
      ctx.moveTo(samples[0].point[0], samples[0].point[1]);
      for (let i = 1; i < samples.length; i++) ctx.lineTo(samples[i].point[0], samples[i].point[1]);
      ctx.strokeStyle = INK[use.stroke] || INK.ink;
      ctx.lineWidth = (use.width || 1.6) / cam.scale;
      if (use.fill && INK[use.fill]) {
        ctx.fillStyle = INK[use.fill];
        ctx.fill();
      }
      ctx.stroke();
    }
  }

  function allPoints() {
    const pts = [];
    for (const use of strokes()) {
      const samples = walkPath(use, { scale: 1, tol: 0.2, returnStart: true });
      for (const row of samples) pts.push(row.point);
      if (!samples.length) pts.push((use.startPoint || [0, 0]).slice());
    }
    return pts;
  }

  function fit() {
    if (!syncSize()) return false;
    const b = boundsOf(allPoints());
    const pad = 0.18;
    const sx = canvas.width / (b.w * (1 + pad));
    const sy = canvas.height / (b.h * (1 + pad));
    cam.scale = Math.max(4, Math.min(sx, sy) || 24);
    cam.x = b.cx;
    cam.y = b.cy;
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
      const I = row.interface || {};
      btn.innerHTML = `<div class="nm">${escapeHtml(row.name)}</div>
        <div class="meta">${escapeHtml(row.type)} · ${row.arcs} arcs<br>Δ (${fmt(I.dx)}, ${fmt(I.dy)})  Δθ ${fmt(I.dtheta)}°</div>`;
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
