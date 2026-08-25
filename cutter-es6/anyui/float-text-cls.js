// // anyui/static/float-text-cls.js
import { AnyuiWidget,widgetManager} from './anyui-model.js';
import { loadCSS} from './css-loader.js'; //@exclude-iife


import _esm from "./float-text.js";
const _css_promise = loadCSS(new URL('./float-text.css', import.meta.url).href); //@exclude-iife
//const _css_promise = Promise.resolve(); //@include-iife

export default class FloatText extends AnyuiWidget {
  constructor(initialState = {}) {
    super(initialState);
    this._esm = _esm;
    this._css_promise = _css_promise;   // share the same promise
  }
  static {widgetManager.register_class(this);}
}


