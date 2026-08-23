//alert("box url  "+import.meta.url);

function render({ model, el }) {
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.gap = "8px";
  container.style.flexDirection = model.get("orientation") || "column";
  el.appendChild(container);

  // Keep track of all active child cleanup functions
  let childCleanups = [];

  async function update() {
    // 1. Clean up ALL existing children first
    childCleanups.forEach(cleanup => {
        if (typeof cleanup === "function") cleanup();
    });
    childCleanups = [];
    container.innerHTML = "";

    // 2. Render new children
    const children = model.get("children") || [];
    var child_model=null;
    for (const child of children) {
      if (child) {
        try {
          if (typeof child === "string"){
             child_model =  await model.widget_manager.get_model(child.replace("IPY_MODEL_",""));
          } else {
              child_model = child;
          }

          const view = await model.widget_manager.create_view(child_model);
          
          container.appendChild(view.el);
          // Store the specific cleanup for this child
          if (view.cleanup) childCleanups.push(view.cleanup);
        } catch (err) {
            alert(error.message);
          console.error("Box child render failed", err.message);
        }
      }
    }
  }

  model.on("change:children", update);
  model.on("change:orientation", () => {
    container.style.flexDirection = model.get("orientation");
  });

  update();

  // 3. RETURN THE MASTER CLEANUP
  return () => {
    model.off("change:children", update);
    childCleanups.forEach(cleanup => cleanup());
    container.remove();
  };
}

export default { render };
