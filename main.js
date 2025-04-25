import { setupStyles } from './style.js';
import { toRad, toDeg, normAng } from './util.js';
import { setupDrawing } from './draw.js';
import { setupControls } from './ctrl.js';
console.log("in main");
document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    body.innerHTML = '<div class="container"><div class="controls"></div><div class="canvas-container"></div></div>';
	console.log("DomContentLoaded")
    setupStyles();
    setupDrawing();
    setupControls();
});