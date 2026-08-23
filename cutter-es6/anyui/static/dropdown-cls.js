// anyui/static/dropdown-cls.js
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';
import _esm from './dropdown.js';
const _css_promise = loadCSS('./dropdown.css');

export default class Dropdown extends AnyuiWidget {
  constructor(initialState = {} ) {  
    super(initialState);
    this._esm = _esm;
    this._css_promise = _css_promise;   // share the same promise
  }
  static {widgetManager.register_class(this);}
}


