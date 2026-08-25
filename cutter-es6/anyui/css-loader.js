export function loadCSS(relpath) {
    return new Promise((resolve, reject) => {
        const href = new URL(relpath, import.meta.url).href;
        if (document.querySelector(`link[href="${href}"]`)) return resolve();

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.onload = resolve;
        link.onerror = () => reject(new Error(`Could not load CSS at ${href}`));
        document.head.appendChild(link);
    });
}

