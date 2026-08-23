// --- Console Tee Setup ---
function setupLogger() {
  // 1. Create the UI elements
  const container = document.createElement("div");
  container.id = "anyui-console-wrapper";
  container.style.cssText = `
    margin: 20px 0; padding: 12px; background: #1e1e1e; color: #ddd;
    font-family: monospace; font-size: 13px; border: 1px solid #444;
    border-radius: 6px; position: relative;
  `;

  const header = document.createElement("div");
  header.style.cssText = "display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 4px;";
  header.innerHTML = "<strong>AnyUI Console Output</strong>";

  const copyBtn = document.createElement("button");
  copyBtn.innerText = "Copy Logs";
  copyBtn.style.cssText = "cursor: pointer; padding: 2px 8px; font-size: 11px; background: #444; color: #fff; border: none; border-radius: 3px;";
  
  const logArea = document.createElement("div");
  logArea.id = "anyui-console-log";
  logArea.style.cssText = "max-height: 400px; overflow-y: auto; white-space: pre-wrap; line-height: 1.4;";

  header.appendChild(copyBtn);
  container.appendChild(header);
  container.appendChild(logArea);
  document.body.appendChild(container); // Appends to the end of body

  // 2. Logic to append messages
  const appendToConsole = (level, color, ...args) => {
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');

    const line = document.createElement('div');
    line.style.marginBottom = '2px';
    line.innerHTML = `<span style="color:#888">[${timestamp}]</span> <span style="color:${color}">[${level.toUpperCase()}]</span> ${message}`;
    logArea.appendChild(line);
    logArea.scrollTop = logArea.scrollHeight;
  };

  // 3. Override Globals
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...args) => { original.log(...args); appendToConsole('log', '#ddd', ...args); };
  console.warn = (...args) => { original.warn(...args); appendToConsole('warn', '#ffcc00', ...args); };
  console.error = (...args) => { original.error(...args); appendToConsole('error', '#ff6666', ...args); };

  // 4. Copy to clipboard logic
  copyBtn.onclick = () => {
    const text = logArea.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const oldText = copyBtn.innerText;
      copyBtn.innerText = "✅ Copied!";
      setTimeout(() => copyBtn.innerText = oldText, 2000);
    }).catch(err => {
      alert("Copy failed: " + err);
    });
  };
}

// Initialize logger immediately when module loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupLogger);
} else {
  setupLogger();
}

import { widgetManager,loadCSS } from "./anyui-model.js";
import HTML from "./html-cls.js";   // ← added as requested

// Dynamic module loader
const moduleCache = new Map();

async function loadModule(relpath) {
  const href = new URL(relpath, import.meta.url).href;
  if (moduleCache.has(href)) {
    console.log(`[Cache hit] ${relpath}`);
    return moduleCache.get(href);
  }

  try {
    console.log(`[Loading module] ${relpath}`);
    const module = await import(href);
    moduleCache.set(href, module);
    console.log(`✅ Loaded module: ${relpath}`);
    return module;
  } catch (err) {
    console.warn(`⚠️ Failed to load module ${relpath}`);
    return null;
  }
}

const toCamel = (str) => str.replace(/([-_][a-z])/g, group =>
        group.toUpperCase().replace('-', '').replace('_', '')
    );

async function buildWidgetTree(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;

  const tagName = el.tagName.toLowerCase();
  const isAnyUI = tagName.startsWith("anyui-");

  // 1. Resolve the Widget Class (with fallback)
  let WidgetClass = null;
  let usePlaceholder = false;

  if (isAnyUI) {
      
    WidgetClass = await widgetManager.getOrLoadClass(tagName);
    
    if (!WidgetClass) {
      console.warn(`⚠️ Widget &lt${tagName}&gt not found → using HTML placeholder`);
      WidgetClass = HTML; // Fallback class
      usePlaceholder = true;
    }
  }

  // 2. Not a widget? Just recurse children and exit
  if (!WidgetClass) {
    for (const child of Array.from(el.children)) {
      await buildWidgetTree(child);
    }
    return null;
  }

  // 3. Hydrate state (Extracted logic)
  const state = hydrateAttributes(el);
  
  // use description as id when description is defined, and id is not
  try{
      state.id = state.id ?? state.key ?? state.description;
  }catch(err){
      console.error(err.message);
      console.error(JSON.stringify(state));
  }
     
  // 4. Process Children
  const childModels = [];
  let rawHTML = "";

  for (const childEl of Array.from(el.children)) {
    const childModel = await buildWidgetTree(childEl);
    if (childModel) childModels.push(childModel);
    else rawHTML += childEl.outerHTML;
  }

  if (childModels.length > 0) state.children = childModels;
  else if (rawHTML) state.value = rawHTML;

  // 5. Handle Placeholder Specifics
  if (usePlaceholder) {
    state.value = `
      <div style="border: 2px dashed #f66; padding: 8px; border-radius: 4px; background: #fff3f3; font-family: monospace; font-size: 13px;">
        <strong>⚠️ ${tagName}</strong> not implemented yet — 
        <code>new ${tagName.replace("anyui-", "")}(${JSON.stringify(state)})</code>
      </div>`;
  }

  console.log(`✅ Created ${usePlaceholder ? 'Placeholder' : WidgetClass.name} for &lt${tagName}&gt`);
  return new WidgetClass(state);
}

// --- Helper Functions ---

function hydrateAttributes(el) {
  const state = {};
  const toCamel = (s) => s.replace(/([-_][a-z])/g, g => g.toUpperCase().replace(/[-_]/, ''));

  for (const attr of el.attributes) {
    let name = attr.name.replace(/-/g, "_");
    let value = attr.value;

    if (value.startsWith('[') || value.startsWith('{')) {
      try {
        value = JSON.parse(value);
        if (typeof value === 'object' && !Array.isArray(value)) {
          const camelStyles = {};
          for (const [k, v] of Object.entries(value)) camelStyles[toCamel(k)] = v;
          value = camelStyles;
        }
      } catch (e) { console.error("JSON parse failed", e.message); }
    } 
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (!isNaN(value) && value.trim() !== "") value = parseFloat(value);
    else if (name === "titles") value = value.split(",").map(s => s.trim());

    state[name] = value;
  }
  return state;
}


export async function upgradeAllWidgets() {
  console.log("🔧 Starting DFS hydration...");

  async function walk(node) {
    // 1. If it's a widget, hydrate it and STOP recursion for this branch
    // (buildWidgetTree already handles its own children internally)
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase().startsWith("anyui-")) {
      const tagName = node.tagName.toLowerCase();
      const model = await buildWidgetTree(node);

      if (model) {
        const container = document.createElement("div");
        container.className = "anyui-container";
        container.style.display = "inline-block"; // Optional: keep flow natural

        // Swap the tag for the live widget
        node.parentNode.replaceChild(container, node);
        await model.create_view({el:container});
        
        console.log(`✅ Hydrated: &lt${tagName}&gt`);
        return; // Important: Stop walking this branch, model handled the rest
      }
    }

    // 2. If it's regular HTML, keep walking deeper to find nested widgets
    const children = Array.from(node.childNodes);
    for (const child of children) {
      await walk(child);
    }
  }

  // Start the walk from the body
  await walk(document.body);
  console.log("✨ Hydration complete.");
}


// Auto-run
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", upgradeAllWidgets);
} else {
  upgradeAllWidgets();
}