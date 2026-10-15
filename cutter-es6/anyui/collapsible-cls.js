import { AnyuiWidget, widgetManager } from "./anyui-model.js";
import { loadCSS } from "./css-loader.js"; //@exclude-iife

import _esm from "./collapsible.js";

const _css_promise = loadCSS(new URL("./collapsible.css", import.meta.url).href); //@exclude-iife
//const _css_promise = Promise.resolve(); //@include-iife

export default class Collapsible extends AnyuiWidget {
  constructor(initialState = {}) {
    const defaultState = {
      open: false,
      title: "",
      side: "left",
      child: null,
    };
    super({ ...defaultState, ...initialState });
    this._esm = _esm;
    this._css_promise = _css_promise;
  }

  static {
    widgetManager.register_class(this);
  }
}
