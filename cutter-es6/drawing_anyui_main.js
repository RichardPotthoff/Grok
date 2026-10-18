/**
 * Drawing REPL chrome — icon-rail sidebars.
 * Left: Files (list → editor). Right: Objects / Log.
 * Canvas stays in the center so script, drawing, and log can be visible together.
 */

import VBox from "./anyui/v-box-cls.js";
import HBox from "./anyui/h-box-cls.js";
import Button from "./anyui/button-cls.js";
import Html from "./anyui/html-cls.js";
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

let leftOpen = true;
let leftView = "files"; // "files" | "editor"
let rightOpen = false;
let rightView = "objects"; // "objects" | "log"
const hiddenScripts = new Set();

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

function scriptName(i) {
  return editors[i]?.get("name") || scripts[i]?.name || "Script " + (i + 1);
}

function persist() {
  scripts.forEach((s, i) => {
    s.text = editorText(i);
    s.name = editors[i].get("name") || s.name;
  });
  saveSession({ scripts, active });
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
const btnDone = new Button({ description: "Done" });
const btnHideOutput = new Button({ description: "Output" });

const btnFiles = new Button({ description: "Files" });
const btnHideLeft = new Button({ description: "‹" });
const btnObjects = new Button({ description: "Objs" });
const btnLog = new Button({ description: "Log" });
const btnHideRight = new Button({ description: "›" });

const scriptNameLabel = new Html({ value: `<span class="panel-label">script</span>` });

const toolbar = new HBox({
  wrap: true,
  gap: "6px",
  children: [title, btnFit, btnRun, btnClearCanvas, btnHelp],
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
  layout: { ...fill, minHeight: "80px", minWidth: "80px" },
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

const log = new LogWidget({
  id: "drawing-log",
  lines: [],
  layout: { ...fill },
});

const logPanel = new VBox({
  gap: "0px",
  children: [
    new Html({ value: `<span class="panel-label" style="padding:4px 6px">Log</span>` }),
    log,
  ],
  layout: { ...fill },
});

const filesList = new VBox({
  gap: "2px",
  children: [],
  layout: { ...fill, overflow: "auto", padding: "4px" },
});

const filesHead = new HBox({
  wrap: true,
  gap: "4px",
  children: [btnNew, btnSpoke, btnStar, btnSlice],
  layout: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    width: "100%",
    flex: "0 0 auto",
    padding: "4px",
  },
});

const filesView = new VBox({
  gap: "0px",
  children: [filesHead, filesList],
  layout: { ...fill },
});

const editorHead = new HBox({
  wrap: true,
  gap: "4px",
  children: [btnDone, btnRun, btnHideOutput, btnCopy, btnClose, scriptNameLabel],
  layout: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    width: "100%",
    flex: "0 0 auto",
    padding: "4px",
  },
});

const scriptContainer = new VBox({
  gap: "0px",
  children: [],
  layout: { ...fill, minHeight: "0" },
});

const editorView = new VBox({
  gap: "0px",
  children: [editorHead, scriptContainer],
  layout: { ...fill },
});

const leftIcons = new VBox({
  gap: "0px",
  children: [btnFiles, btnHideLeft],
  layout: {
    display: "flex",
    flexDirection: "column",
    width: "40px",
    minWidth: "40px",
    flex: "0 0 40px",
    background: "#f4f1ea",
    borderRight: "1px solid #ddd6c8",
  },
});

const leftContent = new VBox({
  gap: "0px",
  children: [filesView],
  layout: { ...fill, minWidth: "0" },
});

const leftSidebar = new HBox({
  gap: "0px",
  children: [leftIcons, leftContent],
  layout: {
    display: "flex",
    flexDirection: "row",
    flex: "0 0 280px",
    minWidth: "40px",
    height: "100%",
    borderRight: "1px solid #ddd6c8",
  },
});

const rightIcons = new VBox({
  gap: "0px",
  children: [btnObjects, btnLog, btnHideRight],
  layout: {
    display: "flex",
    flexDirection: "column",
    width: "40px",
    minWidth: "40px",
    flex: "0 0 40px",
    background: "#f4f1ea",
    borderLeft: "1px solid #ddd6c8",
  },
});

const rightContent = new VBox({
  gap: "0px",
  children: [objectsPanel],
  layout: { ...fill, minWidth: "0" },
});

const rightSidebar = new HBox({
  gap: "0px",
  children: [rightContent, rightIcons],
  layout: {
    display: "flex",
    flexDirection: "row",
    flex: "0 0 40px",
    minWidth: "40px",
    height: "100%",
    borderLeft: "1px solid #ddd6c8",
  },
});

const stageRow = new HBox({
  gap: "0px",
  children: [leftSidebar, stage, rightSidebar],
  layout: { ...fill, minHeight: "0" },
});

const root = new VBox({
  gap: "0px",
  children: [toolbar, stageRow],
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
    const all = repl.flattened();
    strokes = all
      .map((u, i) => ({ u, use: repl.uses[i] }))
      .filter(({ use }) => !use || !use.scriptId || !hiddenScripts.has(use.scriptId))
      .map(({ u }) => ({
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

function refreshFilesList() {
  const children = scripts.map((s, i) => {
    const b = new Button({
      description: scriptName(i),
      button_style: i === active && leftView === "editor" ? "primary" : "",
      layout: { width: "100%", justifyContent: "flex-start" },
    });
    b.onClick(() => openEditor(i));
    return b;
  });
  filesList.set("children", children);
  filesList.save_changes();
}

function updateHideOutputButton() {
  const id = scripts[active]?.id;
  const hidden = id && hiddenScripts.has(id);
  btnHideOutput.set("description", hidden ? "Output off" : "Output on");
  btnHideOutput.set("button_style", hidden ? "" : "primary");
  btnHideOutput.save_changes();
}

function showEditor(idx) {
  const ed = editors[idx];
  if (!ed) return;
  active = idx;
  scriptContainer.set("children", [ed]);
  scriptContainer.save_changes();
  scriptNameLabel.set("value", `<span class="panel-label">${scriptName(idx)}</span>`);
  scriptNameLabel.save_changes();
  updateHideOutputButton();
}

function openEditor(idx) {
  leftOpen = true;
  leftView = "editor";
  showEditor(idx);
  applyLayout();
  refreshFilesList();
}

function showFiles() {
  leftOpen = true;
  leftView = "files";
  applyLayout();
  refreshFilesList();
}

function applyLayout() {
  // left
  leftSidebar.set("children", leftOpen ? [leftIcons, leftContent] : [leftIcons]);
  leftSidebar.set("layout", {
    display: "flex",
    flexDirection: "row",
    flex: leftOpen ? "0 0 280px" : "0 0 40px",
    minWidth: "40px",
    height: "100%",
    borderRight: "1px solid #ddd6c8",
  });
  leftSidebar.save_changes();
  if (leftOpen) {
    leftContent.set("children", leftView === "editor" ? [editorView] : [filesView]);
    leftContent.save_changes();
  }
  btnFiles.set("button_style", leftOpen && leftView === "files" ? "primary" : "");
  btnFiles.save_changes();

  // right
  rightSidebar.set("children", rightOpen ? [rightContent, rightIcons] : [rightIcons]);
  rightSidebar.set("layout", {
    display: "flex",
    flexDirection: "row",
    flex: rightOpen ? "0 0 240px" : "0 0 40px",
    minWidth: "40px",
    height: "100%",
    borderLeft: "1px solid #ddd6c8",
  });
  rightSidebar.save_changes();
  if (rightOpen) {
    rightContent.set("children", rightView === "log" ? [logPanel] : [objectsPanel]);
    rightContent.save_changes();
  }
  btnObjects.set("button_style", rightOpen && rightView === "objects" ? "primary" : "");
  btnObjects.save_changes();
  btnLog.set("button_style", rightOpen && rightView === "log" ? "primary" : "");
  btnLog.save_changes();

  if (stage.fit) requestAnimationFrame(() => stage.fit());
}

function runScript() {
  persist();
  const idx = active;
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
  openEditor(editors.length - 1);
  persist();
}

btnRun.onClick(() => runScript());
btnFit.onClick(() => stage.fit());
btnHelp.onClick(() => {
  repl.note(API_HELP);
  publishLog();
  rightOpen = true;
  rightView = "log";
  applyLayout();
});
btnCopy.onClick(async () => {
  persist();
  const text = editorText(active);
  try {
    await navigator.clipboard.writeText(text);
    repl.note("copied script");
  } catch {
    repl.note("err clipboard unavailable — select the script");
  }
  publishLog();
});

function closeScript() {
  const idx = active;
  const id = scripts[idx] && scripts[idx].id;
  if (editors.length <= 1) {
    editors[0].set("name", "Script");
    editors[0].set("value", "");
    editors[0].save_changes();
    scripts[0].name = "Script";
    scripts[0].text = "";
    if (id) {
      repl.uses = repl.uses.filter((u) => u.scriptId !== id);
      hiddenScripts.delete(id);
    }
    showFiles();
    persist();
    publishStrokes();
    if (stage.fit) stage.fit();
    repl.note("last script cleared — store kept");
    publishLog();
    return;
  }
  scripts.splice(idx, 1);
  editors.splice(idx, 1);
  if (id) {
    repl.uses = repl.uses.filter((u) => u.scriptId !== id);
    hiddenScripts.delete(id);
  }
  active = Math.max(0, Math.min(idx, editors.length - 1));
  showFiles();
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
    openEditor(idx);
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
btnDone.onClick(() => showFiles());
btnHideOutput.onClick(() => {
  const id = scripts[active]?.id;
  if (!id) return;
  if (hiddenScripts.has(id)) hiddenScripts.delete(id);
  else hiddenScripts.add(id);
  updateHideOutputButton();
  publishStrokes();
  repl.note(hiddenScripts.has(id) ? "output hidden for " + scriptName(active) : "output shown for " + scriptName(active));
  publishLog();
});

btnFiles.onClick(() => {
  if (leftOpen && leftView === "files") {
    leftOpen = false;
  } else {
    showFiles();
    return;
  }
  applyLayout();
});
btnHideLeft.onClick(() => {
  leftOpen = false;
  applyLayout();
});
btnObjects.onClick(() => {
  if (rightOpen && rightView === "objects") {
    rightOpen = false;
  } else {
    rightOpen = true;
    rightView = "objects";
  }
  applyLayout();
});
btnLog.onClick(() => {
  if (rightOpen && rightView === "log") {
    rightOpen = false;
  } else {
    rightOpen = true;
    rightView = "log";
  }
  applyLayout();
});
btnHideRight.onClick(() => {
  rightOpen = false;
  applyLayout();
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

const mount = document.getElementById("app");

async function boot() {
  await root.create_view({ el: mount });
  refreshFilesList();
  applyLayout();
  if (scripts.length) openEditor(active);
  runScript();
  requestAnimationFrame(() => requestAnimationFrame(() => stage.fit()));
  window.drawingRepl = { repl, stage, editors, runScript, applyLayout };
}

boot().catch((err) => {
  console.error(err);
  mount.textContent = err.message || String(err);
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
