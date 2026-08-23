
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

  // --- Named Listeners (so they can be detached) ---
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
    if (currentCleanup) {
      try { currentCleanup(); } catch (e) {}
      currentCleanup = null;
    }
    contentArea.innerHTML = "";

    const children = model.get("children") || [];
    const childModel = children[index];

    header.querySelectorAll("button").forEach((b, i) => b.classList.toggle("active", i === index));

    if (!childModel) {
      contentArea.innerHTML = "<p>(no child model)</p>";
      return;
    }

    try {
      const view = await model.widget_manager.create_view(childModel);
      contentArea.appendChild(view.el);
      if (typeof view.cleanup === "function") {
        currentCleanup = view.cleanup;
      }
    } catch (err) {
      console.error("Failed to render child:", err.message);
      contentArea.innerHTML = `<p style="color:red">Render error</p>`;
    }
  }

  function buildHeader() {
    header.innerHTML = "";
    const titles = (Array.isArray(model.get("titles")) ? model.get("titles") : []);
    titles.forEach((title, i) => {
      const btn = document.createElement("button");
      btn.textContent = title;
      btn.onclick = () => {
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