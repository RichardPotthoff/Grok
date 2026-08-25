import { AnyuiWidget,widgetManager} from './anyui-model.js';
import { loadCSS} from './css-loader.js'; //@exclude-iife

import _esm from "./dropdown.js";

const _css_promise = loadCSS(new URL('./dropdown.css', import.meta.url).href); //@exclude-iife
//const _css_promise = Promise.resolve(); //@include-iife

export default class Dropdown extends AnyuiWidget {
  constructor(initialState = {}) {
    const defaultState = {
      options: [],
      index: 0,
      value: undefined,
      description: "",
    };
    super({ ...defaultState, ...initialState });
    if (this.get("value") === undefined) {
      const options = this.get("options") || [];
      const index = this.get("index") ?? 0;
      this.state.value = options[index];
    }
    this._esm = _esm;
    this._css_promise = _css_promise;
  }

  static {
    widgetManager.register_class(this);
  }
}
