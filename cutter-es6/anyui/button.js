function render({ model, el }) {
  const btn = document.createElement("button");
  btn.type = "button";

  const apply = () => {
    btn.textContent = model.get("description") || "Click";
    btn.disabled = !!model.get("disabled");
    const style = model.get("button_style") || "";
    btn.className = style ? `anyui-btn anyui-btn-${style}` : "anyui-btn";
  };
  apply();

  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    model.send({ event: "click" });
  });

  model.on("change:description", apply);
  model.on("change:disabled", apply);
  model.on("change:button_style", apply);

  el.appendChild(btn);
  return () => {
    model.off("change:description", apply);
    model.off("change:disabled", apply);
    model.off("change:button_style", apply);
    btn.remove();
  };
}

export default { render };
