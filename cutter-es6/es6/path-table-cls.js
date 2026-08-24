import { AnyuiWidget, widgetManager } from "../anyui/anyui-model.js";
import _esm from "./path-table.js";

export default class PathTableWidget extends AnyuiWidget {
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

  static {
    widgetManager.register_class(this);
  }
}
