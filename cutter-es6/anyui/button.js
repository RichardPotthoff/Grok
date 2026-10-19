function render({ model, el }) {
  const btn = document.createElement("button");
  btn.type = "button";

  const apply = () => {
    const icon = model.get("icon");
    const label = model.get("description") || "";
    btn.replaceChildren();
    if (icon) {
      const wrap = document.createElement("span");
      wrap.className = "anyui-btn-icon";
      wrap.innerHTML = icon;
      btn.appendChild(wrap);
      if (label && model.get("icon_label")) {
        const t = document.createElement("span");
        t.textContent = label;
        btn.appendChild(t);
      }
      btn.title = label;
      btn.setAttribute("aria-label", label || "button");
    } else {
      btn.textContent = label || "Click";
    }
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
  model.on("change:icon", apply);

  el.appendChild(btn);
  return () => {
    model.off("change:description", apply);
    model.off("change:disabled", apply);
    model.off("change:button_style", apply);
    model.off("change:icon", apply);
    btn.remove();
  };
}

export default { render };
