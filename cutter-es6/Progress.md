# Cookie cutter designer — progress

Handoff for the next chat. Last updated 2026-09-15 (drawing app + turtle-drawn tool icons).

**Goal:** a turtle-path editor + WebGL blade preview. Only geometric primitive is the circular arc. Paths are `turtlePath = [[length, angleDegrees], …]` plus `startPoint`, `startAngle`, `name`.

**Source of truth:** this folder (`cutter-es6/`), also `RichardPotthoff/Grok` on `main`. Test in modular `standalone.html`. IIFE `index*.html` is stale until regenerated.

## What we achieved

### Close

- `es6/close-path.js`: G1 close as a **menu**, not one button.
- Default **Ends**: rewrite first + last arcs; middle `(s, Δθ)` unchanged. Same geometry as a wrap-around biarc.
- Also: **Tail** (last two), **Cap** (append two), **Spread** (`snapTurtle`), **Corner** (G0 last arc).

### Biarc math

- `es6/biarc.js` from `myrepo/BiArc.ipynb` (`compute_biarc`, `arc_from_chord`).
- Family parameter `p` (Kurnosenko) or through-point `P`. Default new pairs: `p = 1`. Vertex keeps each pair’s `p` while the shared pose moves.
- Tools are on-the-fly only. Commit is still `[s, Δθ]` + start pose. No extra path fields.
- Wrap-around (last + first) rewrites `startPoint` / `startAngle`.
- `p ≈ 0` and `p ≈ -1` are poles; editor nudges off them.
- `P` in the notebook **is** a point on one of the two arcs. **Thru is still deferred.**

### Editor chrome

Sidebar **beside** the canvas (not an overlay):

| View | Edit | Act | Header |
| --- | --- | --- | --- |
| Pan, Fit | Select, Add, Arc, p, Locus, Move, Tan | Close, Split, Ins, Del, Undo | Shape, Scale, Export, Kit |

- **Select** picks only. Empty drag pans after slop.
- **Add** is the only tool that shows the hollow `+` / appends.
- **Arc / Locus / Move / Tan** edit after ~10 px slop, with grab offset so the handle sits beside the finger.
- iOS: `user-select` / callout off, `maximum-scale=1`, canvas `touchstart` / `gesturestart` `preventDefault`.
- Highlight: Arc = 1 segment, p / Locus = 2, Move / Tan = 4.
- Split halves the selected arc (`s/2`, `Δθ/2`).
- `setTool("vertex")` still aliases to **Move**.

### Move + Tan

- **Move** (`P`, keep `θ`) and **Tan** (heading, keep `P`) call the same `applyVertex`.
- **JOINT_LOCK** (`p`, `locus`, `move`, `tan`): a stroke tap does **not** change `joint`.
- Keep each pair’s `p` for the whole drag. `applyVertexStable` used to retry `p = 1` when keep-p looked collapsed; the two geometries fought and the junction flickered, then the log showed `pR 1.00`. Fallback is gone: a bad frame is rejected, `p` stays what `recoverP` captured at pointer-down.
- Log text is selectable/copyable; the panel autoscrolls; stored rows cap at 80.

### Seam collapse (fixed)

`applyVertex` used to write `startPoint = P` whenever arc 0 sat in the four-arc quad. That pinned the path start onto the moving joint and the drawing collapsed. Start is rewritten only when the joint **is** the seam (`j === 0` or `j === n`).

### Span overlay

Move / Tan / Locus / numeric p lift the 2 or 4 arcs into a linear snippet (`extractSpan`), edit that, paint it over the frozen base, then `commitSpan`. Wrap-around is in-order on the snippet. Same overlay is the place a later Möbius should run.

### p is not a perfect invariant

When the pair already lies on one circle the locus degenerates (`r → ∞`). Worse: `sqrt(T1 conj(T0))` has two branches. One is the short 90°+90° pair, the other 270°+270°. The old solver took the long root; the collapse guard then rejected it, so Tan/Move on a 4-arc Plain circle looked frozen (no JS exception). `computeBiarc` now tries both branches and keeps the one closer to the previous `(s, Δθ)`, else the shorter total turn. `applyVertex` passes the current pair as that hint.

### Log + undo

