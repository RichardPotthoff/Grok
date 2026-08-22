/**
 * Parametric shape builder: encode shapes as compact instructions.
 * Each shape is defined by a base path, mirror/repeat instructions.
 * Replaces hardcoded cookiecutters.js data.
 */

export const SHAPE_INSTRUCTIONS = {
  Star: {
    base: [[2, -58], [8, 0], [3.2, 130]],
    mirror: true,
    repeat: 5,
    name: "Star",
  },
  Heart: {
    base: [[0.45, -45], [10, 180], [6.91, -10], [1.1, 110]],
    mirror: "y",
    repeat: 1,
    rotStart: 180,
    name: "Heart",
  },
  Scalloped: {
    base: [[1, -110], [2, 150]],
    mirror: false,
    repeat: 9,
    name: "Scalloped",
  },
  Duck: {
    base: [
      [0.4, -10], [13.297, 25], [3, -80], [4, 160],
      [22.913, 90], [15, 90], [5, -90], [5, 20],
      [3, 170], [2, -20], [3, -90], [15, 220], [5, -125],
    ],
    mirror: false,
    repeat: 1,
    rotStart: 180,
    name: "Duck",
  },
  Tree: {
    base: [[0.75, 40], [3, 0], [1.5, 140], [0.6, 0], [1, -140]],
    mirror: false,
    repeat: 3,
    rotStart: 180,
    name: "Tree",
  },
  Plain: {
    base: [[62.83185, 360]],
    mirror: false,
    repeat: 1,
    rotStart: 90,
    startPoint: [10, 0],
    name: "Plain",
  },
  Blade: {
    base: [
      [3.6, 0], [0, 45], [0.661522368915, 0], [3, 90], [2.5, 0],
      [0, -43.5679], [10, 0], [0, 88.5679], [0.5, 0], [0, 88.5679],
      [10, 0], [0, -43.5679], [2.5, 0], [3, 90], [0.661522368915, 0], [0, 45],
    ],
    mirror: false,
    repeat: 1,
    startPoint: [-1.8, 0],
    name: "Blade",
  },
  L: {
    base: [
      [8, 0], [0, 90], [4, 0], [0, 90], [8, 0], [0, -180],
      [8, 0], [0, 90], [4, 0], [0, 90], [8, 0], [0, 90],
      [8, 0], [0, -90], [16, 0], [0, 90], [8, 0], [0, 90],
      [4, 0], [0, 90], [8, 0], [0, -180], [8, 0], [0, 90],
      [4, 0], [0, 90], [8, 0], [0, -180], [8, 0], [0, 90],
      [4, 0], [0, 90], [8, 0], [0, -180], [8, 0], [0, 90],
      [4, 0], [0, 90], [8, 0], [0, -180], [8, 0], [0, 90],
      [4, 0], [0, 90], [16, 0], [0, -180], [16, 0], [0, 90],
      [4, 0], [0, 90], [4, 0], [0, 90], [24, 0], [0, -180],
      [24, 0], [0, 90], [4, 0], [0, 90], [8, 0], [0, -180],
    ],
    mirror: false,
    repeat: 1,
    name: "L",
  },
  A: {
    base: [
      [0, 70], [0.4, 0], [0, -70], [0.41, 0], [0, 180], [0.41, 0],
      [0, -110], [0.6, 0], [0, -140], [1, 0], [0, 70],
    ],
    mirror: false,
    repeat: 1,
    name: "A",
  },
  B: {
    base: [
      [0, 90], [1, 0], [0, -90], [0.25, 0], [0.684, -180], [0.25, 0],
      [0, 180], [0.25, 0], [0.896, -180], [0.25, 0], [0, 180],
    ],
    mirror: false,
    repeat: 1,
    name: "B",
  },
};

function buildShape(instr) {
  let path = [...instr.base];

  // Mirror if needed
  if (instr.mirror === true) {
    const mirrored = instr.base.map(([len, ang]) => [len, -ang]);
    path = [...instr.base, ...mirrored];
  } else if (instr.mirror === "y") {
    const mirrored = instr.base.map(([len, ang]) => [len, 180 - ang]);
    path = [...instr.base, ...mirrored];
  }

  // Repeat sequence
  if (instr.repeat > 1) {
    const repeated = path.slice();
    for (let i = 1; i < instr.repeat; i++) {
      path = [...path, ...repeated];
    }
  }

  return {
    name: instr.name,
    startAngle: instr.rotStart || 0,
    startPoint: instr.startPoint || [0, 0],
    turtlePath: path,
  };
}

export const OUTLINE_NAMES = Object.keys(SHAPE_INSTRUCTIONS);

export function getOutline(name) {
  const instr = SHAPE_INSTRUCTIONS[name];
  if (!instr) return null;
  return buildShape(instr);
}
