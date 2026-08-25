/** Load a stylesheet. `href` must already be absolute (caller uses `new URL(..., import.meta.url).href`). */
export function loadCSS(href) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`link[href="${href}"]`)) return resolve();

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.onload = resolve;
        link.onerror = () => reject(new Error(`Could not load CSS at ${href}`));
        document.head.appendChild(link);
    });
}
