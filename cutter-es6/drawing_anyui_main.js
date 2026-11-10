/**
 * Drawing REPL chrome — icon-rail sidebars.
 * Left: Files (list → editor). Right: Preview / Objects / Log.
 * Right views are multi-select; Preview and Log stack vertically.
 * Collapsing the right rail gives the script the full remaining width.
 */

import VBox from "./anyui/v-box-cls.js";
import HBox from "./anyui/h-box-cls.js";
import Button from "./anyui/button-cls.js";
import Html from "./anyui/html-cls.js";
import Tree from "./anyui/tree-cls.js";
import {
  API_HELP,
  DEFAULT_SCRIPT,
  STAR6_SCRIPT,
  SLICE_SCRIPT,
  PRINT_SCRIPT,
  DrawingRepl,
  loadSession,
  newScript,
  saveSession,
} from "./es6/drawing-repl.js";
import { LogWidget, ObjectsWidget, ScriptWidget, StageWidget, Preview3dWidget } from "./es6/drawing-ui-cls.js";
import { RAIL } from "./es6/rail-icons.js";
import { Zip } from "./es6/ZipEngine.js";

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
const rightViews = new Set(); // "preview" | "objects" | "log" — multi-select
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
const btnLogCopy = new Button({ description: "Copy" });
const btnLogClear = new Button({ description: "Clear" });
const btnNew = new Button({ description: "+ Script" });
const btnZipDown = new Button({ description: "Download" });
const btnZipUp = new Button({ description: "Upload" });
const btnClose = new Button({ description: "Close" });
const btnSpoke = new Button({ description: "Spoke" });
const btnStar = new Button({ description: "Star6" });
const btnSlice = new Button({ description: "Slice" });
const btnPrint = new Button({ description: "Print" });
const btnClearStore = new Button({ description: "Clear store" });
const btnClearCanvas = new Button({ description: "Clear" });
const btnRename = new Button({ description: "Rename" });
const btnDone = new Button({ description: "Done" });
const btnHideOutput = new Button({ description: "Output" });

const btnFiles = new Button({ description: "Files", icon: RAIL.files });
const btnHideLeft = new Button({ description: "Hide left", icon: RAIL.hideLeft });
const btnPreview = new Button({ description: "Preview", icon: RAIL.preview });
const btn3d = new Button({ description: "3D", icon: RAIL.preview3d });
const btnObjects = new Button({ description: "Objects", icon: RAIL.objects });
const btnLog = new Button({ description: "Log", icon: RAIL.log });
const btnHideRight = new Button({ description: "Hide right", icon: RAIL.hideRight });

const scriptNameLabel = new Html({ value: `<span class="panel-label">script</span>` });

const toolbar = new HBox({
  wrap: true,
  gap: "6px",
  children: [title],
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

const previewHead = new HBox({
  gap: "6px",
  children: [
    new Html({ value: `<span class="panel-label">Preview</span>` }),
    btnFit,
    btnClearCanvas,
  ],
  layout: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    width: "100%",
    flex: "0 0 auto",
    padding: "4px 6px",
  },
});

const previewPanel = new VBox({
  gap: "0px",
  children: [previewHead, stage],
  layout: { ...fill },
});

const preview3d = new Preview3dWidget({
  id: "drawing-3d",
  mesh: null,
  layout: { ...fill, minHeight: "80px" },
});

const preview3dPanel = new VBox({
  gap: "0px",
  children: [
    new HBox({
      gap: "6px",
      children: [new Html({ value: `<span class="panel-label">3D</span>` })],
      layout: {
        display: "flex",
        alignItems: "center",
        width: "100%",
        flex: "0 0 auto",
        padding: "4px 6px",
      },
    }),
    preview3d,
  ],
  layout: { ...fill },
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
    new HBox({
      gap: "6px",
      children: [
        new Html({ value: `<span class="panel-label">Log</span>` }),
        btnHelp,
        btnLogCopy,
        btnLogClear,
      ],
      layout: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        width: "100%",
        flex: "0 0 auto",
        padding: "4px 6px",
      },
    }),
    log,
  ],
  layout: { ...fill },
});

const fileTree = new Tree({
  id: "script-tree",
  mode: "folder",
  cwd: "",
  nodes: [],
  selected: "",
  layout: { ...fill, overflow: "auto" },
});

const filesHead = new HBox({
  wrap: true,
  gap: "4px",
  children: [btnNew, btnRename, btnZipDown, btnZipUp, btnSpoke, btnStar, btnSlice, btnPrint],
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
  children: [filesHead, fileTree],
  layout: { ...fill },
});

const editorHead = new HBox({
  wrap: true,
  gap: "4px",
  children: [btnDone, btnRun, btnHideOutput, btnCopy, scriptNameLabel],
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
  layout: { ...fill, minWidth: "280px", flex: "1 1 0" },
});

