/**
 * Pack the cutter-es6 folder into a zip in the browser (STORE, no compression).
 * Works from standalone.html on GitHub Pages and in the Grok preview.
 */

export const KIT_FILES = [
  "standalone.html",
  "index.html",
  "README.md",
  "Progress.md",
  "es6_html_to_iife_html.py",
  "sw.js",
  "manifest.json",
  "icon-180.png",
  "favicon.svg",
  "es6/README.md",
  "es6/turtle-graphics.js",
  "es6/geometry.js",
  "es6/m4.js",
  "es6/cookiecutters.js",
  "es6/path-utils.js",
  "es6/curve-editor.js",
  "es6/webgl-cutter.js",
  "es6/curve-editor-widget.js",
  "es6/webgl-cutter-widget.js",
  "es6/download-kit.js",
];

export async function downloadKit() {
  const files = [];
  for (const name of KIT_FILES) {
    const res = await fetch("./" + name);
    if (!res.ok) continue;
    files.push({ name: "cutter-es6/" + name, data: new Uint8Array(await res.arrayBuffer()) });
  }
  if (!files.length) throw new Error("Could not collect kit files");
  const zip = buildZip(files);
  const blob = new Blob([zip], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cutter-es6.zip";
  a.click();
  URL.revokeObjectURL(a.href);
}

function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = utf8(f.name);
    const crc = crc32(f.data);
    const local = concat(
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(f.data.length),
      u32(f.data.length),
      u16(name.length),
      u16(0),
      name,
      f.data,
    );
    locals.push(local);
    centrals.push(
      concat(
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(f.data.length),
        u32(f.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ),
    );
    offset += local.length;
  }
  const central = concat(...centrals);
  const end = concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0));
  return concat(...locals, central, end);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function utf8(s) {
  return new TextEncoder().encode(s);
}

function u16(n) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function concat(...parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
