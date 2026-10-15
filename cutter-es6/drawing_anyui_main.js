/**
 * Drawing REPL chrome from anyui widgets.
 * Compact, collapsible layout for iPad + onscreen keyboard.
 * Compare with cutter_anyui.html. drawing.html stays the grip-edit reference.
 */

import VBox from "./anyui/v-box-cls.js";
import HBox from "./anyui/h-box-cls.js";
import Button from "./anyui/button-cls.js";
import Html from "./anyui/html-cls.js";
import Dropdown from "./anyui/dropdown-cls.js";
import Collapsible from "./anyui/collapsible-cls.js";
import {
  API_HELP,
  DEFAULT_SCRIPT,
  STAR6_SCRIPT,
  SLICE_SCRIPT,
  DrawingRepl,
  loadSession,
  newScript,
  saveSession,
} from "./es6/drawing-repl.js";
import { LogWidget, ObjectsWidget, ScriptWidget, StageWidget } from "./es6/drawing-ui-cls.js";

const fill = {
  display: "flex",
  flex: "1 1 auto",
  width: "100%",
  minHeight: "0",
  minWidth: "0",
  alignItems: "stretch",
};

const repl = new DrawingRepl();
const session = loadSession();
const scripts = session.scripts.length ? session.scripts : [newScript("spoke", DEFAULT_SCRIPT)];
let active = Math.max(0, Math.min(scripts.length - 1, session.active || 0));
let scriptMode = false;

const editors = scripts.map(
  (s, i) =>
    new ScriptWidget({
      id: "script-" + s.id,
      value: s.text || "",
      name: s.name || "Script " + (i + 1),
      layout: { ...fill, height: "100%" },
    }),
);

function editorText(i) {
  return editors[i] ? editors[i].get("value") || "" : "";
}

function currentIndex() {
  return scriptSelect.get("index") ?? active;
}

function persist() {
  scripts.forEach((s, i) => {
    s.text = editorText(i);
    s.name = editors[i].get("name") || s.name;
  });
  saveSession({ scripts, active: currentIndex() });
}

const title = new Html({ value: `<h1 class="toolbar-title">Arc</h1>` });

const btnFit = new Button({ description: "Fit" });
const btnHelp = new Button({ description: "Help" });
const btnRun = new Button({ description: "Run", button_style: "primary" });
const btnCopy = new Button({ description: "Copy" });
const btnNew = new Button({ description: "+ Script" });
const btnClose = new Button({ description: "Close" });
const btnSpoke = new Button({ description: "Spoke" });
const btnStar = new Button({ description: "Star6" });
const btnSlice = new Button({ description: "Slice" });
const btnClearStore = new Button({ description: "Clear store" });
const btnClearCanvas = new Button({ description: "Clear" });
const btnEdit = new Button({ description: "Edit" });
const btnDone = new Button({ description: "Done" });

const scriptSelect = new Dropdown({
  options: scripts.map((s, i) => s.name || "Script " + (i + 1)),
  index: active,
  description: "",
  layout: { flex: "1 1 auto", minWidth: "6rem", maxWidth: "12rem" },
});

const toolbar = new HBox({
  wrap: true,
  gap: "6px",
  children: [title, btnFit, btnRun, btnClearCanvas, btnEdit],
  layout: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    width: "100%",
    flex: "0 0 auto",
    padding: "4px 8px",
  },
});

const stage = new StageWidget({
  id: "drawing-stage",
  strokes: [],
  layout: { ...fill, minHeight: "120px" },
});

const objects = new ObjectsWidget({
  id: "drawing-objects",
  items: [],
  layout: { ...fill, overflow: "auto" },
});

const objectsHead = new HBox({
  gap: "6px",
  children: [
    new Html({ value: `<span class="panel-label">Objects</span>` }),
    btnClearStore,
  ],
  layout: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    flex: "0 0 auto",
    padding: "4px 6px",
  },
});

