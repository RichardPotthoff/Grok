// Test script for the new analytic ATA / intersect.
// Paste into a drawing_anyui script tab and Run.
// Explores start pose, several end poses, and r0/rt/r1 combinations.
// Also times buffer-reused calls.

const deg = Math.PI / 180;
const start = [0, 0, 0];

const ends = [
  [2, 1, 90 * deg],
  [3, 0, 0],
  [1, 2, 180 * deg],
  [0, 3, 90 * deg],
  [-1, 1, -90 * deg],
  [4, -1, 45 * deg],
];

const radiiSets = [
  [1, 0.5, 1],
  [1, 0, 1],          // rt = 0 (intersection)
  [1, Infinity, 1],
  [2, -1, 0.5],
  [Infinity, 1, Infinity], // fillet-like
  [0, 1, 0],
  [1.5, 0, Infinity],
];

print("=== signed / best samples ===");
for (const end of ends) {
  for (const rad of radiiSets) {
    const signed = ataSigned(start, end, rad[0], rad[1], rad[2]);
    const best = ataBest(start, end, rad);
    const sLen = signed ? [...signed.arcs()].reduce((a, [s]) => a + Math.abs(s), 0) : null;
    const bCurv = best ? best.curv : null;
    print(
      "end", end.map(v => +v.toFixed(2)),
      "r", rad,
      "signedLen", sLen && +sLen.toFixed(3),
      "bestCurv", bCurv && +bCurv.toFixed(3),
      "bestR", best && [best.r0, best.rt, best.r1]
    );
    // show a few interesting ones
    if (rad[1] === 0 && end[0] === 2) {
      if (signed) show(signed, { stroke: "red", width: 0.05 });
      if (best) show(best.block, { stroke: "blue", width: 0.03 });
    }
  }
}

// performance: many calls, reused buffer
print("=== timing (buffer reuse) ===");
const buf = new Float64Array(8);
const N = 2000;
const t0 = performance.now();
let hits = 0;
for (let i = 0; i < N; i++) {
  const end = ends[i % ends.length];
  const rad = radiiSets[i % radiiSets.length];
  const b = ataBest(start, end, rad);
  if (b) hits++;
  // also raw intersect
  intersectCC(0, 1, 1, end[0], end[1], 1, buf);
}
const ms = performance.now() - t0;
print(`N=${N}  hits=${hits}  ${ms.toFixed(1)} ms  (${(N / (ms / 1000)).toFixed(0)} calls/s)`);

// memory note: Float64Array(8) reused; no per-call Seq allocation in the intersect path.
// ataSigned still builds Arc/Seq objects (necessary for the block model).
print("done");
