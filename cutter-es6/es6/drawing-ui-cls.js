import { AnyuiWidget, widgetManager } from "../anyui/anyui-model.js";
import { renderStage, renderScript, renderLog, renderObjects } from "./drawing-ui.js";

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

export class ObjectsWidget extends AnyuiWidget {
  constructor(initialState = {}) {
    super({ items: [], ...initialState });
    this._esm = { render: renderObjects };
  }
  static {
    widgetManager.register_class(this);
  }
}