const objectsPanel = new VBox({
  gap: "0px",
  children: [objectsHead, objects],
  layout: { ...fill },
});

const objectsRail = new Collapsible({
  open: false,
  title: "Objects",
  side: "left",
  child: objectsPanel,
  layout: { ...fill, flex: "0 0 auto" },
});

const log = new LogWidget({
  id: "drawing-log",
  lines: [],
  layout: { ...fill, minHeight: "0" },
});

const logRail = new Collapsible({
  open: false,
  title: "Log",
  side: "right",
  child: log,
  layout: { ...fill, flex: "0 0 auto" },
});

const stageRow = new HBox({
  gap: "0px",
  children: [objectsRail, stage, logRail],
  layout: { ...fill, minHeight: "0" },
});

const scriptContainer = new VBox({
  gap: "0px",
  children: [editors[active] || editors[0]],
  layout: { ...fill, minHeight: "0" },
});

const scriptModeBar = new HBox({
  wrap: true,
  gap: "6px",
  children: [btnDone, btnRun, scriptSelect, btnNew, btnClose, btnCopy, btnSpoke, btnStar, btnSlice, btnHelp],
  layout: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    width: "100%",
    flex: "0 0 auto",
    padding: "4px 8px",
  },
});

const scriptBar = new HBox({
  gap: "6px",
  children: [scriptSelect, btnEdit],
  layout: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    flex: "0 0 auto",
    padding: "4px 8px",
    borderTop: "1px solid #ddd6c8",
  },
});

const root = new VBox({
  gap: "0px",
  children: [toolbar, stageRow, scriptBar],
  layout: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: "100dvh",
  },
});

function publishObjects() {
  objects.set("items", repl.namedList());
  objects.save_changes();
}

function publishLog() {
  log.set("lines", repl.log.slice());
  log.save_changes();
}

function publishStrokes() {
  let strokes = [];
  try {
    strokes = repl.flattened().map((u) => ({
      startPoint: u.startPoint,
      startAngle: u.startAngle,
      turtlePath: u.turtlePath,
      root: u.root,
      stroke: u.stroke,
      width: u.width,
      fill: u.fill,
    }));
  } catch (err) {
    repl.note("err " + (err.message || String(err)));
  }
  stage.set("strokes", strokes);
  stage.save_changes();
}

function syncSelect() {
  const names = editors.map((ed, i) => ed.get("name") || scripts[i].name || "Script " + (i + 1));
  const idx = Math.max(0, Math.min(names.length - 1, scriptSelect.get("index") ?? active));
  scriptSelect.set("options", names);
  scriptSelect.set("index", idx);
  scriptSelect.save_changes();
  showEditor(idx);
}

function showEditor(idx) {
  const ed = editors[idx];
  if (!ed) return;
  scriptContainer.set("children", [ed]);
  scriptContainer.save_changes();
  active = idx;
}

function applyMode() {
  if (scriptMode) {
    root.set("children", [scriptModeBar, scriptContainer]);
  } else {
    root.set("children", [toolbar, stageRow, scriptBar]);
  }
  root.save_changes();
  if (!scriptMode && stage.fit) {
    requestAnimationFrame(() => stage.fit());
  }
}

function runScript() {
  persist();
  const idx = currentIndex();
  const src = editorText(idx);
  const id = scripts[idx] && scripts[idx].id;
  try {
    repl.run(src, { scriptId: id });
  } catch {
    /* logged */
  }
  publishObjects();
  publishLog();
  publishStrokes();
  if (stage.fit) stage.fit();
}

function addScript(name, text) {
  persist();
  const s = newScript(name, text);
  scripts.push(s);
  const ed = new ScriptWidget({
    id: "script-" + s.id,
    value: text,
    name,
    layout: { ...fill, height: "100%" },
  });
  ed.on("msg:custom", (msg) => {
    if (msg && msg.event === "run") runScript();
  });
  editors.push(ed);
  scriptSelect.set("index", editors.length - 1);
  syncSelect();
  persist();
}

