
// static/dropdown.js
function render({ model, el }) {
    el.classList.add("anyui-dropdown-container");

    const label = document.createElement("label");
    label.textContent = model.get("description") || "";
    label.style.minWidth = model.get("style")?.descriptionWidth  || "140px";
    label.style.textAlign = "right";
    
    // Apply the description_width from the style object
    const style = model.get("style") || {};
    if (style.descriptionWidth) {
        label.style.width = style.descriptionWidth;
        label.style.display = "inline-block";
    }

    const select = document.createElement("select");
    select.style.flex = "1";
    select.style.minWidth = "0";
    select.style.boxSizing = "border-box";
    // Populate options from the JSON array
    const options = model.get("options") || [];
    options.forEach((opt, idx) => {
        const optionEl = document.createElement("option");
        optionEl.value = idx;
        optionEl.textContent = opt;
        if (idx === model.get("index")) {
            optionEl.selected = true;
        }
        select.appendChild(optionEl);
    });

    // Sync changes back to the model
    select.addEventListener("change", (e) => {
        const newIndex = parseInt(e.target.value);
        model.set("index", newIndex);
        model.set("value", options[newIndex]);
        model.save_changes();
    });

    el.appendChild(label);
    el.appendChild(select);
    
    // Listen for external model updates
    const update = (val) => { select.value = val; };
    model.on("change:index", update);
    return () => {
        // Standard cleanup logic
        model.off("change:index", update);
        container.remove();
    };
}

export default { render };