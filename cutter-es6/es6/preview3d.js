/**
 * Small orbit viewer for a toolpath tube. Same lighting idea as the
 * cookie-cutter preview, but the mesh is a sweep along an existing path.
 */

import * as M4 from "./m4.js";

const DEG = Math.PI / 180;

const VS = `
attribute vec3 a_position;
attribute vec3 a_normal;
uniform mat4 u_matrix;
varying vec4 v_color;
void main() {
  gl_Position = u_matrix * vec4(a_position, 1.0);
  float wxp = max(a_normal.x, 0.0);
  float wxn = max(-a_normal.x, 0.0);
  float wyp = max(a_normal.y, 0.0);
  float wyn = max(-a_normal.y, 0.0);
  float wzp = max(a_normal.z, 0.0);
  float wzn = max(-a_normal.z, 0.0);
  v_color = vec4(0.10, 0.09, 0.08, 1.0);
  v_color.xyz += wxp*wxp * vec3(0.92, 0.82, 0.62);
  v_color.xyz += wxn*wxn * vec3(0.35, 0.62, 0.60);
  v_color.xyz += wyp*wyp * vec3(0.70, 0.78, 0.58);
  v_color.xyz += wyn*wyn * vec3(0.45, 0.38, 0.32);
  v_color.xyz += wzp*wzp * vec3(0.55, 0.70, 0.86);
  v_color.xyz += wzn*wzn * vec3(0.78, 0.72, 0.40);
}
`;

const FS = `
precision mediump float;
varying vec4 v_color;
void main() { gl_FragColor = v_color; }
`;

export class PathView {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    this.camera = { fov: 30 * DEG, target: [0, 0, 0], azim: 35 * DEG, elev: 28 * DEG, dist: 80 };
    this.mesh = null;
    this._dragging = false;
    this._prev = [0, 0];
    this._pinch = 0;
    if (!this.gl) return;
    this._init();
    this._bind();
    this.draw();
  }

  setMesh(mesh) {
    this.mesh = mesh && mesh.indices && mesh.indices.length ? mesh : null;
    if (!this.gl) return;
    const gl = this.gl;
    if (this.mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.mesh.vertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indices, gl.STATIC_DRAW);
      this._fit();
    }
    this.draw();
  }

  _fit() {
    const v = this.mesh.vertices;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < v.length; i += 6) {
      const x = v[i], y = v[i + 1], z = v[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    this.camera.target = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 10);
    this.camera.dist = span * 2.4;
  }

  _init() {
    const gl = this.gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this.prog = prog;
    this.pos = gl.getAttribLocation(prog, "a_position");
    this.nrm = gl.getAttribLocation(prog, "a_normal");
    this.mat = gl.getUniformLocation(prog, "u_matrix");
    this.vbo = gl.createBuffer();
    this.ibo = gl.createBuffer();
  }

  _bind() {
    const c = this.canvas;
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      this._dragging = true;
      this._prev = [e.clientX, e.clientY];
    });
    c.addEventListener("pointermove", (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._prev[0];
      const dy = e.clientY - this._prev[1];
      this.camera.azim = (this.camera.azim - dx * 0.008) % (Math.PI * 2);
      this.camera.elev = Math.max(-1.2, Math.min(1.2, this.camera.elev + dy * 0.008));
      this._prev = [e.clientX, e.clientY];
      this.draw();
    });
    c.addEventListener("pointerup", () => { this._dragging = false; });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.camera.dist *= e.deltaY < 0 ? 0.92 : 1.08;
      this.draw();
    }, { passive: false });
    c.addEventListener("touchmove", (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (this._pinch) this.camera.dist *= this._pinch / d;
      this._pinch = d;
      this.draw();
    }, { passive: false });
    c.addEventListener("touchend", () => { this._pinch = 0; });
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this.draw());
      this._ro.observe(c);
    }
  }

  draw() {
    const gl = this.gl;
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.086, 0.082, 0.075, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.mesh) return;
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.pos);
    gl.vertexAttribPointer(this.pos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this.nrm);
    gl.vertexAttribPointer(this.nrm, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    const asp = Math.max(rect.width, 1) / Math.max(rect.height, 1);
    const proj = M4.persp(this.camera.fov, asp, Math.max(0.5, this.camera.dist / 50), this.camera.dist * 6);
    const view = M4.camMat(this.camera.target, this.camera.azim, this.camera.elev, this.camera.dist);
    gl.uniformMatrix4fv(this.mat, false, new Float32Array(M4.mMul(proj, view)));
    const n = this.mesh.indices.length;
    const type = n > 65535 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    if (type === gl.UNSIGNED_INT && !gl.getExtension("OES_element_index_uint")) {
      gl.drawElements(gl.TRIANGLES, Math.min(n, 65535), gl.UNSIGNED_SHORT, 0);
      return;
    }
    if (type === gl.UNSIGNED_SHORT && this.mesh.indices instanceof Uint32Array) {
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.mesh.indices), gl.STATIC_DRAW);
    }
    gl.drawElements(gl.TRIANGLES, n, type, 0);
  }

  destroy() {
    this._ro?.disconnect();
  }
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function renderPreview3d({ model, el }) {
  el.replaceChildren();
  el.classList.add("stage-slot");
  el.style.display = "flex";
  el.style.flex = "1 1 auto";
  el.style.minWidth = "0";
  el.style.minHeight = "0";
  el.style.position = "relative";
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  el.append(canvas);
  const view = new PathView(canvas);
  model._view = view;
  const mesh = model.get("mesh");
  if (mesh) view.setMesh(mesh);
  model.on("change:mesh", () => view.setMesh(model.get("mesh")));
  requestAnimationFrame(() => view.draw());
}
