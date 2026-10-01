
function render({ model, el }) {
  el.innerHTML = "";
  const container = document.createElement("div");
  container.className = "anyui-tab";
  const header = document.createElement("div");
  header.className = "anyui-tab-header";
  const contentArea = document.createElement("div");
  contentArea.className = "anyui-tab-content";
  container.append(header, contentArea);
  el.appendChild(container);

  let currentCleanup = null;
  let showGen = 0;

  const onTitlesChange = () => {
    buildHeader();
    showTab(model.get("selected_index") ?? 0);
  };

  const onChildrenChange = () => {
    showTab(model.get("selected_index") ?? 0);
  };

  const onSelectionChange = (idx) => {
    showTab(idx);
  };

  async function showTab(index) {
    const gen = ++showGen;
    if (currentCleanup) {
      try { currentCleanup(); } catch (e) {}
      currentCleanup = null;
    }
    contentArea.replaceChildren();

    const children = model.get("children") || [];
    const childModel = children[index];

    header.querySelectorAll("button").forEach((b, i) => b.classList.toggle("active", i === index));

    if (!childModel) {
      if (gen !== showGen) return;
      contentArea.textContent = "(no child model)";
      return;
    }

    try {
      const view = await model.widget_manager.create_view(childModel);
      if (gen !== showGen) {
        if (view.cleanup) view.cleanup();
        return;
      }
      contentArea.replaceChildren(view.el);
      if (typeof view.cleanup === "function") currentCleanup = view.cleanup;
    } catch (err) {
      if (gen !== showGen) return;
      console.error("Failed to render child:", err.message);
      contentArea.textContent = "Render error";
    }
  }

  function buildHeader() {
    const titles = Array.isArray(model.get("titles")) ? model.get("titles") : [];
    header.replaceChildren();
    titles.forEach((title, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = title;
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        model.set("selected_index", i);
        model.save_changes();
      };
      header.appendChild(btn);
    });
  }

  // Bind named listeners
  model.on("change:titles", onTitlesChange);
  model.on("change:children", onChildrenChange);
  model.on("change:selected_index", onSelectionChange);

  buildHeader();
  showTab(model.get("selected_index") ?? 0);

  // --- The Cleanup Closure ---
  return () => {
    console.log(`[Tab View] Cleaning up for ${model.id}`);
    
    // 1. Stop listening to the model
    model.off("change:titles", onTitlesChange);
    model.off("change:children", onChildrenChange);
    model.off("change:selected_index", onSelectionChange);
    
    // 2. Clean up the currently visible child tab
    if (currentCleanup) currentCleanup();
    
    // 3. Remove the DOM
    container.remove();
  };
}

export default {render}