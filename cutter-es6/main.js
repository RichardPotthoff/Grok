/**
 * Entry point: instantiate the CutterApp.
 * All DOM creation and initialization happens here.
 */

import { CutterApp } from "./es6/app.js";

const container = document.getElementById("app");
const app = new CutterApp(container);

// Register service worker for offline support
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
