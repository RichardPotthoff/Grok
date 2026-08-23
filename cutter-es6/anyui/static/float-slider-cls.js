// // anyui/static/float-slider-cls.js
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';

import _esm from "./float-slider.js";
const _css_promise = loadCSS("./float-slider.css");

export default class FloatSlider extends AnyuiWidget {
  constructor(initialState = {value: 0.0, min:0.0, max:1.0, step:0.0}) {
    super(initialState);
    this._esm = _esm;
    this._css_promise = _css_promise;   // share the same promise
  }
  static {widgetManager.register_class(this);}
}


