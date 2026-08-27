/**
 * anywidget / anyui _esm adapter for CurveEditor.
 *
 * Model keys:
 *   turtlePath, startPoint, startAngle, name, selected_index
 */

import { CurveEditor } from "./curve-editor.js";

export function render({ model, el }) {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  el.style.position = el.style.position || "relative";
  el.style.flex = el.style.flex || "1 1 auto";
  el.style.minHeight = el.style.minHeight || "220px";
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
  model._editor = editor;

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

  // Notebook chrome (ipywidgets buttons) talks over anywidget custom messages.
  // standalone / cutter_anyui.html keep calling editor.insertSegment() directly.
  const onMsg = (msg) => {
    if (!msg || applying) return;
    const cmd = msg.cmd || msg.action;
    if (cmd === "fit") editor.fit();
    else if (cmd === "insert") editor.insertSegment(msg.at);
    else if (cmd === "delete") editor.deleteSegment(msg.at);
    else if (cmd === "close") editor.closePath({ smooth: msg.smooth !== false, mode: msg.mode });
    else if (cmd === "tool") editor.setTool(msg.tool || msg.name);
  };
  model.on("msg:custom", onMsg);

  return () => {
    editor.destroy();
    model._editor = null;
  };
}

function outlineFromModel(model) {
  return {
    name: model.get("name") || "Custom",
    startPoint: model.get("startPoint") || [0, 0],
    startAngle: model.get("startAngle") ?? 0,
    turtlePath: model.get("turtlePath") || [],
  };
}

export default { render };
