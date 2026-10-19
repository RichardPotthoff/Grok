/**
 * Rail icons drawn with the same arc API as the page.
 * Flatten a block to a stroke, then reuse tool-icons SVG (exact arcs).
 */

import { Arc, Seq, Scale } from "./blocks.js";
import { drawingToSvg } from "./tool-icons.js";

function seg(s, dtheta = 0) {
  return new Arc(s, dtheta);
}
function turn(dtheta) {
  return new Arc(0, dtheta);
}
function seq(...items) {
  return new Seq(items.flat());
}
function scale(b, k) {
  return new Scale(b, k);
}

/**
 * Folder outline. af = flap angle in degrees (0 closed, ~20 open).
 * Port of the REPL sketch: one continuous arc chain.
 */
export function folderIcon(af = 0, w = 10, h = 8, lf = 5.5, ht = 1, wt = 4, rt = 0.5) {
  const DEG = Math.PI / 180;
  const r90r = seg(rt * 90 * DEG, -90);
  const l90 = turn(90);
  const r90 = turn(-90);
  const hf = lf * Math.cos(af * DEG);
  return seq(
    seg(w),
    turn(90 - af),
    seg(lf),
    turn(90 + af),
    seg(w),
    turn(90 - af),
    seg(lf),
    turn(180 + af),
    seg(h - rt),
    r90r,
    seg(wt - 2 * rt),
    r90r,
    seg(ht - rt),
    l90,
    seg(w - wt),
    r90,
    seg(h - ht - hf),
  );
}

/** Three stacked lines — log. */
export function logIcon() {
  return seq(
    seg(8),
    turn(90),
    seg(2.2, 0),
    turn(90),
    seg(8),
    turn(-90),
    seg(2.2),
    turn(-90),
    seg(8),
  );
}

/** Two offset rounded squares — objects. */
export function objectsIcon() {
  const box = seq(seg(5), turn(90), seg(4), turn(90), seg(5), turn(90), seg(4), turn(90));
  return seq(box, turn(20), seg(1.6), turn(-20), box);
}

/** Left-pointing chevron. */
export function chevronLeft() {
  return seq(turn(140), seg(5), turn(-100), seg(5));
}

/** Right-pointing chevron. */
export function chevronRight() {
  return seq(turn(40), seg(5), turn(100), seg(5));
}

function strokeOf(block, opts = {}) {
  const path = [];
  for (const row of block.arcs()) path.push([row[0], row[1]]);
  return {
    startPoint: opts.at || [0, 0],
    startAngle: opts.heading || 0,
    turtlePath: path,
    stroke: opts.stroke || "ink",
    width: opts.width == null ? 1.4 : opts.width,
    fill: opts.fill || null,
  };
}

export function iconSvg(block, opts = {}) {
  const drawing = { paths: [strokeOf(block, opts)] };
  return drawingToSvg(drawing, {
    size: opts.size || 20,
    theme: "dark",
    background: false,
    currentColor: true,
    pad: opts.pad ?? 1.4,
  });
}

export const RAIL = {
  files: iconSvg(scale(folderIcon(0), 0.9), { width: 1.2 }),
  filesOpen: iconSvg(scale(folderIcon(22), 0.9), { width: 1.2 }),
  log: iconSvg(logIcon(), { width: 1.3 }),
  objects: iconSvg(objectsIcon(), { width: 1.2 }),
  hideLeft: iconSvg(chevronLeft(), { width: 1.6 }),
  hideRight: iconSvg(chevronRight(), { width: 1.6 }),
};
