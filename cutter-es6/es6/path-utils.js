/** Convert turtle outlines to polylines / epaths for the 2D editor and WebGL. */

import { Segments2Complex, TurtlePathLengthArea } from "./turtle-graphics.js";

export const DEG = Math.PI / 180;

export function headingFromDeg(deg) {
  const r = deg * DEG;
  return [Math.cos(r), Math.sin(r)];
}

/** Degrees in, radians out — what Segments2Complex wants. */
export function segsToRadians(turtlePath) {
  return turtlePath.map(([l, a]) => [Number(l), Number(a) * DEG]);
}

export function walkPath(outline, { scale = 1, tol = 0.05, returnStart = true } = {}) {
  const startPoint = outline.startPoint || [0, 0];
  const startAngle = outline.startAngle ?? 0;
  const a0 = headingFromDeg(startAngle);
  const p0 = [startPoint[0] * scale, startPoint[1] * scale];
  const segs = segsToRadians(outline.turtlePath || []);
  return Array.from(
    Segments2Complex({
      p0_a0_segs: [[p0, a0], segs],
      scale,
      tol,
      loops: 1,
      return_start: returnStart,
    }),
  );
}

/** [point, heading] pairs for extrude(). */
export function outlineToEpath(outline, { scale = 1, tol = 0.05 } = {}) {
  return walkPath(outline, { scale, tol, returnStart: false }).map(({ point, angle }) => [
    point,
    angle,
  ]);
}

export function pathStats(outline, { scale = 1 } = {}) {
  const segs = segsToRadians(outline.turtlePath || []).map(([l, a]) => [l * scale, a]);
  const startAngle = (outline.startAngle ?? 0) * DEG;
  const [length, area, end, endAngle, centroid] = TurtlePathLengthArea(segs, startAngle);
  const start = outline.startPoint || [0, 0];
  const dx = end[0] - start[0] * scale;
  const dy = end[1] - start[1] * scale;
  const gap = Math.hypot(dx, dy);
  return { length, area, end, endAngle, centroid, gap, closed: gap < 0.35 * scale };
}

export function boundsOf(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  if (!isFinite(minX)) return { minX: -1, minY: -1, maxX: 1, maxY: 1, cx: 0, cy: 0, w: 2, h: 2 };
  return {
    minX, minY, maxX, maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: Math.max(maxX - minX, 1e-6),
    h: Math.max(maxY - minY, 1e-6),
  };
}

export function centerEpath(epath) {
  const b = boundsOf(epath.map(([p]) => p));
  return epath.map(([p, a]) => [[p[0] - b.cx, p[1] - b.cy], a]);
}

/**
 * Inverse of a turtle arc: given start, heading (radians), and a target end
 * point, return { len, angDeg } matching the notebook convention.
 */
export function fitArc(start, headingRad, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-8) return { len: 0, ang: 0 };
  const chordHdg = Math.atan2(dy, dx);
  let half = chordHdg - headingRad;
  while (half > Math.PI) half -= 2 * Math.PI;
  while (half < -Math.PI) half += 2 * Math.PI;
  const ang = 2 * half;
  let len;
  if (Math.abs(ang) < 1e-6) {
    len = chord;
  } else {
    len = (ang * chord) / (2 * Math.sin(ang / 2));
  }
  return { len, ang: ang / DEG };
}

export function serializeOutline(outline) {
  return JSON.stringify(
    {
      name: outline.name || "Custom",
      startPoint: outline.startPoint || [0, 0],
      startAngle: outline.startAngle ?? 0,
      turtlePath: outline.turtlePath,
    },
    null,
    2,
  );
}

export function parseOutline(text) {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    const data = JSON.parse(t);
    if (Array.isArray(data)) {
      return { name: "Custom", startPoint: [0, 0], startAngle: 0, turtlePath: data };
    }
    const path = data.turtlePath || data.segs || data.segments;
    if (!path) throw new Error("JSON has no turtlePath");
    return {
      name: data.name || "Custom",
      startPoint: data.startPoint || [0, 0],
      startAngle: data.startAngle ?? 0,
      turtlePath: path.map((s) =>
        Array.isArray(s) ? [Number(s[0]), Number(s[1])] : [Number(s.len), Number(s.ang)],
      ),
    };
  }
  const turtlePath = [];
  for (const line of t.split(/\r?\n/)) {
    const clean = line.replace(/[\[\]]/g, "").trim();
    if (!clean) continue;
    const parts = clean.split(/[,\s]+/).map(Number).filter((n) => !Number.isNaN(n));
    for (let i = 0; i + 1 < parts.length; i += 2) {
      turtlePath.push([parts[i], parts[i + 1]]);
    }
  }
  if (!turtlePath.length) throw new Error("No segments found");
  return { name: "Custom", startPoint: [0, 0], startAngle: 0, turtlePath };
}
