/**
 * WebGLCutterWidget: wraps the WebGL 3D preview.
 * Reusable in Jupyter (via anywidget) or standalone.
 * Emits events: none (display-only by default)
 */

import { WebGLCutter } from "../webgl-cutter.js";

export class WebGLCutterWidget {
  constructor(opts = {}) {
    this.opts = { width: 400, height: 300, ...opts };
    this.viewer = null;
    this.el = null;
    this.outline = opts.outline || {
      name: "Custom",
      startPoint: [0, 0],
      startAngle: 0,
      turtlePath: [],
    };
    this._listeners = new Map();
  }

  async create_view({ el }) {
    this.el = el;

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.id = "view";
    canvas.width = this.opts.width;
    canvas.height = this.opts.height;
    canvas.style.cssText = "width:100%;height:100%;display:block;";
    this.el.appendChild(canvas);

    // Add spin button
    const spinBtn = document.createElement("button");
    spinBtn.id = "spin";
    spinBtn.className = "spin";
    spinBtn.type = "button";
    spinBtn.textContent = "Spin";
    spinBtn.style.cssText =
      "position:absolute;bottom:10px;left:10px;z-index:2;background:rgba(18,17,15,0.8);color:#ece7dc;border:1px solid rgba(236,231,220,0.12);border-radius:8px;padding:8px 12px;min-height:40px;font:inherit;cursor:pointer;";
    this.el.appendChild(spinBtn);

    // Instantiate WebGLCutter (core logic)
    this.viewer = new WebGLCutter(canvas, {
      outline: this.outline,
      outlineScale: this.opts.outlineScale || 11,
      bladeScale: this.opts.bladeScale || 5,
      animate: true,
    });

    // Spin button toggles animation
    spinBtn.addEventListener("click", () => this.viewer.setAnimate(true));

    return this;
  }

  setOutline(outline, opts = {}) {
    if (this.viewer) {
      this.viewer.setOutline(outline, opts);
      this.outline = outline;
    }
  }

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(cb);
  }

  _emit(event, value) {
    const cbs = this._listeners.get(event) || [];
    cbs.forEach((cb) => cb(value));
  }
}
