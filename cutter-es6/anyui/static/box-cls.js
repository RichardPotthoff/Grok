// anyui/static/box-cls.js
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';

import _esm from './box.js';
const _css_promise = loadCSS('./box.css');

export default class Box extends AnyuiWidget {
  constructor(initialState = {} ) {  
    const defaultState={children:[], orientation:"column"};
    super({...defaultState, ...initialState});
    this._esm = _esm;
    this._css_promise = _css_promise;   // share the same promise
  }
  static {widgetManager.register_class(this);}
}


