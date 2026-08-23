// anyui/static/label-cls.js 
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';

import _esm from "./label.js";
const _css_promise = loadCSS("./label.css");

export default class Label extends AnyuiWidget {
  constructor(initialState = {}) {
    super(initialState);
    this._esm = _esm;
    this._css_promise = _css_promise;   // share the same promise
  }
  static {widgetManager.register_class(this);}
}


