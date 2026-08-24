// anyui/static/html-cls.js
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';

import _esm from "./html.js";
const _css_promise = loadCSS("./html.css");

export default class Html extends AnyuiWidget {
  constructor(initialState = {}) {
    super(initialState);
    this._esm = _esm;
    this._css_promise = _css_promise;
  }
  static tagName = "anyui-html";  
  static {widgetManager.register_class(this);}
}