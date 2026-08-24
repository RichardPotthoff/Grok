// anyui/static/int-text-cls.js
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';

import _esm from "./int-text.js";
const _css_promise = loadCSS("./int-text.css");   // optional for now

export default class IntText extends AnyuiWidget {
  constructor(initialState = {}) {
    super(initialState);
    this._esm = _esm;
    this._css_promise = _css_promise;
  }
  static {widgetManager.register_class(this);}
}