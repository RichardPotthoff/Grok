// geometry.js — cube, circle, extrude (same algorithm as Notebooks/anywidget)

export function cube(dx = 1, dy, dz) {
  const numVertices = 24;
  const stride = 6 * 4;
  const X = 0.5 * dx;
  const Y = dy == null ? X : dy;
  const Z = dz == null ? X : dz;
  const vertices = new Float32Array([
    X, -Y, -Z, 1, 0, 0, X, Y, -Z, 1, 0, 0, X, Y, Z, 1, 0, 0, X, -Y, Z, 1, 0, 0,
    -X, Y, Z, -1, 0, 0, -X, Y, -Z, -1, 0, 0, -X, -Y, -Z, -1, 0, 0, -X, -Y, Z, -1, 0, 0,
    -X, Y, -Z, 0, 1, 0, -X, Y, Z, 0, 1, 0, X, Y, Z, 0, 1, 0, X, Y, -Z, 0, 1, 0,
    X, -Y, Z, 0, -1, 0, -X, -Y, Z, 0, -1, 0, -X, -Y, -Z, 0, -1, 0, X, -Y, -Z, 0, -1, 0,
    -X, -Y, Z, 0, 0, 1, X, -Y, Z, 0, 0, 1, X, Y, Z, 0, 0, 1, -X, Y, Z, 0, 0, 1,
    X, Y, -Z, 0, 0, -1, X, -Y, -Z, 0, 0, -1, -X, -Y, -Z, 0, 0, -1, -X, Y, -Z, 0, 0, -1,
  ]);
  const indices = new Int16Array([
    0, 1, 2, 2, 3, 0, 4, 5, 6, 6, 7, 4, 8, 9, 10, 10, 11, 8,
    12, 13, 14, 14, 15, 12, 16, 17, 18, 18, 19, 16, 20, 21, 22, 22, 23, 20,
  ]);
  return { indices, vertices, stride, numVertices };
}

export function circle(r, n) {
  const epath = [];
  for (let i = 0; i < n; i++) {
    const theta = (i * 2 * Math.PI) / n;
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    epath[i] = [
      [r * c, r * s],
      [-s, c],
    ];
  }
  return epath;
}

export function extrude(epath, shape) {
  const m = epath.length;
  const n = shape.length;
  const numVertices = m * n;
  const vertices = new Float32Array(numVertices * 6);
  const stride = 6 * 4;
  const indices = new Uint16Array(numVertices * 6);
  for (let j = 0; j < m; j++) {
    const [[x_p, y_p], [ms_p, c_p]] = epath[j];
    for (let i = 0; i < n; i++) {
      const [[x_s, y_s], [ms_s, c_s]] = shape[i];
      const k = j * n + i;
      vertices[k * 6 + 0] = x_p + x_s * c_p;
      vertices[k * 6 + 1] = y_p - x_s * ms_p;
      vertices[k * 6 + 2] = y_s;
      vertices[k * 6 + 3] = c_s * c_p;
      vertices[k * 6 + 4] = -c_s * ms_p;
      vertices[k * 6 + 5] = -ms_s;
      indices[k * 6 + 0] = j * n + i;
      indices[k * 6 + 1] = ((j + 1) % m) * n + ((i + 1) % n);
      indices[k * 6 + 2] = j * n + ((i + 1) % n);
      indices[k * 6 + 3] = j * n + i;
      indices[k * 6 + 4] = ((j + 1) % m) * n + i;
      indices[k * 6 + 5] = ((j + 1) % m) * n + ((i + 1) % n);
    }
  }
  return { indices, vertices, stride, numVertices };
}
