function render({ model, el }) {
  el.classList.add("anyui-collapsible");
  el.style.display = "flex";
  el.style.minWidth = "0";
  el.style.minHeight = "0";
  el.style.overflow = "hidden";

  const bar = document.createElement("div");
  bar.className = "anyui-collapsible-bar";
  const toggle = document.createElement("button");
  toggle.type = "button";
  bar.appendChild(toggle);

  const content = document.createElement("div");
  content.className = "anyui-collapsible-content";

  let childCleanup = null;
  let gen = 0;

  function side() {
    return model.get("side") || "left";
  }

  function isOpen() {
    return !!model.get("open");
  }

  function title() {
    return model.get("title") || "";
  }

  function glyph() {
    const s = side();
    const open = isOpen();
    if (s === "left") return open ? "‹" : "›";
    if (s === "right") return open ? "›" : "‹";
    if (s === "bottom") return open ? "▼" : "▲";
    return open ? "▲" : "▼";
  }

  function applyChrome() {
    const s = side();
    const open = isOpen();
    el.classList.toggle("open", open);
    el.classList.remove("side-left", "side-right", "side-bottom", "side-top");
    el.classList.add("side-" + s);

    const label = title();
    toggle.textContent = (glyph() + " " + label).trim();

    if (s === "left" || s === "right") {
      el.style.flexDirection = open ? "row" : "column";
      el.style.width = open ? "" : "28px";
      el.style.minWidth = open ? "0" : "28px";
      el.style.height = "100%";
      el.style.flex = open ? "0 0 14rem" : "0 0 28px";
    } else {
      el.style.flexDirection = "column";
      el.style.height = open ? "" : "32px";
      el.style.minHeight = open ? "0" : "32px";
      el.style.width = "100%";
      el.style.flex = open ? "1 1 auto" : "0 0 32px";
    }

    content.style.display = open ? "flex" : "none";
    content.style.flexDirection = "column";
  }

  async function showChild() {
    const g = ++gen;
    if (childCleanup) {
      try { childCleanup(); } catch (e) {}
      childCleanup = null;
    }
    content.replaceChildren();
    if (!isOpen()) return;

    const child = model.get("child");
    if (!child) return;
    try {
      const childModel =
        typeof child === "string"
          ? await model.widget_manager.get_model(child.replace("IPY_MODEL_", ""))
          : child;
      if (!childModel || g !== gen) return;
      const view = await model.widget_manager.create_view(childModel);
      if (g !== gen) {
        if (view.cleanup) view.cleanup();
        return;
      }
      content.appendChild(view.el);
      if (view.cleanup) childCleanup = view.cleanup;
    } catch (err) {
      if (g !== gen) return;
      content.textContent = "render error";
    }
  }

  function onToggle(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    model.set("open", !isOpen());
    model.save_changes();
  }

  toggle.addEventListener("click", onToggle);
  // bar click only if the event didn't come from the button
  bar.addEventListener("click", (ev) => {
    if (ev.target === toggle) return;
    onToggle(ev);
  });

  function refresh() {
    applyChrome();
    showChild();
  }

  model.on("change:open", refresh);
  model.on("change:title", refresh);
  model.on("change:side", refresh);
  model.on("change:child", refresh);

  // order: for right side, content then bar when open? keep bar first for left/bottom
  function mount() {
    el.replaceChildren();
    const s = side();
    if (s === "right" || s === "bottom") {
      el.append(content, bar);
    } else {
      el.append(bar, content);
    }
  }

  mount();
  refresh();

  return () => {
    model.off("change:open", refresh);
    model.off("change:title", refresh);
    model.off("change:side", refresh);
    model.off("change:child", refresh);
    if (childCleanup) childCleanup();
  };
}

export default { render };
