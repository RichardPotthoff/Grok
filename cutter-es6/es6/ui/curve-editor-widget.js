/**
 * CurveEditorWidget: wraps the canvas-based path editor.
 * Reusable in Jupyter (via anywidget) or standalone.
 * Emits events: change:outline, change:selected
 */

import { CurveEditor } from "../curve-editor.js";

export class CurveEditorWidget {
  constructor(opts = {}) {
    this.opts = { width: 400, height: 300, ...opts };
    this.editor = null;
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
    canvas.id = "edit";
    canvas.width = this.opts.width;
    canvas.height = this.opts.height;
    canvas.style.cssText = "width:100%;height:100%;display:block;";
    this.el.appendChild(canvas);

    // Instantiate CurveEditor (core logic)
    this.editor = new CurveEditor(canvas, {
      outline: this.outline,
      onChange: (next) => this._emit("change:outline", next),
      onSelect: (idx) => this._emit("change:selected", idx),
    });

    return this;
  }

  setOutline(outline) {
    if (this.editor) {
      this.editor.setOutline(outline, { fit: true });
      this.outline = outline;
    }
  }

  get(prop) {
    if (prop === "outline") return this.editor?.getOutline?.();
    if (prop === "selected") return this.editor?.getSelected?.();
    return null;
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
