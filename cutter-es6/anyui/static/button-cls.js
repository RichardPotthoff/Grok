// anyui/static/button-cls.js
import { AnyuiWidget,loadCSS,widgetManager} from './anyui-model.js';

import _esm from './button.js';
const _css_promise = loadCSS('./button.css');

export default class Button extends AnyuiWidget {
    constructor(initialState = { }) {
        const defaultState={description:"Click Me!"};
        super({...defaultState, ...initialState});
        // Point to the same ESM the Python class uses
        this._esm = _esm;
        this._css_promise = _css_promise;
    }
}