Each committed edit is a snapshot. Footer is **arc table | log**. The last line is **live** during a drag and lists which `#i s / Δθ` rows changed; on pointer-up that line becomes the commit. `console.error` / `window.onerror` / unhandled rejections also land in the log (`err`). Undo restores the previous snapshot. Header Undo and `⌘Z` / `Ctrl+Z`. Log panel: selectable/copyable text, autoscroll to last line, cap 80 rows.

### Shared tools (cutter + drawing app)

Same editor tools for both products. Do not fork `es6/biarc.js`, `close-path.js`, `path-utils.js`, `turtle-graphics.js`, or the CurveEditor core. Cutter keeps WebGL + cookie outlines. Drawing app does not take those.

## Two products, same tools

| App | Entry | Second pane | Document |
| --- | --- | --- | --- |
| Cookie cutter | `standalone.html` | WebGL blade | one outline (one start pose + one `turtlePath`) |
| Drawing | new `drawing.html` (separate conversation) | Gallery of drawings | several strokes on a page |

A **stroke** is still `{ startPoint, startAngle, turtlePath }` with `[s, Δθ]` arcs. Extra start/end points are extra poses. Color and width hang on the stroke, not on the arc. Commit remains `[s, Δθ]` plus start pose; biarc/dual-biarc stay on-the-fly.

```js
{
  name: "Move icon",
  paths: [
    { startPoint, startAngle, turtlePath, stroke: "ink", width: 1.5 },
    { startPoint, startAngle, turtlePath, stroke: "accent", fill: "accent" }
  ]
}
```

One path in the list is the active stroke. Select / Move / Tan / Close already work on that object. New work is: pick which stroke, add a stroke, gallery of documents. Overlay snippet stays stroke-local. Later a Möbius tool can run on a span without touching the rest of the page.

**Icons:** design them as drawings in this app, show them in the gallery, then render the same SVG into cutter’s toolbar. No bitmap source of truth.

## Open interaction issues

1. ~~Vert combines move and tangent.~~ Split into Move + Tan.
2. ~~Stroke tap steals the joint.~~ JOINT_LOCK.
3. ~~Seam collapse when arc 0 is in the quad.~~ Overlay + seam guard.
4. ~~Keep-p vs p=1 flicker on Move/Tan.~~ Fallback removed; p frozen for the drag.
5. Same-circle locus `r → ∞` / raw `p` as a perfect invariant is still weaker; sign-stable `recoverP` is in, not fully proven.
6. **Thru** not in the rail.
7. Single-arc **Len vs Turn** still not built.
8. Insert still plants `[4, 0]`.
9. IIFE not regenerated (leave until drawing/icons settle).

## Drawing app + icons (this pass)

- Document: `{ name, paths: [ stroke, … ] }` in `es6/drawing-doc.js`. A stroke is an outline plus `stroke` / `width` / `fill`. CurveEditor still edits one outline; other strokes are `setBackdrop`.
- Icons: `es6/tool-icons.js`. Catalog drawings → exact SVG `A` (full circles split). Dark toolbar uses `currentColor` for ink so the pressed button inverts.
- App: `drawing.html` (gallery + editor, no WebGL). Seeded with the tool icons, Duck, Blank. localStorage `arc-drawing-app-v1`. Copy SVG / Copy JSON (iPad-safe).
- Cutter sidebar buttons now render those SVGs; `title` is still the tool name. `standalone.html` links to Drawing.
- Shared math is not forked. SW bumped to `cutter-offline-v4-20260915` and precaches the new files.

Icons are a first cut — edit them in the drawing app (Reset icon restores the catalog). Select / Undo glyphs are the ones most worth a second pass.

## Stack tape (CLI next to the GUI)

`es6/turtle-cmd.js` — Forth-like stack. Numbers and path objects push; words pop and push.

Same generators as the Python sketch: `ah` is `AH(w,l)`, `loop` is `TL(arcs,n)`, `seg` is one `(s, Δθ°)`.

```
1 0 seg  0.25 -0.5 ah cat  0 180 seg cat  1 0 seg cat  0 90 seg cat  4 loop  emit
```

is `TL(((1,0), *AH(w=0.25,l=-0.5), (0,π), (1,0), (0,π/2)), 4)`.

Tape panel lives on `drawing.html`. Run / Pan example / Words / Copy tape. `emit` writes the top path into the active stroke. GUI drag-to-tape is not recorded yet; Flip / 90° in the rail are the same words as `mirror` / `rot`.

