import { AnyuiWidget, widgetManager } from "./anyui-model.js";
import { loadCSS } from "./css-loader.js"; //@exclude-iife

import _esm from "./tree.js";

const _css_promise = loadCSS(new URL("./tree.css", import.meta.url).href); //@exclude-iife
//const _css_promise = Promise.resolve(); //@include-iife

export default class Tree extends AnyuiWidget {
  constructor(initialState = {}) {
    const defaultState = {
      nodes: [],
      open: [],
      cwd: "",
      selected: "",
      mode: "tree",
    };
    super({ ...defaultState, ...initialState });
    this._esm = _esm;
    this._css_promise = _css_promise;
  }

  static {
    widgetManager.register_class(this);
  }
}
