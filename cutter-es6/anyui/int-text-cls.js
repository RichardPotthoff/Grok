// anyui/static/int-text-cls.js
import { AnyuiWidget,widgetManager} from './anyui-model.js';
import { loadCSS} from './css-loader.js'; //@exclude-iife

import _esm from "./int-text.js";
const _css_promise = loadCSS(new URL('./int-text.css', import.meta.url).href); //@exclude-iife
//const _css_promise = Promise.resolve(); //@include-iife

export default class IntText extends AnyuiWidget {
  constructor(initialState = {}) {
    super(initialState);
    this._esm = _esm;
    this._css_promise = _css_promise;
  }
  static {widgetManager.register_class(this);}
}