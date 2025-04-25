import { setupStyles } from './style.js';
import { setupDrawing } from './draw.js';
import { setupControls } from './ctrl.js';

function initApp() {
    const body = typeof element !== 'undefined' ? element : document.body;
    body.innerHTML = '<div class="container"><div class="controls"></div><div class="canvas-container"></div></div>';
    setupStyles();
    setupDrawing();
    setupControls();
}

// If running in Jupyter (element exists), initialize immediately
if (typeof element !== 'undefined') {
    initApp();
} else {
    // If running in a standalone HTML file, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initApp);
}