/**
 * Cookie Cutter chrome built from anyui widgets (Box / Button / Dropdown / …).
 * Core editor and WebGL preview stay in es6/. Compare with standalone.html.
 */

import VBox from "./anyui/v-box-cls.js";
import HBox from "./anyui/h-box-cls.js";
import Button from "./anyui/button-cls.js";
import Dropdown from "./anyui/dropdown-cls.js";
import Html from "./anyui/html-cls.js";
import FloatText from "./anyui/float-text-cls.js";
import CurveEditorWidget from "./es6/curve-editor-cls.js";
import WebGLCutterWidget from "./es6/webgl-cutter-cls.js";
import PathTableWidget from "./es6/path-table-cls.js";
import { getOutline, OUTLINE_NAMES } from "./es6/cookiecutters.js";
import { serializeOutline } from "./es6/path-utils.js";
import { downloadKit } from "./es6/download-kit.js";

const fill = {
  display: "flex",
  flex: "1 1 auto",
  width: "100%",
  minHeight: "0",
  minWidth: "0",
  alignItems: "stretch",
};

const shapeNames = OUTLINE_NAMES.filter((n) => n !== "Blade").concat(["Blank"]);
const initial = getOutline("Duck");

let syncing = false;
function withSync(fn) {
  if (syncing) return;
  syncing = true;
  try {
    fn();
  } finally {
    syncing = false;
  }
}

const title = new Html({
  value: `<h1 class="toolbar-title">Cookie Cutter</h1>`,
});

const shape = new Dropdown({
  description: "Shape",
  options: shapeNames,
  index: Math.max(0, shapeNames.indexOf("Duck")),
  value: "Duck",
  style: { descriptionWidth: "3.2rem" },
  layout: { flex: "0 0 auto", alignItems: "center", width: "11rem" },
});

const scale = new FloatText({
  description: "Scale",
  value: 11,
  min: 1,
  max: 40,
  step: 0.5,
  style: { descriptionWidth: "3.2rem" },
  layout: { flex: "0 0 auto", alignItems: "center", width: "9rem" },
});

const btnFit = new Button({ description: "Fit" });
const btnInsert = new Button({ description: "Insert" });
const btnDelete = new Button({ description: "Delete" });
const btnExport = new Button({ description: "Export JSON", button_style: "primary" });
const btnKit = new Button({ description: "Download kit" });
const btnSpin = new Button({ description: "Spin" });

const compare = new Html({
  value: `<span class="compare">anyui layout <a href="./standalone.html">standalone.html</a></span>`,
});

const hint = new Html({
  value: `<p class="hint">Drag a handle to edit · hollow + adds a segment · Delete removes the highlighted row · this page is the anyui chrome; standalone.html is the reference</p>`,
});

const toolbar = new HBox({
  wrap: true,
  gap: "8px",
  children: [title, shape, scale, btnFit, btnInsert, btnDelete, btnExport, btnKit, compare, hint],
  layout: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    padding: "10px 14px",
    borderBottom: "1px solid color-mix(in oklab, #ece7dc 12%, transparent)",
    background: "#1c1b18",
    width: "100%",
    flex: "0 0 auto",
  },
});

const pathLabel = new Html({ value: `<div class="panel-label">Path</div>` });
const viewLabel = new Html({ value: `<div class="panel-label">3D · Blade</div>` });

const editor = new CurveEditorWidget({
  name: initial.name,
  startPoint: initial.startPoint,
  startAngle: initial.startAngle,
  turtlePath: initial.turtlePath,
  selected_index: initial.turtlePath.length ? initial.turtlePath.length - 1 : -1,
  layout: { ...fill, minHeight: "220px" },
});

const viewer = new WebGLCutterWidget({
  name: initial.name,
  startPoint: initial.startPoint,
  startAngle: initial.startAngle,
  turtlePath: initial.turtlePath,
  outlineScale: 11,
  bladeScale: 5,
  animate: true,
  layout: { ...fill, minHeight: "220px" },
});

const table = new PathTableWidget({
  name: initial.name,
  startPoint: initial.startPoint,
  startAngle: initial.startAngle,
  turtlePath: initial.turtlePath,
  selected_index: editor.get("selected_index"),
  layout: {
    display: "block",
    width: "100%",
    flex: "0 0 auto",
    maxHeight: "28vh",
    overflow: "auto",
  },
});

