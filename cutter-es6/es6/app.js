/**
 * CutterApp: main orchestrator.
 * Creates layout, instantiates widgets, wires event handlers, manages state.
 */

import { CurveEditorWidget } from "./ui/curve-editor-widget.js";
import { WebGLCutterWidget } from "./ui/webgl-cutter-widget.js";
import { ControlsWidget } from "./ui/controls-widget.js";
import { getOutline, OUTLINE_NAMES } from "./shape-builder.js";

export class CutterApp {
  constructor(container) {
    this.container = container;
    this.outline = getOutline("Duck");
    this.editor = null;
    this.viewer = null;
    this.controls = null;
    this.init();
  }

  async init() {
    // Create root layout
    this._createLayout();

    // Create widgets
    this.controls = new ControlsWidget({ shapes: OUTLINE_NAMES, scale: 11 });
    this.editor = new CurveEditorWidget({ width: 600, height: 400, outline: this.outline });
    this.viewer = new WebGLCutterWidget({
      width: 600,
      height: 400,
      outline: this.outline,
      outlineScale: 11,
      bladeScale: 5,
    });

    // Render into containers
    await this.controls.create_view({ el: this.headerEl });
    await this.editor.create_view({ el: this.editPanelEl });
    await this.viewer.create_view({ el: this.viewPanelEl });

    // Wire up state changes
    this.controls.on("change:shape", (name) => {
      this.outline = getOutline(name) || { name: "Blank", turtlePath: [] };
      this.editor.setOutline(this.outline);
      this.viewer.setOutline(this.outline, { scale: 11 });
    });

    this.controls.on("change:scale", (scale) => {
      this.viewer.setOutline(this.outline, { scale });
    });

    this.editor.on("change:outline", (outline) => {
      this.outline = outline;
      this.viewer.setOutline(outline, { scale: 11 });
    });

    // Wire up button clicks
    this.controls.on("click:fit", () => {
      this.editor.editor?.fit?.();
    });

    this.controls.on("click:insert", () => {
      this.editor.editor?.insertSegment?.();
    });

    this.controls.on("click:delete", () => {
      this.editor.editor?.deleteSegment?.();
    });

    this.controls.on("click:export", () => {
      this._exportJSON();
    });
  }

  _createLayout() {
    // Root container
    const app = document.createElement("div");
    app.id = "app";
    app.style.cssText =
      "height:100vh;display:grid;grid-template-rows:auto 1fr auto;min-height:100dvh;margin:0;padding:0;background:#12110f;color:#ece7dc;font-family:system-ui,-apple-system,sans-serif;";

    // Header
    this.headerEl = document.createElement("div");
    this.headerEl.style.cssText = "flex-shrink:0;";

    // Main stage: two-column layout for editor + viewer
    const stage = document.createElement("div");
    stage.className = "stage";
    stage.style.cssText =
      "display:grid;grid-template-columns:1fr 1fr;min-height:0;gap:0;";

    // Edit panel (left)
    this.editPanelEl = document.createElement("div");
    this.editPanelEl.className = "panel";
    this.editPanelEl.style.cssText =
      "position:relative;min-height:220px;border-right:1px solid rgba(236,231,220,0.12);";
    const editLabel = document.createElement("div");
    editLabel.className = "label";
    editLabel.textContent = "Path";
    editLabel.style.cssText =
      "position:absolute;top:10px;left:10px;z-index:2;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9a9488;pointer-events:none;";
    this.editPanelEl.appendChild(editLabel);

    // View panel (right)
    this.viewPanelEl = document.createElement("div");
    this.viewPanelEl.className = "panel";
    this.viewPanelEl.style.cssText = "position:relative;min-height:220px;";
    const viewLabel = document.createElement("div");
    viewLabel.className = "label";
    viewLabel.textContent = "3D · Blade";
    viewLabel.style.cssText =
      "position:absolute;top:10px;left:10px;z-index:2;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9a9488;pointer-events:none;";
    this.viewPanelEl.appendChild(viewLabel);

    stage.appendChild(this.editPanelEl);
    stage.appendChild(this.viewPanelEl);

    // Assemble
    app.appendChild(this.headerEl);
    app.appendChild(stage);

    this.container.appendChild(app);

    // Inject minimal inline CSS
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      html, body { margin: 0; height: 100%; background: #12110f; color: #ece7dc; font-family: system-ui, -apple-system, sans-serif; }
      button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
      button:disabled { opacity: 0.4; cursor: default; }
      input, select { font: inherit; }
      canvas { width: 100%; height: 100%; display: block; }
      @media (max-width: 800px) {
        .stage { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
        .panel + .panel { border-left: 1px solid rgba(236, 231, 220, 0.12); border-top: 1px solid rgba(236, 231, 220, 0.12); }
      }
    `;
    document.head.appendChild(style);
  }

  _exportJSON() {
    const json = JSON.stringify(this.outline, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${this.outline.name || "cutter"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
