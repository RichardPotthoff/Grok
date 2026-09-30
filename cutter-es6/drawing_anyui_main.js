/**
 * CLI-first drawing twin. Script pane + canvas flatten of lazy blocks.
 * drawing.html stays the direct-manipulation reference.
 */

import { walkPath, boundsOf } from "./es6/path-utils.js";
import {
  API_HELP,
  DEFAULT_SCRIPT,
  DrawingRepl,
  loadSession,
  saveSession,
} from "./es6/drawing-repl.js";

const INK = {
  ink: "#2a241c",
  accent: "#3d6b64",
  muted: "#8a8478",
  danger: "#a33c3c",
  paper: "#f3ead8",
};

const canvas = document.getElementById("stage");
const scriptEl = document.getElementById("script");
const logEl = document.getElementById("log");
const objectsEl = document.getElementById("objects");

const repl = new DrawingRepl();
const cam = { x: 0, y: 0, scale: 24 };
let flattened = [];
let dragging = null;

function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width * dpr));
  const h = Math.max(1, Math.floor(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  paint();
}

function canvasPx(ev) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  return [(ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr];
}

function paint() {
  const ctx = canvas.getContext("2d");
  const { width: W, height: H } = canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = INK.paper;
  ctx.fillRect(0, 0, W, H);

  ctx.setTransform(cam.scale, 0, 0, -cam.scale, W / 2 - cam.x * cam.scale, H / 2 + cam.y * cam.scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // axes
  ctx.strokeStyle = "rgba(42,36,28,0.12)";
  ctx.lineWidth = 1 / cam.scale;
  ctx.beginPath();
  ctx.moveTo(-200, 0);
  ctx.lineTo(200, 0);
  ctx.moveTo(0, -200);
  ctx.lineTo(0, 200);
  ctx.stroke();

  for (const use of flattened) {
    const samples = walkPath(use, { scale: 1, tol: 0.04, returnStart: true });
    if (!samples.length) continue;
    ctx.beginPath();
    ctx.moveTo(samples[0].point[0], samples[0].point[1]);
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(samples[i].point[0], samples[i].point[1]);
    }
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
  for (const use of flattened) {
    const samples = walkPath(use, { scale: 1, tol: 0.2, returnStart: true });
    for (const row of samples) pts.push(row.point);
    if (!samples.length) pts.push((use.startPoint || [0, 0]).slice());
  }
  return pts;
}

function fit() {
  const pts = allPoints();
  const b = boundsOf(pts);
  const pad = 0.18;
  const sx = canvas.width / (b.w * (1 + pad));
  const sy = canvas.height / (b.h * (1 + pad));
  cam.scale = Math.max(4, Math.min(sx, sy) || 24);
  cam.x = b.cx;
  cam.y = b.cy;
  paint();
}

function renderLog() {
  logEl.innerHTML = "";
  for (const line of repl.log) {
    const div = document.createElement("div");
    if (line.startsWith("err ")) div.className = "err";
    div.textContent = line;
    logEl.appendChild(div);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

function renderObjects() {
  objectsEl.innerHTML = "";
  const rows = repl.namedList();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "obj";
    empty.innerHTML = `<div class="nm">(none)</div><div class="meta">define("name", block)</div>`;
    objectsEl.appendChild(empty);
    return;
  }
  for (const row of rows) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "obj";
    const I = row.interface;
    el.innerHTML = `<div class="nm">${escapeHtml(row.name)}</div>
      <div class="meta">${escapeHtml(row.type)} · ${row.arcs} arcs<br>Δ (${fmt(I.dx)}, ${fmt(I.dy)})  Δθ ${fmt(I.dtheta)}°</div>`;
    el.addEventListener("click", () => {
      repl.note(row.text);
      renderLog();
    });
    objectsEl.appendChild(el);
  }
}

function fmt(n) {
  if (!Number.isFinite(n)) return "?";
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function runScript() {
  const src = scriptEl.value;
  saveSession(src);
  try {
    repl.run(src);
    flattened = repl.flattened();
  } catch {
    /* last good flatten kept; error already logged */
  }
  renderLog();
  renderObjects();
  if (flattened.length) fit();
  else paint();
}

function loadExample() {
  scriptEl.value = DEFAULT_SCRIPT;
  runScript();
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
function endDrag(ev) {
  if (dragging && dragging.id === ev.pointerId) dragging = null;
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    cam.scale = Math.max(4, Math.min(240, cam.scale * factor));
    paint();
  },
  { passive: false },
);

document.getElementById("btn-run").addEventListener("click", runScript);
document.getElementById("btn-fit").addEventListener("click", fit);
document.getElementById("btn-example").addEventListener("click", loadExample);
document.getElementById("btn-help").addEventListener("click", () => {
  repl.note(API_HELP);
  renderLog();
});
document.getElementById("btn-copy").addEventListener("click", async () => {
  const text = scriptEl.value;
  try {
    await navigator.clipboard.writeText(text);
    repl.note("copied script");
  } catch {
    repl.note("err clipboard unavailable — select the script pane");
  }
  renderLog();
});

scriptEl.addEventListener("keydown", (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
    ev.preventDefault();
    runScript();
  }
});

window.addEventListener("resize", resizeCanvas);

const session = loadSession();
scriptEl.value = session.script || DEFAULT_SCRIPT;

resizeCanvas();
runScript();

window.drawingRepl = { repl, cam, runScript, fit };

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
