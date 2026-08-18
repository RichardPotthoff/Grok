/** Turtle-path math — same API as Notebooks/anywidget turtle-graphics.js */

export function TurtlePathLengthArea(TurtlePath, arcStartAngle = 0) {
  let totalLength = 0;
  let totalArea = 0;
  let firstMoment = [0, 0];
  let arcStartPoint = [0, 0];
  let arcEndAngle = 0;
  for (let [arcLength, arcAngle] of TurtlePath) {
    const halfArcAngle = arcAngle / 2;
    const chordAngle = arcStartAngle + halfArcAngle;
    const cosChordAngle = Math.cos(chordAngle);
    const sinChordAngle = Math.sin(chordAngle);

    totalLength += arcLength;
    let chordLength;
    if (arcAngle !== 0) {
      if (arcLength !== 0) {
        const radius = arcLength / arcAngle;
        const sinHalfArcAngle = Math.sin(halfArcAngle);
        chordLength = radius * sinHalfArcAngle * 2;
        const arcSegmentArea = 0.5 * radius ** 2 * (arcAngle - Math.sin(arcAngle));
        const y_a = (2 / 3) * (radius * sinHalfArcAngle) ** 3;
        totalArea += arcSegmentArea;
        firstMoment[0] +=
          arcSegmentArea * (arcStartPoint[0] - radius * Math.sin(arcStartAngle)) +
          y_a * sinChordAngle;
        firstMoment[1] +=
          arcSegmentArea * (arcStartPoint[1] + radius * Math.cos(arcStartAngle)) -
          y_a * cosChordAngle;
      } else {
        chordLength = 0;
      }
    } else {
      chordLength = arcLength;
    }

    const arcEndPoint = [
      arcStartPoint[0] + chordLength * cosChordAngle,
      arcStartPoint[1] + chordLength * sinChordAngle,
    ];
    arcEndAngle = arcStartAngle + arcAngle;

    const triangleArea =
      (arcStartPoint[0] * arcEndPoint[1] - arcEndPoint[0] * arcStartPoint[1]) / 2;
    totalArea += triangleArea;
    firstMoment[0] += (triangleArea * (arcStartPoint[0] + arcEndPoint[0])) / 3;
    firstMoment[1] += (triangleArea * (arcStartPoint[1] + arcEndPoint[1])) / 3;

    arcStartPoint = arcEndPoint;
    arcStartAngle = arcEndAngle;
  }

  const centroid = [firstMoment[0] / totalArea, firstMoment[1] / totalArea];
  return [totalLength, totalArea, arcStartPoint, arcEndAngle, centroid];
}

/**
 * Walk a turtle path of [length, angleRadians] segments.
 * Yields { point:[x,y], angle:[cos,sin], length, segmentIndex }.
 *
 * Angle here is a heading as [cos, sin] — same as the original module.
 */
export function* Segments2Complex({
  p0_a0_segs = [
    [
      [0, 0],
      [1, 0],
    ],
    [],
  ],
  scale = 1.0,
  tol = 0.05,
  offs = 0,
  loops = 1,
  return_start = false,
} = {}) {
  const [p0, a0] = p0_a0_segs[0];
  const Segs = p0_a0_segs[1];
  let a = a0.slice();
  let p = p0.slice();
  p[0] = p[0] - a[0] * offs;
  p[1] = p[1] - a[1] * offs;
  let L = 0;

  if (return_start) {
    yield { point: p.slice(), angle: a.slice(), length: L, segmentIndex: -1 };
  }

  let loopcount = 0;
  while (loops === null || loops === Infinity || loopcount < loops) {
    loopcount++;
    for (let X = 0; X < Segs.length; X++) {
      let [l, da] = Segs[X];
      l *= scale;
      if (da !== 0) {
        let r = l / da;
        r += offs;
        let n;
        let v;
        if (r !== 0) {
          l = r * da;
          const dl = 2 * Math.sqrt(2 * Math.abs(r) * tol);
          n = Math.max(
            Math.ceil((6 * Math.abs(da)) / (2 * Math.PI)),
            Math.floor(l / dl) + 1,
          );
          const dda2 = [Math.cos((0.5 * da) / n), Math.sin((0.5 * da) / n)];
          v = [2 * r * dda2[1] * dda2[0], 2 * r * dda2[1] * dda2[1]];
          v = [v[0] * a[0] - v[1] * a[1], v[0] * a[1] + v[1] * a[0]];
        } else {
          n = 1;
          v = [0, 0];
        }
        const dda = [Math.cos(da / n), Math.sin(da / n)];
        for (let i = 0; i < n; i++) {
          L += l / n;
          p[0] += v[0];
          p[1] += v[1];
          a = [a[0] * dda[0] - a[1] * dda[1], a[0] * dda[1] + a[1] * dda[0]];
          yield { point: p.slice(), angle: a.slice(), length: L, segmentIndex: X };
          v = [v[0] * dda[0] - v[1] * dda[1], v[0] * dda[1] + v[1] * dda[0]];
        }
      } else {
        L += l;
        p[0] += l * a[0];
        p[1] += l * a[1];
        yield { point: p.slice(), angle: a.slice(), length: L, segmentIndex: X };
      }
    }
    if (loops === 1) break;
  }
}

export function plot_segments(
  ctx,
  {
    p0 = [0, 0],
    a0 = [1, 0],
    segs = [],
    scale = 1.0,
    tol = 0.05,
    offs = 0,
    loops = 1,
    return_start = true,
  } = {},
) {
  const gen = Segments2Complex({
    p0_a0_segs: [
      [p0, a0],
      segs,
    ],
    scale,
    tol,
    offs: 0,
    loops,
    return_start,
  });
  ctx.beginPath();
  const first = gen.next();
  if (first.done) return;
  const { point, angle } = first.value;
  const [cos_ang, sin_ang] = angle;
  ctx.moveTo(point[0] - offs * sin_ang, point[1] + offs * cos_ang);
  for (const step of gen) {
    const [c, s] = step.angle;
    ctx.lineTo(step.point[0] - offs * s, step.point[1] + offs * c);
  }
  ctx.stroke();
}
