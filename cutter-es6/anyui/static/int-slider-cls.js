// anyui/static/int-slider-cls.js 
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';

import _esm from './int-slider.js';
const _css_promise = loadCSS('./int-slider.css');

export default class Slider extends AnyuiWidget {
    constructor(state = {value: 50, min:0, max:100, step:1}) {
        super(state);
        // Point to the same ESM the Python class uses
        this._esm = _esm;
        this._css = _css_promise; 
    }
    static {widgetManager.register_class(this);}
}