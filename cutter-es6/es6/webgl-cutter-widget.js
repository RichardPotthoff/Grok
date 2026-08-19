/**
 * anywidget / anyui _esm adapter for WebGLCutter.
 *
 * Model keys:
 *   turtlePath, startPoint, startAngle, name
 *   outlineScale   number   default 11
 *   bladeScale     number   default 5
 *   animate        boolean
 */

import { WebGLCutter } from "./webgl-cutter.js";

export function render({ model, el }) {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  el.style.position = el.style.position || "relative";
  el.appendChild(canvas);

  const view = new WebGLCutter(canvas, {
    outline: outlineFromModel(model),
    outlineScale: model.get("outlineScale") ?? 11,
    bladeScale: model.get("bladeScale") ?? 5,
    animate: model.get("animate") ?? true,
  });

  const sync = () => {
    view.setOutline(outlineFromModel(model), {
      scale: model.get("outlineScale") ?? 11,
      bladeScale: model.get("bladeScale") ?? 5,
    });
  };

  model.on("change:turtlePath", sync);
  model.on("change:startPoint", sync);
  model.on("change:startAngle", sync);
  model.on("change:outlineScale", sync);
  model.on("change:bladeScale", sync);
  model.on("change:animate", () => view.setAnimate(!!model.get("animate")));

  return () => view.destroy();
}

function outlineFromModel(model) {
  return {
    name: model.get("name") || "Custom",
    startPoint: model.get("startPoint") || [0, 0],
    startAngle: model.get("startAngle") ?? 0,
    turtlePath: model.get("turtlePath") || [],
  };
}
