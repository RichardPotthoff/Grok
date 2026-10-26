/* Generic tree. Nodes are { id, parent, label, kind }.
   kind "branch" | "leaf" is optional; a node with children is a branch.
   mode "tree" indents and folds. mode "folder" shows one parent's children. */

function render({ model, el }) {
  el.classList.add("anyui-tree");
  el.style.display = "flex";
  el.style.flex = "1 1 auto";
  el.style.minWidth = "0";
  el.style.minHeight = "0";
  el.style.overflow = "auto";

  const list = document.createElement("div");
  list.className = "anyui-tree-list";
  el.appendChild(list);

  function index(nodes) {
    const byParent = new Map();
    const byId = new Map();
    for (const n of nodes) {
      const parent = n.parent || "";
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(n);
      byId.set(n.id, n);
    }
    for (const kids of byParent.values()) {
      kids.sort((a, b) => {
        const ab = branch(a, byParent) ? 0 : 1;
        const bb = branch(b, byParent) ? 0 : 1;
        if (ab !== bb) return ab - bb;
        return String(a.label || "").localeCompare(String(b.label || ""));
      });
    }
    return { byParent, byId };
  }

  function branch(n, byParent) {
    if (n.kind === "branch") return true;
    if (n.kind === "leaf") return false;
    return byParent.has(n.id);
  }

  function parentOf(id) {
    const i = String(id || "").lastIndexOf("/");
    return i < 0 ? "" : id.slice(0, i);
  }

  function row(label, { depth = 0, id = "", isBranch = false, open = false, up = false } = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "anyui-tree-row";
    if (id && id === model.get("selected")) btn.classList.add("is-selected");
    btn.style.paddingLeft = 6 + depth * 14 + "px";
    const mark = document.createElement("span");
    mark.className = "anyui-tree-mark";
    mark.textContent = up ? "" : isBranch ? (open ? "▾" : "▸") : "";
    const name = document.createElement("span");
    name.className = "anyui-tree-label";
    name.textContent = label;
    btn.append(mark, name);
    return btn;
  }

  function paint() {
    const nodes = model.get("nodes") || [];
    const mode = model.get("mode") || "tree";
    const open = new Set(model.get("open") || []);
    const { byParent } = index(nodes);
    list.replaceChildren();

    if (mode === "folder") {
      const cwd = model.get("cwd") || "";
      if (cwd) {
        const up = row("..", { up: true });
        up.addEventListener("click", () => {
          model.send({ event: "navigate", id: parentOf(cwd) });
        });
        list.appendChild(up);
      }
      for (const n of byParent.get(cwd) || []) {
        const isBranch = branch(n, byParent);
        const btn = row(n.label || n.id, { id: n.id, isBranch, open: true });
        btn.addEventListener("click", () => {
          model.send({ event: "select", id: n.id });
          if (isBranch) model.send({ event: "navigate", id: n.id });
          else model.send({ event: "activate", id: n.id });
        });
        list.appendChild(btn);
      }
      if (!list.children.length) {
        const empty = document.createElement("div");
        empty.className = "anyui-tree-empty";
        empty.textContent = "(empty)";
        list.appendChild(empty);
      }
      return;
    }

    const walk = (parent, depth) => {
      for (const n of byParent.get(parent) || []) {
        const isBranch = branch(n, byParent);
        const isOpen = open.has(n.id);
        const btn = row(n.label || n.id, { depth, id: n.id, isBranch, open: isOpen });
        btn.addEventListener("click", (ev) => {
          const onMark = ev.target.classList.contains("anyui-tree-mark");
          if (isBranch && onMark) {
            model.send({ event: "toggle", id: n.id, open: !isOpen });
            return;
          }
          model.send({ event: "select", id: n.id });
          if (!isBranch) model.send({ event: "activate", id: n.id });
        });
        list.appendChild(btn);
        if (isBranch && isOpen) walk(n.id, depth + 1);
      }
    };
    walk("", 0);
  }

  for (const key of ["nodes", "open", "cwd", "selected", "mode"]) {
    model.on("change:" + key, paint);
  }
  paint();
}

export default { render };
