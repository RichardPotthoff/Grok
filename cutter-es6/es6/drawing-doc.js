/**
 * Multi-stroke drawing document.
 *
 * A drawing is { name, paths: [ stroke, … ] }.
 * A stroke is an outline plus paint: { startPoint, startAngle, turtlePath, stroke, width, fill }.
 * Geometry stays [s, Δθ] + start pose. Color/width hang on the stroke, not the arc.
 */

import { walkPath, boundsOf } from "./path-utils.js";
import { walkExact } from "./close-path.js";

export const STROKE_ROLES = ["ink", "accent", "muted", "danger"];

export function normalizeStroke(s = {}) {
  return {
    id: s.id || "",
    name: s.name || "",
    startPoint: (s.startPoint || [0, 0]).map(Number),
    startAngle: s.startAngle ?? 0,
    turtlePath: (s.turtlePath || []).map((seg) => [Number(seg[0]), Number(seg[1])]),
    stroke: s.stroke || "ink",
    width: s.width == null ? 1.6 : Number(s.width),
    fill: s.fill || null,
  };
}

export function normalizeDrawing(d = {}) {
  const paths = (Array.isArray(d.paths)
    ? d.paths.map(normalizeStroke)
    : d.turtlePath
      ? [normalizeStroke(d)]
      : []
  ).map((s, i) => (s.id ? s : { ...s, id: `p${i + 1}` }));
  return {
    name: d.name || "Untitled",
    id: d.id || null,
    paths,
    active: clampIndex(d.active, paths.length),
  };
}

export function blankStroke(name = "") {
  return normalizeStroke({
    name,
    startPoint: [0, 0],
    startAngle: 0,
    turtlePath: [],
    stroke: "ink",
    width: 1.6,
  });
}

export function blankDrawing(name = "Untitled") {
  return normalizeDrawing({
    name,
    paths: [blankStroke()],
    active: 0,
  });
}

export function cloneDrawing(d) {
  return normalizeDrawing(JSON.parse(JSON.stringify(normalizeDrawing(d))));
}

export function activeStroke(d) {
  const doc = normalizeDrawing(d);
  if (!doc.paths.length) return blankStroke();
  return doc.paths[doc.active];
}

export function withActiveStroke(d, stroke) {
  const doc = cloneDrawing(d);
  if (!doc.paths.length) doc.paths = [normalizeStroke(stroke)];
  else doc.paths[doc.active] = normalizeStroke({ ...doc.paths[doc.active], ...stroke });
  return doc;
}

export function outlineFromStroke(stroke) {
  const s = normalizeStroke(stroke);
  return {
    name: s.name || "Stroke",
    startPoint: s.startPoint.slice(),
    startAngle: s.startAngle,
    turtlePath: s.turtlePath.map((seg) => seg.slice()),
  };
}

export function strokeFromOutline(outline, paint = {}) {
  return normalizeStroke({
    ...outline,
    stroke: paint.stroke || "ink",
    width: paint.width ?? 1.6,
    fill: paint.fill || null,
    name: paint.name || outline.name || "",
  });
}

export function serializeDrawing(d) {
  const doc = normalizeDrawing(d);
  return JSON.stringify(
    {
      name: doc.name,
      id: doc.id,
      paths: doc.paths.map((s) => ({
        id: s.id || undefined,
        name: s.name || undefined,
        startPoint: s.startPoint,
        startAngle: s.startAngle,
        turtlePath: s.turtlePath,
        stroke: s.stroke,
        width: s.width,
        fill: s.fill || undefined,
      })),
    },
    null,
    2,
  );
}

export function parseDrawing(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    return normalizeDrawing({ name: "Untitled", paths: [{ turtlePath: data }] });
  }
  if (data.paths) return normalizeDrawing(data);
  if (data.turtlePath) {
    return normalizeDrawing({
      name: data.name || "Untitled",
      paths: [data],
    });
  }
  throw new Error("JSON has no paths or turtlePath");
}

export function sampleStroke(stroke, { tol = 0.08 } = {}) {
  return walkPath(outlineFromStroke(stroke), { scale: 1, tol, returnStart: true });
}

export function drawingPoints(d, { tol = 0.08 } = {}) {
  const pts = [];
  for (const s of normalizeDrawing(d).paths) {
    const samples = sampleStroke(s, { tol });
    for (const row of samples) pts.push(row.point);
    if (!samples.length) pts.push((s.startPoint || [0, 0]).slice());
  }
  return pts;
}

export function drawingBounds(d) {
  return boundsOf(drawingPoints(d));
}

export function posesOf(stroke) {
  return walkExact(outlineFromStroke(stroke));
}

function clampIndex(i, n) {
  if (!n) return 0;
  const v = Number(i);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(n - 1, v | 0));
}
