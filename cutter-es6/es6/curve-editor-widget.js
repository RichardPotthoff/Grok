/**
 * anywidget / anyui _esm adapter for CurveEditor.
 *
 *   export function render({ model, el }) { ... return cleanup; }
 *
 * Model keys (same names you would traitlet):
 *   turtlePath      number[][]     [length, angleDegrees]
 *   startPoint      number[]       default [0, 0]
 *   startAngle      number         degrees
 *   name            string
 *   selected_index  number
 */

import { CurveEditor } from "./curve-editor.js";

export function render({ model, el }) {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  el.style.position = el.style.position || "relative";
  el.appendChild(canvas);

  let applying = false;

  const editor = new CurveEditor(canvas, {
    outline: outlineFromModel(model),
    onChange(outline) {
      applying = true;
      model.set("turtlePath", outline.turtlePath);
      model.set("startPoint", outline.startPoint);
      model.set("startAngle", outline.startAngle);
      model.set("name", outline.name);
      model.save_changes();
      applying = false;
    },
    onSelect(idx) {
      applying = true;
      model.set("selected_index", idx);
      model.save_changes();
      applying = false;
    },
  });

  const syncFromModel = () => {
    if (applying) return;
    editor.setOutline(outlineFromModel(model));
    const sel = model.get("selected_index");
    if (typeof sel === "number") editor.setSelected(sel);
  };

  model.on("change:turtlePath", syncFromModel);
  model.on("change:startPoint", syncFromModel);
  model.on("change:startAngle", syncFromModel);
  model.on("change:name", syncFromModel);
  model.on("change:selected_index", () => {
    if (applying) return;
    const sel = model.get("selected_index");
    if (typeof sel === "number") editor.setSelected(sel);
  });

  return () => editor.destroy();
}

function outlineFromModel(model) {
  return {
    name: model.get("name") || "Custom",
    startPoint: model.get("startPoint") || [0, 0],
    startAngle: model.get("startAngle") ?? 0,
    turtlePath: model.get("turtlePath") || [],
  };
}
