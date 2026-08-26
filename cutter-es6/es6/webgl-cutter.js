/**
 * WebGL cookie-cutter preview: extrude(outline, fixed Blade).
 *
 *   const view = new WebGLCutter(canvas);
 *   view.setOutline(outline, { scale: 11 });
 *   view.setAnimate(true);
 *   view.destroy();
 */

import { extrude } from "./geometry.js";
import { getOutline } from "./cookiecutters.js";
import { outlineToEpath, centerEpath, boundsOf } from "./path-utils.js";
import * as M4 from "./m4.js";

const DEG = Math.PI / 180;

const vertexShaderSource = `
attribute vec4 a_position;
attribute vec4 a_normal;
uniform mat4 u_matrix;
varying vec4 v_color;
void main() {
  gl_Position = u_matrix * a_position;
  float wxp = max(a_normal.x, 0.0);
  float wxn = max(-a_normal.x, 0.0);
  float wyp = max(a_normal.y, 0.0);
  float wyn = max(-a_normal.y, 0.0);
  float wzp = max(a_normal.z, 0.0);
  float wzn = max(-a_normal.z, 0.0);
  v_color = vec4(0.12, 0.11, 0.10, 1.0);
  v_color.xyz += wxp*wxp * vec3(0.92, 0.82, 0.62);
  v_color.xyz += wxn*wxn * vec3(0.35, 0.62, 0.60);
  v_color.xyz += wyp*wyp * vec3(0.70, 0.78, 0.58);
  v_color.xyz += wyn*wyn * vec3(0.45, 0.38, 0.32);
  v_color.xyz += wzp*wzp * vec3(0.55, 0.70, 0.86);
  v_color.xyz += wzn*wzn * vec3(0.78, 0.72, 0.40);
}
`;

const fragmentShaderSource = `
precision mediump float;
varying vec4 v_color;
void main() { gl_FragColor = v_color; }
`;

export class WebGLCutter {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.animate = opts.animate ?? true;
    this.bladeScale = opts.bladeScale ?? 5;
    this.outlineScale = opts.outlineScale ?? 11;
    this.camera = {
      fov: 30 * DEG,
      target: [0, 0, 0],
      azim: 30 * DEG,
      elev: 40 * DEG,
      dist: 400,
    };
    this.mesh = { vertices: new Float32Array(0), indices: new Uint16Array(0), stride: 24, numVertices: 0 };
    this.onAnimate = opts.onAnimate || (() => {});
    this._raf = 0;
    this._dragging = false;
    this._prev = [0, 0];
    this._pinchDist = 0;
    this._listeners = [];

    if (!this.gl) {
      console.warn("WebGLCutter: WebGL not available");
      return;
    }

    this._initGL();
    this._bindInput();

