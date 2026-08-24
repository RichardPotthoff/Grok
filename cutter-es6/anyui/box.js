function render({ model, el }) {
  const orientation = model.get("orientation") || "column";
  const align = (model.state.layout && model.state.layout.alignItems) || "stretch";
  el.style.display = "flex";
  el.style.flexDirection = orientation;
  el.style.alignItems = align;
  el.style.minWidth = "0";
  el.style.minHeight = "0";

  const container = document.createElement("div");
  container.className = "anyui-box";
  container.style.display = "flex";
  container.style.gap = model.get("gap") || "8px";
  container.style.flexDirection = orientation;
  container.style.flex = "1 1 auto";
  container.style.flexWrap = model.get("wrap") ? "wrap" : "nowrap";
  container.style.alignItems = align;
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.minHeight = "0";
  container.style.minWidth = "0";
  el.appendChild(container);

  let childCleanups = [];
  let generation = 0;

  async function update() {
    const gen = ++generation;
    childCleanups.forEach((cleanup) => {
      if (typeof cleanup === "function") cleanup();
    });
    childCleanups = [];
    container.innerHTML = "";
    const nextOrientation = model.get("orientation") || "column";
    el.style.flexDirection = nextOrientation;
    container.style.flexDirection = nextOrientation;
    container.style.flexWrap = model.get("wrap") ? "wrap" : "nowrap";
    container.style.gap = model.get("gap") || "8px";

    const children = model.get("children") || [];
    for (const child of children) {
      if (!child) continue;
      try {
        const child_model =
          typeof child === "string"
            ? await model.widget_manager.get_model(child.replace("IPY_MODEL_", ""))
            : child;
        if (!child_model) continue;
        const view = await model.widget_manager.create_view(child_model);
        if (gen !== generation) {
          if (view.cleanup) view.cleanup();
          continue;
        }
        container.appendChild(view.el);
        if (view.cleanup) childCleanups.push(view.cleanup);
      } catch (err) {
        console.error("Box child render failed", err && err.message);
      }
    }
  }

  model.on("change:children", update);
  model.on("change:orientation", update);
  model.on("change:wrap", update);
  model.on("change:gap", update);
  update();

  return () => {
    model.off("change:children", update);
    model.off("change:orientation", update);
    model.off("change:wrap", update);
    model.off("change:gap", update);
    childCleanups.forEach((cleanup) => cleanup());
    container.remove();
  };
}

export default { render };
