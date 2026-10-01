/**
 * Drawing REPL chrome from anyui widgets.
 * Compare with cutter_anyui.html. drawing.html stays the grip-edit reference.
 */

import VBox from "./anyui/v-box-cls.js";
import HBox from "./anyui/h-box-cls.js";
import Button from "./anyui/button-cls.js";
import Html from "./anyui/html-cls.js";
import Tab from "./anyui/tab-cls.js";
import {
  API_HELP,
  DEFAULT_SCRIPT,
  STAR6_SCRIPT,
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

function persist() {
  scripts.forEach((s, i) => {
    s.text = editorText(i);
    s.name = editors[i].get("name") || s.name;
  });
  saveSession({ scripts, active: scriptTabs.get("selected_index") ?? active });
}

const title = new Html({ value: `<h1 class="toolbar-title">Arc REPL</h1>` });
const hint = new Html({
  value: `<p class="hint">store() keeps a named block. Run only this script — the object list stays. reverse() is last-to-first leaves.</p>`,
});
const compare = new Html({
  value: `<span class="compare">anyui <a href="./drawing.html">drawing.html</a></span>`,
});

const btnFit = new Button({ description: "Fit" });
const btnHelp = new Button({ description: "Help" });
const btnRun = new Button({ description: "Run", button_style: "primary" });
const btnCopy = new Button({ description: "Copy script" });
const btnNew = new Button({ description: "+ Script" });
const btnSpoke = new Button({ description: "Spoke" });
const btnStar = new Button({ description: "Star6" });
const btnClear = new Button({ description: "Clear store" });

const toolbar = new HBox({
  wrap: true,
  gap: "8px",
  children: [title, btnFit, btnHelp, compare, hint],
  layout: { display: "flex", flexWrap: "wrap", alignItems: "center", width: "100%", flex: "0 0 auto" },
});

const stage = new StageWidget({
  id: "drawing-stage",
  strokes: [],
  layout: { ...fill, minHeight: "180px" },
});

const objects = new ObjectsWidget({
  id: "drawing-objects",
  items: [],
  layout: { ...fill, overflow: "auto" },
});

const objectsHead = new HBox({
  gap: "8px",
  children: [
    new Html({ value: `<div class="panel-label">Objects</div>` }),
    btnClear,
  ],
  layout: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    flex: "0 0 auto",
  },
});

const objectsPanel = new VBox({
  gap: "0px",
  children: [objectsHead, objects],
  layout: { ...fill, minWidth: "11rem", maxWidth: "16rem" },
});

const stageRow = new HBox({
  gap: "0px",
  children: [stage, objectsPanel],
  layout: { ...fill, minHeight: "180px" },
});

const scriptActions = new HBox({
  wrap: true,
  gap: "6px",
  children: [btnRun, btnCopy, btnNew, btnSpoke, btnStar],
  layout: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    width: "100%",
    flex: "0 0 auto",
    padding: "6px 10px 0",
  },
});

const scriptTabs = new Tab({
  id: "script-tabs",
  titles: scripts.map((s, i) => s.name || "Script " + (i + 1)),
  selected_index: active,
  children: editors,
  layout: { ...fill, minHeight: "8rem" },
});

const log = new LogWidget({
  id: "drawing-log",
  lines: [],
  layout: { ...fill, minHeight: "6rem" },
});

const dock = new Tab({
  id: "dock-tabs",
  titles: ["Script", "Log"],
  selected_index: 0,
  children: [
    new VBox({
      gap: "0px",
      children: [scriptActions, scriptTabs],
      layout: { ...fill, minHeight: "8rem" },
    }),
    log,
  ],
  layout: { display: "flex", flexDirection: "column", width: "100%", flex: "0 0 34vh", minHeight: "9rem" },
});

const root = new VBox({
  gap: "0px",
  children: [toolbar, stageRow, dock],
  layout: { display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: "100dvh" },
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

function syncTabTitles() {
  scriptTabs.set(
    "titles",
    editors.map((ed, i) => ed.get("name") || scripts[i].name || "Script " + (i + 1)),
  );
  scriptTabs.set("children", editors);
  scriptTabs.save_changes();
}

function runScript() {
  persist();
  const idx = scriptTabs.get("selected_index") ?? 0;
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
  scriptTabs.set("selected_index", editors.length - 1);
  syncTabTitles();
  persist();
}

btnRun.onClick(() => runScript());
btnFit.onClick(() => stage.fit());
btnHelp.onClick(() => {
  repl.note(API_HELP);
  publishLog();
  dock.set("selected_index", 1);
  dock.save_changes();
});
btnCopy.onClick(async () => {
  persist();
  const idx = scriptTabs.get("selected_index") ?? 0;
  const text = editorText(idx);
  try {
    await navigator.clipboard.writeText(text);
    repl.note("copied script");
  } catch {
    repl.note("err clipboard unavailable — select the script");
  }
  publishLog();
});
btnNew.onClick(() => addScript("Script " + (scripts.length + 1), ""));
btnSpoke.onClick(() => {
  const idx = scriptTabs.get("selected_index") ?? 0;
  editors[idx].set("name", "spoke");
  editors[idx].set("value", DEFAULT_SCRIPT);
  editors[idx].save_changes();
  scripts[idx].name = "spoke";
  syncTabTitles();
  runScript();
});
btnStar.onClick(() => {
  addScript("star6", STAR6_SCRIPT);
  runScript();
});
btnClear.onClick(() => {
  repl.resetStore();
  repl.note("store cleared");
  publishObjects();
  publishLog();
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

scriptTabs.on("change:selected_index", (idx) => {
  active = idx;
  persist();
});

const mount = document.getElementById("app");

async function boot() {
  await root.create_view({ el: mount });
  runScript();
  requestAnimationFrame(() => requestAnimationFrame(() => stage.fit()));
  window.drawingRepl = { repl, stage, scriptTabs, editors, runScript };
}

boot().catch((err) => {
  console.error(err);
  mount.textContent = err.message || String(err);
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