    if (opts.outline) this.setOutline(opts.outline, { scale: this.outlineScale });
    this._loop();
  }

  setOutline(outline, { scale, bladeScale } = {}) {
    if (scale != null) this.outlineScale = scale;
    if (bladeScale != null) this.bladeScale = bladeScale;
    if (!this.gl) return;
    if (!outline?.turtlePath?.length) {
      this.mesh = { vertices: new Float32Array(0), indices: new Uint16Array(0), stride: 24, numVertices: 0 };
      this._upload();
      return;
    }
    const epath = centerEpath(outlineToEpath(outline, { scale: this.outlineScale, tol: 0.08 }));
    const blade = getOutline("Blade");
    const spath = outlineToEpath(blade, { scale: this.bladeScale, tol: 0.05 });
    this.mesh = extrude(epath, spath);
    const b = boundsOf(epath.map(([p]) => p));
    const zExt = boundsOf(spath.map(([p]) => p));
    const span = Math.max(b.w, b.h, zExt.h, 40);
    this.camera.dist = span * 2.6;
    this.camera.target = [0, 0, 0];
    this._upload();
    if (!this.animate) this._draw();
  }

  setAnimate(on) {
    const next = !!on;
    const changed = next !== this.animate;
    this.animate = next;
    if (!next && this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    if (next) this._loop();
    if (changed) this.onAnimate(next);
  }

  destroy() {
    this.animate = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    const c = this.canvas;
    for (const [type, fn, opts] of this._listeners) {
      c.removeEventListener(type, fn, opts);
    }
    this._ro?.disconnect();
  }

  _initGL() {
    const gl = this.gl;
    const vs = compile(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("WebGLCutter link", gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);
    this.program = program;
    this.positionLoc = gl.getAttribLocation(program, "a_position");
    this.normalLoc = gl.getAttribLocation(program, "a_normal");
    this.matrixLoc = gl.getUniformLocation(program, "u_matrix");
    this.vbo = gl.createBuffer();
    this.ibo = gl.createBuffer();
  }

  _upload() {
    const gl = this.gl;
    if (!gl) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.mesh.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indices, gl.STATIC_DRAW);
  }

  _bindInput() {
    const c = this.canvas;
    c.style.touchAction = "none";
    const on = (type, fn, opts) => {
      c.addEventListener(type, fn, opts);
      this._listeners.push([type, fn, opts]);
    };

    on("pointerdown", (e) => {
      if (e.pointerType === "touch" && e.isPrimary === false) return;
      c.setPointerCapture(e.pointerId);
      this._dragging = true;
      this._prev = [e.clientX, e.clientY];
      this.setAnimate(false);
    });
    on("pointermove", (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._prev[0];
      const dy = e.clientY - this._prev[1];
      this.camera.azim = (this.camera.azim - dx * 0.008) % (Math.PI * 2);
      this.camera.elev = Math.max(
        -Math.PI / 2 + 0.05,
        Math.min(Math.PI / 2 - 0.05, this.camera.elev + dy * 0.008),
      );
      this._prev = [e.clientX, e.clientY];
      if (!this.animate) this._draw();
    });
    on("pointerup", () => {
      this._dragging = false;
    });
    on("pointercancel", () => {
      this._dragging = false;
    });
    on(
      "wheel",
      (e) => {
        e.preventDefault();
        this.camera.dist *= e.deltaY < 0 ? 0.92 : 1.08;
        this.camera.dist = Math.max(40, Math.min(8000, this.camera.dist));
        if (!this.animate) this._draw();
      },
      { passive: false },
    );
    on(
      "touchmove",
      (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
          if (this._pinchDist) {
            this.camera.dist *= this._pinchDist / d;
            this.camera.dist = Math.max(40, Math.min(8000, this.camera.dist));
            if (!this.animate) this._draw();
          }
          this._pinchDist = d;
        }
      },
      { passive: false },
    );
    on("touchend", () => {
      this._pinchDist = 0;
    });

    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this._draw());
      this._ro.observe(c);
    }
  }

  _loop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    const tick = () => {
      if (!this.animate) {
        this._raf = 0;
        return;
      }
      this.camera.azim = (this.camera.azim + 0.012) % (Math.PI * 2);
      this._draw();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _draw() {
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
    if (!this.mesh.indices.length) return;

    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 3, gl.FLOAT, false, this.mesh.stride, 0);
    gl.enableVertexAttribArray(this.normalLoc);
    gl.vertexAttribPointer(this.normalLoc, 3, gl.FLOAT, false, this.mesh.stride, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

    const asp = Math.max(rect.width, 1) / Math.max(rect.height, 1);
    const proj = M4.persp(this.camera.fov, asp, Math.max(1, this.camera.dist / 50), this.camera.dist * 4);
    const view = M4.camMat(this.camera.target, this.camera.azim, this.camera.elev, this.camera.dist);
    const vp = M4.mMul(proj, view);
    gl.uniformMatrix4fv(this.matrixLoc, false, new Float32Array(vp));
    gl.drawElements(gl.TRIANGLES, this.mesh.indices.length, gl.UNSIGNED_SHORT, 0);
  }
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("WebGLCutter shader", gl.getShaderInfoLog(sh));
  }
  return sh;
}
