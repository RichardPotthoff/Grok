import { AnyuiWidget, widgetManager } from "../anyui/anyui-model.js";
import _esm from "./webgl-cutter-widget.js";

export default class WebGLCutterWidget extends AnyuiWidget {
  constructor(initialState = {}) {
    const defaults = {
      name: "Custom",
      startPoint: [0, 0],
      startAngle: 0,
      turtlePath: [],
      outlineScale: 11,
      bladeScale: 5,
      animate: true,
    };
    super({ ...defaults, ...initialState });
    this._esm = _esm;
  }

  setOutline(outline, { scale, bladeScale } = {}) {
    this.set("name", outline.name);
    this.set("startPoint", outline.startPoint);
    this.set("startAngle", outline.startAngle);
    this.set("turtlePath", outline.turtlePath);
    if (scale != null) this.set("outlineScale", scale);
    if (bladeScale != null) this.set("bladeScale", bladeScale);
    this.save_changes();
  }

  setAnimate(on) {
    this.set("animate", !!on);
    this.save_changes();
    this._view?.setAnimate(!!on);
  }

  static {
    widgetManager.register_class(this);
  }
}
