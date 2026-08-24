import { pathStats } from "./path-utils.js";

function outlineFrom(model) {
  return {
    name: model.get("name") || "Custom",
    startPoint: model.get("startPoint") || [0, 0],
    startAngle: model.get("startAngle") ?? 0,
    turtlePath: model.get("turtlePath") || [],
  };
}

function render({ model, el }) {
  el.style.display = "block";
  el.style.width = "100%";
  el.style.alignSelf = "stretch";

  const wrap = document.createElement("div");
  wrap.className = "path-table-wrap";

  const stats = document.createElement("p");
  stats.className = "path-stats";

  const table = document.createElement("table");
  table.innerHTML = `<thead><tr><th>#</th><th>Length</th><th>Angle (deg)</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  wrap.append(stats, table);
  el.appendChild(wrap);

  function rebuild() {
    const path = model.get("turtlePath") || [];
    const sel = model.get("selected_index");
    tbody.innerHTML = "";
    path.forEach(([len, ang], i) => {
      const tr = document.createElement("tr");
      if (i === sel) tr.classList.add("sel");
      tr.innerHTML = `<td>${i + 1}</td>
        <td><input data-i="${i}" data-f="0" type="number" step="0.01" value="${len}" /></td>
        <td><input data-i="${i}" data-f="1" type="number" step="0.1" value="${ang}" /></td>`;
      tr.addEventListener("click", (e) => {
        if (e.target.tagName === "INPUT") return;
        model.set("selected_index", i);
        model.save_changes();
      });
      tbody.appendChild(tr);
    });
    try {
      const s = pathStats(outlineFrom(model));
      const closed = s.closed ? "closed" : `gap ${s.gap.toFixed(2)}`;
      stats.textContent = `${path.length} arcs · length ${s.length.toFixed(2)} · area ${s.area.toFixed(2)} · ${closed}`;
    } catch {
      stats.textContent = `${path.length} arcs`;
    }
  }

  tbody.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    const i = Number(t.dataset.i);
    const f = Number(t.dataset.f);
    const v = Number(t.value);
    const next = (model.get("turtlePath") || []).map((seg) => seg.slice());
    if (!next[i]) return;
    next[i][f] = v;
    model.set("turtlePath", next);
    model.set("selected_index", i);
    model.save_changes();
  });

  model.on("change:turtlePath", rebuild);
  model.on("change:selected_index", rebuild);
  model.on("change:startPoint", rebuild);
  model.on("change:startAngle", rebuild);
  rebuild();

  return () => wrap.remove();
}

export default { render };
export { render };