btnRun.onClick(() => runScript());
btnFit.onClick(() => stage.fit());
btnHelp.onClick(() => {
  repl.note(API_HELP);
  publishLog();
  logRail.set("open", true);
  logRail.save_changes();
});
btnCopy.onClick(async () => {
  persist();
  const idx = currentIndex();
  const text = editorText(idx);
  try {
    await navigator.clipboard.writeText(text);
    repl.note("copied script");
  } catch {
    repl.note("err clipboard unavailable — select the script");
  }
  publishLog();
});

function closeScript() {
  const idx = currentIndex();
  const id = scripts[idx] && scripts[idx].id;
  if (editors.length <= 1) {
    editors[0].set("name", "Script");
    editors[0].set("value", "");
    editors[0].save_changes();
    scripts[0].name = "Script";
    scripts[0].text = "";
    if (id) repl.uses = repl.uses.filter((u) => u.scriptId !== id);
    syncSelect();
    persist();
    publishStrokes();
    if (stage.fit) stage.fit();
    repl.note("last script cleared — store kept");
    publishLog();
    return;
  }
  scripts.splice(idx, 1);
  editors.splice(idx, 1);
  if (id) repl.uses = repl.uses.filter((u) => u.scriptId !== id);
  const next = Math.max(0, Math.min(idx, editors.length - 1));
  scriptSelect.set("index", next);
  syncSelect();
  persist();
  publishStrokes();
  if (stage.fit) stage.fit();
  repl.note("closed script — store kept");
  publishLog();
}

function openNamed(name, text) {
  const idx = scripts.findIndex((s) => s.name === name);
  if (idx >= 0) {
    editors[idx].set("name", name);
    editors[idx].set("value", text);
    editors[idx].save_changes();
    scripts[idx].name = name;
    scripts[idx].text = text;
    scriptSelect.set("index", idx);
    syncSelect();
    return;
  }
  addScript(name, text);
}

btnNew.onClick(() => addScript("Script " + (scripts.length + 1), ""));
btnClose.onClick(() => closeScript());
btnSpoke.onClick(() => {
  openNamed("spoke", DEFAULT_SCRIPT);
  runScript();
});
btnStar.onClick(() => {
  openNamed("star6", STAR6_SCRIPT);
  runScript();
});
btnSlice.onClick(() => {
  openNamed("slice", SLICE_SCRIPT);
  runScript();
});
btnClearStore.onClick(() => {
  repl.resetStore();
  repl.note("store cleared");
  publishObjects();
  publishLog();
});
btnClearCanvas.onClick(() => {
  repl.uses = [];
  repl.note("canvas cleared — store kept");
  publishStrokes();
  publishLog();
  if (stage.fit) stage.fit();
});
btnEdit.onClick(() => {
  scriptMode = true;
  applyMode();
});
btnDone.onClick(() => {
  scriptMode = false;
  applyMode();
});

objects.on("msg:custom", (msg) => {
  if (!msg || msg.event !== "pick") return;
  const row = repl.namedList().find((r) => r.name === msg.name);
  if (row) repl.note(row.text);
  publishLog();
});

editors.forEach((ed) => {
  ed.on("msg:custom", (msg) => {
    if (msg && msg.event === "run") runScript();
  });
});

scriptSelect.on("change:index", (idx) => {
  showEditor(idx);
  persist();
});

const mount = document.getElementById("app");

async function boot() {
  await root.create_view({ el: mount });
  syncSelect();
  runScript();
  requestAnimationFrame(() => requestAnimationFrame(() => stage.fit()));
  window.drawingRepl = { repl, stage, scriptSelect, editors, runScript, applyMode };
}

boot().catch((err) => {
  console.error(err);
  mount.textContent = err.message || String(err);
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
