import { AnyuiWidget,widgetManager} from './anyui-model.js';
import { loadCSS} from './css-loader.js';
import _esm from "./button.js";

const _css_promise = loadCSS("./button.css");

export default class Button extends AnyuiWidget {
  constructor(initialState = {}) {
    const defaultState = { description: "Click", disabled: false, button_style: "" };
    super({ ...defaultState, ...initialState });
    this._esm = _esm;
    this._css_promise = _css_promise;
  }

  onClick(cb) {
    this.on("msg:custom", (msg) => {
      if (msg && msg.event === "click") cb(msg);
    });
    return this;
  }

  static {
    widgetManager.register_class(this);
  }
}
