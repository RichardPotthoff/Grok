// anyui/static/h-box-cls.js
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';

//import _esm from './h-box.js';
import _esm from './box.js';
const _css_promise = loadCSS('./h-box.css');

export default class HBox extends AnyuiWidget {
  constructor(initialState = {} ) {  
    const defaultState={children:[], orientation:"row"};
    super({...defaultState, ...initialState});    
    this._esm = _esm;
    this._css_promise = _css_promise;   // share the same promise
  }
  static {widgetManager.register_class(this);}
}