SW `cutter-offline-v6-20260915`.

### Tape ideas (do not code yet — try this version first)

**Model.** Whitespace (spaces and line feeds) only separates tokens. A number or string is a push. A word pops as many stack items as it needs and pushes the result. Same as HP RPN / Forth / Hysim. Newlines are not “enter” in the HP-21 sense; they are just another space. That is already how `turtle-cmd.js` tokenizes.

**Operator aliases** (proposed, not implemented):

| Mark | Same as | Stack |
| --- | --- | --- |
| `+` | `cat` | `( path path -- path )` |
| `*` | `loop` | `( path n -- path )` |
| `&` | `join` | `( path path -- path )` fit-arc stitch |

Then the pan example shrinks to:

```
1 0 seg  1 -2 ah +  0 180 seg +  1 0 seg +  0 90 seg +  4 *
```

(`ah` here using integer `w,l` — see scale below.) Keep the long names as aliases of the marks, not the other way around, so a tape stays readable when opened cold.

Watch-outs before wiring this:

- `+` and `*` must not steal numeric add/multiply. If both are needed later, use `add` / `mul` for numbers and keep `+` / `*` for paths (HP-21 had one type; we have two).
- `*` takes `n` on top, path under it — same order as `loop`. Easy to type `4 *` after building the spoke.
- Unary `-` on numbers already works (`-2`). Do not make `-` a path word.

**Integer icons + one scale.** Draw icon tapes with small integers for `s` and `Δθ` (1, 2, 4, 90, …), then a final scale word that multiplies every length and leaves angles alone:

```
1 0 seg  1 -2 ah +  0 180 seg +  1 0 seg +  0 90 seg +  4 *  8 scale
```

`scale` is `( path k -- path )`. Angles stay exact 90/180; only `s` changes. Width can scale or not — decide when implementing (stroke width in screen units vs geometry). A drawing’s tape then *is* the compact source of truth; JSON `[s, Δθ]` remains the editor commit form.

**Tape as store.** A drawing could carry `tape: "…"` next to `paths[]`. Run the tape to rebuild; keep the expanded path so the editor does not have to re-eval on every frame. If the GUI later journals Flip / 90°, it appends `90 mirror` / `90 rot` to that string. Live biarc drags still have no small word — those stay snapshot edits unless we invent one.

**Not in this pass.** No parser changes until the current long-name tape has been used on the iPad.

### What already exists (survey, 2026-09-18)

Checked `turtle-cmd.js`, `drawing-doc.js`, `curve-editor.js`, `biarc.js`, `close-path.js`. Nothing below is implemented on the tape yet.

| Idea | In the repo today |
| --- | --- |
| Types on the stack | Two live types: JS `number` (float) and a **path** (`turtlePath` + start pose). Strings exist only as paint roles (`"ink"`). Bare arrays of segs are accepted by `asPath` then immediately wrapped as a path. |
| Type errors | `popNum` → `expected number`; `asPath` → `not a path`; missing word → `unknown word`. One definition per word. No try-all-overloads. |
| `+` `*` | Not defined. Tokenizer treats `+` `*` `.` as *words*, and already refuses to parse `+` as a number. `add` is **not** numeric add — it appends one `[s, θ]` to a path. |
| User definitions (`: pan ... ;`) | None. `WORDS` is a closed object. No dictionary, no `variable`, no `!` / `@`. |
| Named values | Stroke-level only: `id` (`p1`, `p2`, … auto) and optional `name`. Document has `id` / `name`. Arcs are anonymous rows; the table labels them `#1`, `#2`. Vertices are not stored. |
| Aliases | Editor only: `setTool("vertex")` → Move. No tape aliases, no `arc1` handle. |
| Complex / vector | **Inside** `biarc.js` only: `{x,y}` with `mul` `div` `conj` `arg`. Not a stack item. Walked heading is `[cos, sin]`. Start pose is `startPoint` + `startAngle` (degrees). |
| Vertex / two-pose biarc | `jointPose` / `walkExact` already produce `(point, heading)`. `computeBiarc(P0, T0, P1, T1, {p})` is exactly “two vertices + optional p”. Result is still committed as two `[s, Δθ]` rows — no extra path fields. |

