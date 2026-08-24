// anyui/static/tab-cls.js
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';

import _esm from "./tab.js";

// Load CSS at module level (easy to parse later for IIFE)
//const _css_promise = loadCSS("../anyui/static/tab.css");
const _css_promise = loadCSS("./tab.css");

export default class Tab extends AnyuiWidget {
  constructor(initialState = {}) {
    super(initialState);
    this._esm = _esm;
    this._css_promise = _css_promise;   // share the same promise
  }
  static {widgetManager.register_class(this);}
}
