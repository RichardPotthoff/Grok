function render({model,el}){
    const input = document.createElement("input");
    input.type = "range";
    input.min = model.get("min") ?? 0;
    input.max = model.get("max") ?? 100;
    input.step = model.get("step") ?? 1;
    input.value = model.get("value") ?? 50;
    input.addEventListener("input", () => {
      model.set("value", input.value);
      model.save_changes();           // triggers your WKWebView hook or Python sync
    });

    el.appendChild(input);

    // Silent incoming updates (no loop)
    model.on("change:value", () => {
      input.value = model.get("value");
    });
}

export default { render}