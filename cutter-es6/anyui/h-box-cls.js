// anyui/static/h-box-cls.js
import { AnyuiWidget,widgetManager} from './anyui-model.js';
import { loadCSS} from './css-loader.js'; //@exclude-iife
import _esm from './box.js';
const _css_promise = loadCSS(new URL('./h-box.css', import.meta.url).href); //@exclude-iife
//const _css_promise = Promise.resolve(); //@include-iife

export default class HBox extends AnyuiWidget {
  constructor(initialState = {} ) {  
    const defaultState={children:[], orientation:"row"};
    super({...defaultState, ...initialState});    
    this._esm = _esm;
    this._css_promise = _css_promise;   // share the same promise
  }
  static {widgetManager.register_class(this);}
}


