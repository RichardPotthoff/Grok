import { AnyuiWidget, widgetManager } from "../anyui/anyui-model.js";
import { renderStage, renderScript, renderLog, renderObjects } from "./drawing-ui.js";
import { renderPreview3d } from "./preview3d.js";

export class StageWidget extends AnyuiWidget {
  constructor(initialState = {}) {
    super({ strokes: [], ...initialState });
    this._esm = { render: renderStage };
  }
  fit() {
    return this._fit ? this._fit() : false;
  }
  static {
    widgetManager.register_class(this);
  }
}

export class ScriptWidget extends AnyuiWidget {
  constructor(initialState = {}) {
    super({ value: "", name: "Script", ...initialState });
    this._esm = { render: renderScript };
  }
  static {
    widgetManager.register_class(this);
  }
}

export class LogWidget extends AnyuiWidget {
  constructor(initialState = {}) {
    super({ lines: [], ...initialState });
    this._esm = { render: renderLog };
  }
  static {
    widgetManager.register_class(this);
  }
}

export class Preview3dWidget extends AnyuiWidget {
  constructor(initialState = {}) {
    super({ mesh: null, ...initialState });
    this._esm = { render: renderPreview3d };
  }
  setMesh(mesh) {
    this.set("mesh", mesh);
    this.save_changes();
    if (this._view) this._view.setMesh(mesh);
  }
  static {
    widgetManager.register_class(this);
  }
}
export class ObjectsWidget extends AnyuiWidget {
  constructor(initialState = {}) {
    super({ items: [], ...initialState });
    this._esm = { render: renderObjects };
  }
  static {
    widgetManager.register_class(this);
  }
}