### Forth extensions (ideas only)

**Type-aware words.** Four stack types is a good ceiling for now:

1. **float** — what numbers already are  
2. **complex** — point or heading vector (`x+iy`); same object, role by context  
3. **list** — quoted sequence of stack items / segs (Forth `[ ... ]`)  
4. **arc** / **path** — one `[s, Δθ]` or a chain of them (today these are collapsed into one path type)

**vertex** = `( P, T )` two complexes: position and unit heading. Two vertices + optional float `p` → one biarc word. That word should call existing `computeBiarc` and push a 2-arc path. Do not store `p` on the committed path.

**Dispatch.** “Try every `*` until one does not throw” works while there are 2–4 clauses and errors are cheap. Better long-term: tag items (`kind: "path"|"num"|"cplx"|"vtx"|"list"`) and pick the clause by `(kind × kind)`. Same visible behaviour, cheaper, and the error can say `* : no clause for path float` instead of the last clause’s `expected number`.

Suggested `*` clauses if we go there: `float*float → float`, `cplx*cplx → cplx` (complex product = 2-D rotate-scale), `path*float → loop` when the float is a whole count, `path*float → scale` when it is not? That last split is the sharp edge — **loop vs scale should stay different words** (`*` vs `scale`) so `4 *` never silently scales.

**Names.** A Forth dictionary beside the stack: `42 arc1 !` / `arc1 @`. Default aliases when a path is emitted into the editor: `arc1`…`arcN` for segments, `v0`…`vN` for vertices (v0 = start pose). Aliases are bindings, not extra geometry. The streamable model stays `[s, Δθ]` + start pose; names live in the dictionary / UI.

**Definitions.** Classic `: pan  1 0 seg  1 -2 ah +  4 * ;` once we have `+` `*` and a dictionary. Until then the tape *is* the definition.

Still no code for this until the current tape has been used on the iPad.

### Service worker

Safari was serving `cutter-offline-v1` cache-first, and HTTP-caching `sw.js`, so a normal refresh never saw new modules. Private mode has no SW, which is why it looked “fine”. `sw.js` is now `cutter-offline-v3-20260914`, HTML/JS are network-first, register uses `updateViaCache: "none"`. Header **Update app** appears when a new worker is waiting; click → `skipWaiting` → reload. After this deploy, open the Pages URL once, tap Update app if the button shows.

### Packaging (leave alone)

HTML apps, IIFE script, Carnets + Pages `_esm`, `cutter_widgets/`, Spin after drag — still as of 2026-08-26. Local `/files/` is a dead end. Do not merge `anyui/` into `es6/`.

## Open interaction issues

1. ~~Vert combines move and tangent.~~ Split into Move + Tan.
2. ~~Stroke tap steals the joint.~~ JOINT_LOCK.
3. ~~Seam collapse when arc 0 is in the quad.~~ Overlay + seam guard.
4. Same-circle **sqrt branch** is fixed; locus `r → ∞` / raw `p` as an invariant is still a weaker open question.
5. **Thru** not in the rail.
6. Single-arc **Len vs Turn** still not built.
7. Insert still plants `[4, 0]`.
8. IIFE not regenerated.

## Next conversation — pick one

1. Live with the tape as it is (long names). Then, if it feels right: `+`/`*` aliases, integer icon tapes, `scale`, optional `tape` field on a drawing.
2. Redraw weak icons in `drawing.html` (Select, Undo) and keep the catalog in `tool-icons.js` in sync — or treat the gallery JSON / tape as source and codegen the catalog.
3. **Thru bead** on the two-arc span.
4. **Arc Len / Turn**.
5. Only then IIFE / anyui / Marimo.

Keep `standalone.html` as the cutter reference and `drawing.html` as the drawing reference.

## Layout (do not merge)

| Folder | Owns |
| --- | --- |
| `anyui/` | Copied general UI widgets |
| `es6/` | Turtle math, `CurveEditor`, `WebGLCutter`, widgets |
| `cutter_widgets/` | Python twins; `_esm` → Pages |

Math files: `es6/close-path.js`, `es6/biarc.js`, `es6/path-utils.js`. UI: `es6/curve-editor.js`.

Design notes in `artifacts/00-Overview.md` … `06-Open-Questions.md` (esp. `03-Interaction-Ideas.md`).
