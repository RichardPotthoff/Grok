/**
 * Exact-arc rigid motions and stitching.
 *
 * Rotate and mirror send circles to circles, so a turtle path stays a turtle
 * path with the same number of [s, Δθ] rows. Copies can be stitched into one
 * walk; overlapping segments are allowed.
 */

import { DEG, fitArc } from "./path-utils.js";
import { stepArc, walkExact, wrapPi } from "./close-path.js";

export function lastPose(outline) {
  const poses = walkExact(outline);
  return poses[poses.length - 1];
}

export function wrapDeg(d) {
  return wrapPi(d * DEG) / DEG;
}

export function rotateStroke(stroke, deg, origin = [0, 0]) {
  const φ = deg * DEG;
  const c = Math.cos(φ);
  const s = Math.sin(φ);
  const [x, y] = stroke.startPoint || [0, 0];
  const [ox, oy] = origin;
  const dx = x - ox;
  const dy = y - oy;
  return {
    ...stroke,
    startPoint: [ox + c * dx - s * dy, oy + s * dx + c * dy],
    startAngle: (stroke.startAngle ?? 0) + deg,
    turtlePath: (stroke.turtlePath || []).map((seg) => [seg[0], seg[1]]),
  };
}

/** Reflect across the line through `origin` at `axisDeg` (0 = +x axis). */
export function mirrorStroke(stroke, axisDeg = 0, origin = [0, 0]) {
  const unrot = rotateStroke(stroke, -axisDeg, origin);
  const flipped = {
    ...unrot,
    startPoint: [unrot.startPoint[0], 2 * origin[1] - unrot.startPoint[1]],
    startAngle: -(unrot.startAngle ?? 0),
    turtlePath: (unrot.turtlePath || []).map(([len, ang]) => [len, -ang]),
  };
  return rotateStroke(flipped, axisDeg, origin);
}

/**
 * Append `b` onto `a` as one walk. If the end pose of `a` is not the start
 * pose of `b`, insert an exact fit-arc and a pure rotation (s = 0).
 */
export function appendStroke(a, b) {
  const end = lastPose(a);
  const bStart = b.startPoint || [0, 0];
  const bH = (b.startAngle ?? 0) * DEG;
  const segs = (a.turtlePath || []).map((seg) => seg.slice());
  const dx = bStart[0] - end.point[0];
  const dy = bStart[1] - end.point[1];
  if (Math.hypot(dx, dy) > 1e-8) {
    const fit = fitArc(end.point, end.heading, bStart);
    segs.push([fit.len, fit.ang]);
    const after = stepArc(end.point, end.heading, fit.len, fit.ang * DEG);
    const spin = wrapDeg((bH - after.heading) / DEG);
    if (Math.abs(spin) > 1e-6) segs.push([0, spin]);
  } else {
    const spin = wrapDeg((bH - end.heading) / DEG);
    if (Math.abs(spin) > 1e-6) segs.push([0, spin]);
  }
  for (const seg of b.turtlePath || []) segs.push([seg[0], seg[1]]);
  return {
    ...a,
    turtlePath: segs,
  };
}

export function repeatRotate(stroke, n, deg, origin = [0, 0]) {
  let acc = stroke;
  for (let i = 1; i < n; i++) acc = appendStroke(acc, rotateStroke(stroke, i * deg, origin));
  return acc;
}

/**
 * Polyline as turtle moves: optional in-place turns (s = 0) plus straight
 * segments. `startAngle` is the heading *before* the first corner turn.
 */
export function tracePoints(points, startAngle = 0, paint = {}) {
  if (!points.length) {
    return {
      startPoint: [0, 0],
      startAngle,
      turtlePath: [],
      ...paint,
    };
  }
  const segs = [];
  let h = startAngle;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const want = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    const turn = wrapDeg(want - h);
    if (Math.abs(turn) > 1e-6) segs.push([0, turn]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 1e-9) segs.push([len, 0]);
    h = want;
  }
  return {
    startPoint: points[0].slice(),
    startAngle,
    turtlePath: segs,
    stroke: paint.stroke || "ink",
    width: paint.width,
    fill: paint.fill || null,
    name: paint.name || "",
    id: paint.id || "",
  };
}

export function appendSegs(stroke, extra) {
  return {
    ...stroke,
    turtlePath: [...(stroke.turtlePath || []), ...extra],
  };
}