const pathPanel = new VBox({
  children: [pathLabel, editor],
  layout: { ...fill, minHeight: "220px" },
});

const viewHeader = new HBox({
  children: [viewLabel, btnSpin],
  layout: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    flex: "0 0 auto",
    padding: "8px 10px 0",
  },
});

const viewPanel = new VBox({
  children: [viewHeader, viewer],
  layout: { ...fill, minHeight: "220px" },
});

const stage = new HBox({
  children: [pathPanel, viewPanel],
  layout: {
    display: "flex",
    flex: "1 1 0",
    height: "0",
    minHeight: "240px",
    minWidth: "0",
    width: "100%",
    alignItems: "stretch",
  },
});

const root = new VBox({
  children: [toolbar, stage, table],
  gap: "0px",
  layout: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: "100dvh",
    background: "#12110f",
    color: "#ece7dc",
  },
});

function currentOutline() {
  return editor.getOutline();
}

function pushFromEditor() {
  const outline = currentOutline();
  viewer.setOutline(outline, { scale: Number(scale.get("value")) || 11 });
  table.set("name", outline.name);
  table.set("startPoint", outline.startPoint);
  table.set("startAngle", outline.startAngle);
  table.set("turtlePath", outline.turtlePath);
  table.set("selected_index", editor.getSelected());
  table.save_changes();
  btnDelete.set("disabled", !outline.turtlePath.length);
  btnDelete.save_changes();
}

function loadShape(name) {
  const outline =
    name === "Blank"
      ? { name: "Custom", startPoint: [0, 0], startAngle: 0, turtlePath: [] }
      : getOutline(name);
  withSync(() => {
    editor.setOutline(outline, { fit: true, keepSelection: false });
    pushFromEditor();
  });
}

editor.on("change:turtlePath", () => withSync(pushFromEditor));
editor.on("change:startPoint", () => withSync(pushFromEditor));
editor.on("change:startAngle", () => withSync(pushFromEditor));
editor.on("change:selected_index", () =>
  withSync(() => {
    table.set("selected_index", editor.get("selected_index"));
    table.save_changes();
  }),
);

table.on("change:turtlePath", () =>
  withSync(() => {
    const outline = {
      name: table.get("name"),
      startPoint: table.get("startPoint"),
      startAngle: table.get("startAngle"),
      turtlePath: table.get("turtlePath") || [],
    };
    editor.setOutline(outline);
    viewer.setOutline(outline, { scale: Number(scale.get("value")) || 11 });
  }),
);
table.on("change:selected_index", () =>
  withSync(() => {
    const idx = table.get("selected_index");
    if (typeof idx === "number") editor.setSelected(idx);
  }),
);

shape.on("change:value", (value) => loadShape(value));
scale.on("change:value", (value) => {
  viewer.setOutline(currentOutline(), { scale: Number(value) || 11 });
});

btnFit.onClick(() => editor.fit());
btnInsert.onClick(() => editor.insertSegment());
btnDelete.onClick(() => editor.deleteSegment());
btnSpin.onClick(() => viewer.setAnimate(true));

btnExport.onClick(async () => {
  const text = serializeOutline(currentOutline());
  try {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${currentOutline().name || "cutter"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied JSON to clipboard");
    } catch (err) {
      alert(err.message || String(err));
    }
  }
});

btnKit.onClick(() => {
  downloadKit().catch((err) => alert(err.message || String(err)));
});

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    editor.deleteSegment();
  } else if (e.key === "i" || e.key === "Insert") {
    editor.insertSegment();
  }
});

const mq = window.matchMedia("(max-width: 800px)");
function applyStageLayout() {
  stage.set("orientation", mq.matches ? "column" : "row");
  stage.save_changes();
}
if (mq.addEventListener) mq.addEventListener("change", applyStageLayout);
else mq.addListener(applyStageLayout);
applyStageLayout();

const mount = document.getElementById("app");
let view = null;

async function boot() {
  view = await root.create_view({ el: mount });
  withSync(pushFromEditor);
  window.cutterAnyui = { root, editor, viewer, table, view };
}

boot().catch((err) => {
  console.error(err);
  alert(err.message || String(err));
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

export { root, editor, viewer, table, view, boot };
