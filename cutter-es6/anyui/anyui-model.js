// static/anyui-model.js

const classCounters = new Map();

export class AnyuiWidget {
    /** Set to true to log every change:/send/trigger (noisy during CurveEditor playback). */
    static debug = false;

    constructor(initialState = {}) {
        try{
        const className = this.constructor.name;
        var id=null;
        // ID handling: user-provided takes priority
        if (initialState.id !== undefined) {
            id = String(initialState.id);
            //delete initialState.id;//do not modify the initialstate object
        } else {
            if (!classCounters.has(className)) {
                classCounters.set(className, 0);
            }
            const count = classCounters.get(className);
            id = `${className}_${String(count).padStart(3, '0')}`;
            classCounters.set(className, count + 1);
        }
        const cachedModel=widgetManager.get_model(id);
        if (cachedModel) { 
            if (this.constructor !== cachedModel.constructor){
                console.error(`Type mismatch: {id:"${id}", type:"${this.constructor.name}"}, {id:"${cachedModel.id}", type:"${cachedModel.constructor.name}"}`);
            };
            return cachedModel;
        }
        
        this.id=id;
        this.state = { ...initialState };
        this.listeners = {};
        this.widget_manager = widgetManager; // Set by the manager upon registration
        this._buffer = {};

        // Mirror the Python class attributes
        this._esm = null;
        this._css = _css_promise;
//null;

        widgetManager.register_model(this);
    }catch(err){
        console.error(err.message);
    }
    }

    get(name) {
        return this.state[name];
    }

    /**
     * Match the anywidget / Backbone model contract more closely:
     * - set() updates the live state immediately so subsequent get() sees the new value
     * - changes are recorded in _buffer so save_changes() can fire events + sync
     * - change:* events are fired only from save_changes() (not from set itself)
     *
     * This is required by widgets such as CurveEditor that do:
     *   model.set("t", newT);   // no save_changes
     *   // then immediately call code that does model.get("t")
     */
    set(name, value) {
        // Always record in the buffer (even if equal) so explicit save_changes still works
        this._buffer[name] = value;
        this.state[name] = value;
    }

    // === send custom message (mirrors ipywidgets / anywidget model.send) ===
    send(content, callbacks = null, buffers = null) {
        if (AnyuiWidget.debug) {
            console.log(`[${this.id}] send() called →`, content);
        }

        // For standalone mode (no Python backend), you can just log or ignore
        // If you later add a bridge, post the message here

        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.anyui) {
            window.webkit.messageHandlers.anyui.postMessage({
                method: 'custom_message',
                model_id: this.id,
                content: content,
                buffers: buffers
            });
        }

        // Trigger the "msg:custom" event on the model itself (so listeners see it)
        this.trigger("msg:custom", content, buffers || []);
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    // === off() - remove listener(s) ===
    off(event = null, callback = null) {
        if (!event) {
            this.listeners = {};
            return;
        }

        if (!callback) {
            delete this.listeners[event];
            return;
        }

        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
            if (this.listeners[event].length === 0) {
                delete this.listeners[event];
            }
        }
    }

    save_changes() {
        const changes = { ...this._buffer };
        this._buffer = {};

        for (const [key, value] of Object.entries(changes)) {
            // state was already updated in set(); re-assign is a no-op but keeps symmetry
            this.state[key] = value;

            if (AnyuiWidget.debug) {
                console.log(`[${this.id}] change:${key} →`, value);
            }

            this.trigger(`change:${key}`, value);
        }

        // Sync to Python/bridge if present
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.anyui) {
            window.webkit.messageHandlers.anyui.postMessage({
                method: 'update_state',
                model_id: this.id,
                changes: changes
            });
        }
    }

    trigger(event, ...args) {
        const cbs = this.listeners[event] || [];
        if (AnyuiWidget.debug && cbs.length > 0 && (event.startsWith("change:") || event === "msg:custom")) {
            console.log(`[${this.id}] triggering "${event}" with`, ...args);
        }
        cbs.forEach(cb => cb(...args));
    }

    create_view({el = null, attribs = {}} = {}) {
        return this.widget_manager.create_view(this, {el: el, attribs: attribs});
    }
}

export function loadCSS(relpath) {
    return new Promise((resolve, reject) => {
        const href = new URL(relpath, import.meta.url).href;
        if (document.querySelector(`link[href="${href}"]`)) return resolve();

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.onload = resolve;
        link.onerror = () => reject(new Error(`Could not load CSS at ${href}`));
        document.head.appendChild(link);
    });
}


function toKebabCase(str) {
    return str.replace(/([A-Z])/g, "-$1").replace(/^-/,"").toLowerCase();
}

async function loadModule(relpath) {
  const href = new URL(relpath, import.meta.url).href;
  try {
    console.log(`[Loading module] ${relpath}`);
    const module = await import(href);
    console.log(`✅ Loaded module: ${relpath}`);
    return module;
  } catch (err) {
    console.warn(`⚠️ Failed to load module ${relpath}`);
    return null;
  }
}


export class WidgetManager {
    constructor() {
        this.classes = new Map();
        this.failedClasses = new Set();
        this.models = new Map();
    }
    
    // Used by static imports to "check in"
    register_class(cls) {
        if (cls.tagName) {this.classes.set(cls.tagName,cls);}
        this.classes.set("anyui-"+toKebabCase(cls.name),cls);
        this.classes.set(cls.name,cls);
    }

    async getOrLoadClass(tagName) {
        // 1. Check if it was already registered (statically or previously loaded)
        
        if (this.classes.has(tagName)) return this.classes.get(tagName);
        
        // 2. Prevent re-fetching known failures
        if (this.failedClasses.has(tagName)) return null;
        
        try {
          // 3. Dynamic load: the module's own execution will trigger registerClass()
          const relpath = `./${tagName.replace(/^anyui-/,"")}-cls.js`;
          const module = await loadModule(relpath);
          // Fallback: if the module didn't auto-register for some reason
          if (module?.default && !this.classes.has(tagName)) {
            this.register_class(module.default);
          }
          return this.classes.get(tagName);
        } catch (e) {
          console.error(e.message);
          this.failedClasses.add(tagName);
          return null;
        }
    }
    
    register_model(model) {
        //model.widget_manager = this; //set in models' constructor
        this.models.set(model.id, model);
    }

    get_model(id) {
        return this.models.get(id.replace("IPY_MODEL_", "")) ?? null;
    }
    
    async create_view(model, {el = null, attribs={}}={}) {
        const container = el || document.createElement('div');
        const className = model.constructor.name;
        container.style.display = "inline-flex";
        container.style.alignItems = "center";
        container.style.verticalAlign = "middle"; // Helps it sit nicely with text
   
        //apply model layout to element
        if (model.state.layout){
            Object.assign(container.style, model.state.layout);
        }
        if (model._css_promise) {
            try {
                await model._css_promise;
            } catch (err) {
                console.warn(`CSS load failed for ${model.constructor.name}:`, err);
            }
        }

        // 2. Render Logic
        var cleanup=null;
        try {
            const module = model._esm;
            if (module.initialize && !model._initialized) {
                await module.initialize({ model });
                model._initialized = true;
            }
    
            if (module.render) {
                cleanup = await module.render({ model, el: container });
                container._anyui_cleanup = cleanup;
            }
        } catch (err) {
            console.error(`[AnyUI] Render Failed for ${className}:`, err);
            container.innerHTML = `<div style="color:red">Render Error: ${err.message}</div>`;
        }
        return {el:container,cleanup:cleanup};
    }
}

const _css_promise = loadCSS('./anyui.css');

export const widgetManager = new WidgetManager();

