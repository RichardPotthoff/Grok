/**
 * ControlsWidget: shape selector, scale input, action buttons.
 * Generates header UI dynamically in JavaScript.
 * Emits events: change:shape, change:scale, click:fit, click:insert, click:delete, click:export
 */

export class ControlsWidget {
  constructor(opts = {}) {
    this.opts = { shapes: [], scale: 11, ...opts };
    this.el = null;
    this._state = { shape: "Duck", scale: 11 };
    this._listeners = new Map();
  }

  async create_view({ el }) {
    this.el = el;

    // Header container
    const header = document.createElement("header");
    header.style.cssText =
      "display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(236,231,220,0.12);background:#1c1b18;";

    // Title
    const h1 = document.createElement("h1");
    h1.textContent = "Cookie Cutter";
    h1.style.cssText = "margin:0 12px 0 0;font-size:1.05rem;font-weight:600;letter-spacing:-0.02em;";
    header.appendChild(h1);

    // Shape selector
    const shapeLabel = document.createElement("label");
    shapeLabel.textContent = "Shape ";
    const shapeSelect = document.createElement("select");
    shapeSelect.id = "shape";
    shapeSelect.style.cssText =
      "background:#12110f;color:#ece7dc;border:1px solid rgba(236,231,220,0.12);border-radius:8px;padding:8px 10px;font:inherit;min-height:40px;";
    this.opts.shapes.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      shapeSelect.appendChild(opt);
    });
    shapeSelect.value = this._state.shape;
    shapeSelect.addEventListener("change", (e) => {
      this._state.shape = e.target.value;
      this._emit("change:shape", e.target.value);
    });
    shapeLabel.appendChild(shapeSelect);
    header.appendChild(shapeLabel);

    // Scale input
    const scaleLabel = document.createElement("label");
    scaleLabel.textContent = "Scale ";
    const scaleInput = document.createElement("input");
    scaleInput.id = "scale";
    scaleInput.type = "number";
    scaleInput.min = "1";
    scaleInput.max = "40";
    scaleInput.step = "0.5";
    scaleInput.value = this._state.scale;
    scaleInput.style.cssText =
      "background:#12110f;color:#ece7dc;border:1px solid rgba(236,231,220,0.12);border-radius:8px;padding:8px 10px;font:inherit;min-height:40px;";
    scaleInput.addEventListener("change", (e) => {
      this._state.scale = Number(e.target.value);
      this._emit("change:scale", Number(e.target.value));
    });
    scaleLabel.appendChild(scaleInput);
    header.appendChild(scaleLabel);

    // Buttons
    header.appendChild(this._createButton("Fit", "fit"));
    header.appendChild(this._createButton("Insert", "insert"));
    header.appendChild(this._createButton("Delete", "delete"));
    header.appendChild(this._createButton("Export JSON", "export", true));

    // Help text
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.style.cssText = "width:100%;margin:0;font-size:12px;color:#9a9488;";
    hint.textContent =
      "Drag a handle to edit · hollow + adds a segment · Delete removes the highlighted row · iPad: Safari → Share → Add to Home Screen, then try airplane mode";
    header.appendChild(hint);

    this.el.appendChild(header);

    return this;
  }

  _createButton(label, id, isPrimary = false) {
    const btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.textContent = label;
    if (isPrimary) {
      btn.style.cssText =
        "background:#7a9e96;color:#12110f;border:0;border-radius:8px;padding:8px 10px;font:inherit;min-height:40px;font-weight:600;cursor:pointer;";
    } else {
      btn.style.cssText =
        "background:#12110f;color:#ece7dc;border:1px solid rgba(236,231,220,0.12);border-radius:8px;padding:8px 10px;font:inherit;min-height:40px;cursor:pointer;";
    }
    btn.addEventListener("click", () => this._emit(`click:${id}`));
    return btn;
  }

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(cb);
  }

  _emit(event, value) {
    const cbs = this._listeners.get(event) || [];
    cbs.forEach((cb) => cb(value));
  }
}
