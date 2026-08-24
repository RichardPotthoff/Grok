import { AnyuiWidget, widgetManager } from "../anyui/anyui-model.js";
import _esm from "./curve-editor-widget.js";

export default class CurveEditorWidget extends AnyuiWidget {
  constructor(initialState = {}) {
    const defaults = {
      name: "Custom",
      startPoint: [0, 0],
      startAngle: 0,
      turtlePath: [],
      selected_index: -1,
    };
    super({ ...defaults, ...initialState });
    this._esm = _esm;
  }

  get editor() {
    return this._editor;
  }

  getOutline() {
    if (this._editor) return this._editor.getOutline();
    return {
      name: this.get("name"),
      startPoint: this.get("startPoint"),
      startAngle: this.get("startAngle"),
      turtlePath: this.get("turtlePath") || [],
    };
  }

  setOutline(outline, opts = {}) {
    if (this._editor) {
      this._editor.setOutline(outline, opts);
    }
    this.set("name", outline.name);
    this.set("startPoint", outline.startPoint);
    this.set("startAngle", outline.startAngle);
    this.set("turtlePath", outline.turtlePath);
    if (typeof outline.selected_index === "number") {
      this.set("selected_index", outline.selected_index);
    }
    this.save_changes();
  }

  insertSegment() {
    return this._editor ? this._editor.insertSegment() : -1;
  }

  deleteSegment() {
    return this._editor ? this._editor.deleteSegment() : -1;
  }

  fit() {
    this._editor?.fit();
  }

  setSelected(idx) {
    if (this._editor) this._editor.setSelected(idx);
    else {
      this.set("selected_index", idx);
      this.save_changes();
    }
  }

  getSelected() {
    return this._editor ? this._editor.getSelected() : this.get("selected_index");
  }

  static {
    widgetManager.register_class(this);
  }
}