const leftSidebar = new HBox({
  gap: "0px",
  children: [leftIcons, leftContent],
  layout: {
    display: "flex",
    flexDirection: "row",
    flex: "1 1 0",
    minWidth: "40px",
    height: "100%",
    borderRight: "1px solid #ddd6c8",
  },
});

const rightIcons = new VBox({
  gap: "0px",
  children: [btnPreview, btn3d, btnObjects, btnLog, btnHideRight],
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
  children: [],
  layout: { ...fill, minWidth: "240px", flex: "1 1 0" },
});

const rightSidebar = new HBox({
  gap: "0px",
  children: [rightContent, rightIcons],
  layout: {
    display: "flex",
    flexDirection: "row",
    flex: "1 1 0",
    minWidth: "40px",
    height: "100%",
    borderLeft: "1px solid #ddd6c8",
  },
});

const stageRow = new HBox({
  gap: "0px",
  children: [leftSidebar, rightSidebar],
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
      .map(({ u, use }) => ({
        startPoint: u.startPoint,
        startAngle: u.startAngle,
        turtlePath: u.turtlePath,
        tagged: u.tagged,
        root: use && use.root,
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
  const nodes = [];
  const seen = new Set();
  scripts.forEach((s, i) => {
    const name = scriptName(i);
    const parts = name.split("/").filter(Boolean);
    let parent = "";
    for (let k = 0; k < parts.length - 1; k++) {
      const id = parts.slice(0, k + 1).join("/");
      if (!seen.has(id)) {
        seen.add(id);
        nodes.push({ id, parent, label: parts[k], kind: "branch" });
      }
      parent = id;
    }
    nodes.push({
      id: "s:" + s.id,
      parent,
      label: parts[parts.length - 1] || name,
      kind: "leaf",
    });
  });
  fileTree.set("nodes", nodes);
  fileTree.save_changes();
}

function renameScript(idx) {
  const cur = scriptName(idx);
  const next = prompt("Script path", cur);
  if (!next) return;
  const name = next.trim().replace(/^\/+|\/+$/g, "");
  if (!name || name === cur) return;
  editors[idx].set("name", name);
  editors[idx].save_changes();
  scripts[idx].name = name;
  persist();
  if (active === idx) showEditor(idx);
  refreshFilesList();
  repl.note("renamed " + cur + " → " + name);
  publishLog();
}

function renameFolder(dir) {
  const next = prompt("Folder path", dir);
  if (!next) return;
  const to = next.trim().replace(/^\/+|\/+$/g, "");
  if (!to || to === dir) return;
  scripts.forEach((s, i) => {
    const name = scriptName(i);
    if (name === dir || name.startsWith(dir + "/")) {
      const renamed = to + name.slice(dir.length);
      editors[i].set("name", renamed);
      editors[i].save_changes();
      s.name = renamed;
    }
  });
  const cwd = fileTree.get("cwd") || "";
  if (cwd === dir || cwd.startsWith(dir + "/")) {
    fileTree.set("cwd", to + cwd.slice(dir.length));
  }
  persist();
  refreshFilesList();
  if (scripts[active]) showEditor(active);
  repl.note("folder " + dir + " → " + to);
  publishLog();
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
  // Collapsed side is icons only and must not take a flex share.
  const leftFlex = leftOpen ? "1 1 0" : "0 0 auto";
  const rightFlex = rightOpen ? "1 1 0" : "0 0 auto";
  leftSidebar.set("layout", {
    display: "flex",
    flexDirection: "row",
    flex: leftFlex,
    minWidth: "40px",
    height: "100%",
    borderRight: "1px solid #ddd6c8",
  });
  leftSidebar.save_changes();
  rightSidebar.set("layout", {
    display: "flex",
    flexDirection: "row",
    flex: rightFlex,
    minWidth: "40px",
    height: "100%",
    borderLeft: "1px solid #ddd6c8",
  });
  rightSidebar.save_changes();

  leftSidebar.set("children", leftOpen ? [leftIcons, leftContent] : [leftIcons]);
  leftSidebar.save_changes();
  if (leftOpen) {
    leftContent.set("children", leftView === "editor" ? [editorView] : [filesView]);
    leftContent.save_changes();
  }
  btnFiles.set("icon", leftOpen && leftView === "files" ? RAIL.filesOpen : RAIL.files);
  btnFiles.set("button_style", leftOpen && leftView === "files" ? "primary" : "");
  btnFiles.save_changes();

  rightSidebar.set("children", rightOpen ? [rightContent, rightIcons] : [rightIcons]);
  rightSidebar.save_changes();
  if (rightOpen) {
    const panels = [];
    if (rightViews.has("preview")) panels.push(previewPanel);
    if (rightViews.has("3d")) panels.push(preview3dPanel);
    if (rightViews.has("objects")) panels.push(objectsPanel);
    if (rightViews.has("log")) panels.push(logPanel);
    rightContent.set("children", panels);
    rightContent.save_changes();
  }
  btnPreview.set("button_style", rightOpen && rightViews.has("preview") ? "primary" : "");
  btnPreview.save_changes();
  btn3d.set("button_style", rightOpen && rightViews.has("3d") ? "primary" : "");
  btn3d.save_changes();
  btnObjects.set("button_style", rightOpen && rightViews.has("objects") ? "primary" : "");
  btnObjects.save_changes();
  btnLog.set("button_style", rightOpen && rightViews.has("log") ? "primary" : "");
  btnLog.save_changes();

  if (stage.fit) requestAnimationFrame(() => stage.fit());
}

async function runScript() {
  persist();
  const idx = active;
  const src = editorText(idx);
  const id = scripts[idx] && scripts[idx].id;
  const s = scripts[idx];
  if (s) {
    s.ok = false;
    saveSession({ scripts, active });
  }
  try {
    await repl.run(src, { scriptId: id, scriptName: scriptName(idx) });
    if (s) {
      s.ok = true;
      saveSession({ scripts, active });
    }
  } catch {
    /* logged; ok stays false */
  }
  publishObjects();
  publishLog();
  publishStrokes();
  if (!rightOpen || !rightViews.has("preview")) {
    rightOpen = true;
    rightViews.add("preview");
    applyLayout();
  }
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
  rightViews.add("log");
  applyLayout();
});
btnLogCopy.onClick(async () => {
  const text = (repl.log || []).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    repl.note("copied log");
  } catch {
    repl.note("err clipboard unavailable");
  }
  publishLog();
});
btnLogClear.onClick(() => {
  repl.log = [];
  repl.note("log cleared");
  publishLog();
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

async function downloadScripts() {
  persist();
  const files = scripts.map((s, i) => ({
    name: scriptName(i).replace(/\\/g, "/") + ".js",
    content: editorText(i),
  }));
  try {
    const blob = await Zip.compress(files);
    const file = new File([blob], "scripts.zip", { type: "application/zip" });
    // Title/text on the share sheet is saved by Files as an extra .txt ("scripts").
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      repl.note("shared " + files.length + " scripts");
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scripts.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      repl.note("downloaded " + files.length + " scripts");
    }
  } catch (err) {
    repl.note("err zip " + (err.message || String(err)));
  }
  publishLog();
}

function isZipJunk(name) {
  const p = String(name || "").replace(/\\/g, "/");
  if (p.startsWith("__MACOSX/") || p.includes("/__MACOSX/")) return true;
  const base = p.slice(p.lastIndexOf("/") + 1);
  return base === ".DS_Store" || base.startsWith("._");
}

function commonZipRoot(names) {
  if (!names.length) return "";
  const first = names[0].split("/");
  if (first.length < 2) return "";
  const root = first[0] + "/";
  return names.every((n) => n.startsWith(root)) ? root : "";
}

function uploadScripts() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".zip,application/zip";
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const entries = await Zip.decompress(file);
      const decoder = new TextDecoder();
      const usable = [];
      for (const entry of entries) {
        const raw = String(entry.name || "").replace(/\\/g, "/");
        if (!raw || raw.endsWith("/") || isZipJunk(raw)) continue;
        if (raw.includes("\0")) continue;
        const text = decoder.decode(entry.content);
        if (text.includes("\0")) continue;
        usable.push({ name: raw.replace(/^\/+/, ""), text });
      }
      const root = commonZipRoot(usable.map((e) => e.name));
      let n = 0;
      for (const entry of usable) {
        let path = root ? entry.name.slice(root.length) : entry.name;
        path = path.replace(/\.js$/i, "").replace(/^\/+|\/+$/g, "");
        if (!path) continue;
        const idx = scripts.findIndex((s, i) => scriptName(i) === path);
        if (idx >= 0) {
          editors[idx].set("value", entry.text);
          editors[idx].save_changes();
          scripts[idx].text = entry.text;
        } else {
          const s = newScript(path, entry.text);
          scripts.push(s);
          const ed = new ScriptWidget({
            id: "script-" + s.id,
            value: entry.text,
            name: path,
            layout: { ...fill, height: "100%" },
          });
          ed.on("msg:custom", (msg) => {
            if (msg && msg.event === "run") runScript();
          });
          editors.push(ed);
        }
        n++;
      }
      persist();
      refreshFilesList();
      repl.note("uploaded " + n + " scripts" + (root ? " from " + root : ""));
    } catch (err) {
      repl.note("err zip " + (err.message || String(err)));
    }
    publishLog();
  };
  input.click();
}
btnNew.onClick(() => {
  const cwd = fileTree.get("cwd") || "";
  const base = "Script " + (scripts.length + 1);
  addScript(cwd ? cwd + "/" + base : base, "");
});
btnZipDown.onClick(() => downloadScripts());
btnZipUp.onClick(() => uploadScripts());
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
btnPrint.onClick(() => {
  openNamed("print", PRINT_SCRIPT);
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
btnRename.onClick(() => {
  const sel = fileTree.get("selected") || "";
  const cwd = fileTree.get("cwd") || "";
  if (sel.startsWith("s:")) {
    const idx = scripts.findIndex((s) => "s:" + s.id === sel);
    if (idx >= 0) renameScript(idx);
    return;
  }
  if (sel) renameFolder(sel);
  else if (cwd) renameFolder(cwd);
});

fileTree.on("msg:custom", (msg) => {
  if (!msg) return;
  if (msg.event === "select") {
    fileTree.set("selected", msg.id);
    fileTree.save_changes();
  }
  if (msg.event === "navigate") {
    fileTree.set("cwd", msg.id || "");
    fileTree.set("selected", "");
    fileTree.save_changes();
  }
  if (msg.event === "activate" && String(msg.id).startsWith("s:")) {
    const idx = scripts.findIndex((s) => "s:" + s.id === msg.id);
    if (idx >= 0) openEditor(idx);
  }
  if (msg.event === "toggle") {
    const open = new Set(fileTree.get("open") || []);
    if (msg.open) open.add(msg.id);
    else open.delete(msg.id);
    fileTree.set("open", [...open]);
    fileTree.save_changes();
  }
});
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
function toggleRight(view) {
  if (rightOpen && rightViews.has(view) && rightViews.size === 1) {
    rightOpen = false;
  } else {
    rightOpen = true;
    if (rightViews.has(view)) rightViews.delete(view);
    else rightViews.add(view);
    if (rightViews.size === 0) rightOpen = false;
  }
  applyLayout();
}

btnPreview.onClick(() => toggleRight("preview"));
btn3d.onClick(() => toggleRight("3d"));
btnObjects.onClick(() => toggleRight("objects"));
btnLog.onClick(() => toggleRight("log"));
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

editors.forEach((ed, i) => {
  ed.on("msg:custom", (msg) => {
    if (msg && msg.event === "run") runScript();
  });
  ed.on("change:value", () => {
    const s = scripts[i];
    if (s && s.ok) {
      s.ok = false;
      persist();
    }
  });
});

function openForm(title, fields) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:50;";
    const card = document.createElement("form");
    card.style.cssText = "background:#f7f3ea;padding:16px;border-radius:8px;min-width:260px;max-width:90vw;display:flex;flex-direction:column;gap:8px;";
    const h = document.createElement("div");
    h.textContent = title || "Parameters";
    h.style.fontWeight = "600";
    card.append(h);
    const inputs = {};
    for (const f of fields || []) {
      const row = document.createElement("label");
      row.style.cssText = "display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:14px;";
      row.append(document.createTextNode(f.label || f.key));
      const input = document.createElement("input");
      input.value = f.value == null ? "" : String(f.value);
      input.style.width = "8rem";
      row.append(input);
      card.append(row);
      inputs[f.key] = input;
    }
    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.textContent = "OK";
    buttons.append(cancel, ok);
    card.append(buttons);
    overlay.append(card);
    document.body.append(overlay);
    const close = (value) => {
      overlay.remove();
      resolve(value);
    };
    cancel.onclick = () => close(null);
    card.onsubmit = (e) => {
      e.preventDefault();
      const out = {};
      for (const f of fields || []) {
        const raw = inputs[f.key].value;
        const n = Number(raw);
        out[f.key] = raw !== "" && Number.isFinite(n) ? n : raw;
      }
      close(out);
    };
  });
}

const mount = document.getElementById("app");

async function boot() {
  await root.create_view({ el: mount });
  refreshFilesList();
  applyLayout();
  if (scripts.length) openEditor(active);
  // Only auto-run scripts that previously finished successfully.
  // An infinite loop never returns, so it never gets marked ok and will not restart on reload.
  const okIdx = scripts.map((s, i) => (s.ok ? i : -1)).filter((i) => i >= 0);
  for (const i of okIdx) {
    active = i;
    await runScript();
  }
  if (scripts.length) {
    active = Math.max(0, Math.min(scripts.length - 1, session.active || 0));
    openEditor(active);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => stage.fit()));
  window.drawingRepl = {
    repl,
    stage,
    editors,
    runScript,
    applyLayout,
    show3d(mesh) {
      preview3d.setMesh(mesh);
      rightOpen = true;
      rightViews.add("3d");
      applyLayout();
    },
    form(title, fields) {
      return openForm(title, fields);
    },
  };
}

boot().catch((err) => {
  console.error(err);
  mount.textContent = err.message || String(err);
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
