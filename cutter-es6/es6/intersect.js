/**
 * Analytic intersections of circles, lines, and points.
 *
 * Accepts +0/-0 (point) and ±Infinity (directed line).
 * Returns 0–2 solutions. Parameters t are arc-length (circle) or
 * line-parameter distances; negative means behind the reference pose.
 * No epsilon policy: tiny values are returned as computed.
 *
 * Buffer form (optional): writes into a Float64Array or number[]
 * of length ≥ 8: [x0,y0,t0_0,t1_0, x1,y1,t0_1,t1_1]
 * Returns the hit count.
 */

const TAU = Math.PI * 2;

function isZero(v) {
  return Object.is(v, 0) || Object.is(v, -0);
}
function isInf(v) {
  return v === Infinity || v === -Infinity;
}

/** Stable circle-circle. r may be signed; we use absolute for geometry,
 *  but the caller decides orientation later. */
export function intersectCircleCircle(cx0, cy0, r0, cx1, cy1, r1, buf) {
  const R0 = Math.abs(r0);
  const R1 = Math.abs(r1);
  const dx = cx1 - cx0;
  const dy = cy1 - cy0;
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2);
  if (d === 0) {
    // coincident or none; treat as none for finite distinct
    return 0;
  }
  // stable a = (R0² - R1² + d²) / (2d)
  const a = (R0 * R0 - R1 * R1 + d2) / (2 * d);
  const h2 = R0 * R0 - a * a;
  if (h2 < 0) return 0; // no real intersection (round-off may make tiny negative)
  const h = Math.sqrt(Math.max(0, h2));
  const ux = dx / d;
  const uy = dy / d;
  const px = cx0 + a * ux;
  const py = cy0 + a * uy;
  const hits = h === 0 ? 1 : 2;
  if (!buf) buf = new Array(8);
  // first
  buf[0] = px - h * uy;
  buf[1] = py + h * ux;
  buf[2] = paramOnCircle(cx0, cy0, r0, buf[0], buf[1]); // t0
  buf[3] = paramOnCircle(cx1, cy1, r1, buf[0], buf[1]); // t1
  if (hits === 2) {
    buf[4] = px + h * uy;
    buf[5] = py - h * ux;
    buf[6] = paramOnCircle(cx0, cy0, r0, buf[4], buf[5]);
    buf[7] = paramOnCircle(cx1, cy1, r1, buf[4], buf[5]);
  }
  return hits;
}

function paramOnCircle(cx, cy, r, x, y) {
  // signed arc length from the "bottom" or from angle 0? 
  // For turtle we usually measure from the incoming tangent point.
  // Here we return the angle from the vector (x-cx, y-cy) relative to +x, times |r|,
  // signed by the radius sign. Caller interprets.
  const ang = Math.atan2(y - cy, x - cx);
  return r * ang; // may be negative
}

/** Circle vs directed line (point + unit dir). */
export function intersectCircleLine(cx, cy, r, px, py, dx, dy, buf) {
  const R = Math.abs(r);
  // project center onto line
  const vx = cx - px;
  const vy = cy - py;
  const t = vx * dx + vy * dy; // parameter of closest point
  const qx = px + t * dx;
  const qy = py + t * dy;
  const dist2 = (cx - qx) ** 2 + (cy - qy) ** 2;
  if (dist2 > R * R) return 0;
  const h = Math.sqrt(Math.max(0, R * R - dist2));
  const hits = h === 0 ? 1 : 2;
  if (!buf) buf = new Array(8);
  buf[0] = qx - h * dx;
  buf[1] = qy - h * dy;
  buf[2] = paramOnCircle(cx, cy, r, buf[0], buf[1]);
  buf[3] = t - h; // line param
  if (hits === 2) {
    buf[4] = qx + h * dx;
    buf[5] = qy + h * dy;
    buf[6] = paramOnCircle(cx, cy, r, buf[4], buf[5]);
    buf[7] = t + h;
  }
  return hits;
}

/** Two directed lines. */
export function intersectLineLine(p0x, p0y, d0x, d0y, p1x, p1y, d1x, d1y, buf) {
  const cross = d0x * d1y - d0y * d1x;
  if (cross === 0) return 0; // parallel
  const vx = p1x - p0x;
  const vy = p1y - p0y;
  const t0 = (vx * d1y - vy * d1x) / cross;
  const t1 = (d0x * vy - d0y * vx) / cross;
  if (!buf) buf = new Array(8);
  buf[0] = p0x + t0 * d0x;
  buf[1] = p0y + t0 * d0y;
  buf[2] = t0;
  buf[3] = t1;
  return 1;
}

/** Dispatcher. c = {cx,cy,r} or {px,py,dx,dy} or {x,y} for point.
 *  For simplicity, detect by presence of keys or by r being 0/Inf. */
export function intersect(c0, c1, buf) {
  const z0 = isZero(c0.r);
  const z1 = isZero(c1.r);
  const i0 = isInf(c0.r);
  const i1 = isInf(c1.r);
  if (z0 && z1) {
    // point-point
    if (c0.x === c1.x && c0.y === c1.y) {
      if (!buf) buf = new Array(8);
      buf[0] = c0.x; buf[1] = c0.y; buf[2] = 0; buf[3] = 0;
      return 1;
    }
    return 0;
  }
  if (i0 && i1) return intersectLineLine(c0.px, c0.py, c0.dx, c0.dy, c1.px, c1.py, c1.dx, c1.dy, buf);
  if (i0) return intersectCircleLine(c1.cx, c1.cy, c1.r, c0.px, c0.py, c0.dx, c0.dy, buf); // swap
  if (i1) return intersectCircleLine(c0.cx, c0.cy, c0.r, c1.px, c1.py, c1.dx, c1.dy, buf);
  if (z0) return intersectCirclePoint(c1, c0.x, c0.y, buf);
  if (z1) return intersectCirclePoint(c0, c1.x, c1.y, buf);
  return intersectCircleCircle(c0.cx, c0.cy, c0.r, c1.cx, c1.cy, c1.r, buf);
}

function intersectCirclePoint(c, x, y, buf) {
  const dx = x - c.cx, dy = y - c.cy;
  if (Math.abs(dx*dx + dy*dy - c.r*c.r) > 1e-12 * Math.abs(c.r)) return 0; // still a tiny tol here for exactness; caller can ignore
  if (!buf) buf = new Array(8);
  buf[0] = x; buf[1] = y;
  buf[2] = paramOnCircle(c.cx, c.cy, c.r, x, y);
  buf[3] = 0;
  return 1;
}

// Re-export helpers for tests
export { isZero, isInf };
