# Ink Atlas

iPad-first 3D tattoo placement studio. The owner is Jake. He plans tattoos on a 3D body: imports art of existing and planned pieces, places them, compares options, and sends references to his artist.

## History, briefly

1. Jake built v1 through v47 in a ChatGPT thread. It is feature-rich but he found it confusing to use. Live at https://ink-atlas-ipad.jakehalbakken.chatgpt.site. Its full written spec is `docs/v47-spec.md`.
2. Claude rebuilt the core from scratch as a single-page prototype (this repo). Jake's verdict after trying both on his iPad: the rebuild is "a million times better". He wants it to reach full feature parity with v47 and then go past it.
3. The prototype was hosted as a Claude artifact, which blocks the native share sheet, file downloads, network fetches and model loading. This repo exists to get it out of that sandbox.

## How Jake works

- Direct. Wants things done, not proposed. Give opinions, not hedged option lists.
- Tests on a real iPad with touch and Apple Pencil. Nothing counts as working until it works there.
- Builds take hours or a few sessions, not days. Estimate accordingly.
- No em-dashes in anything you write for him.

## What exists today

One bundle: `src/app.js` + `src/index.html`, built by esbuild into `dist/index.html` (three.js inlined, body data embedded).

- Canvas-first layout: full-screen body, floating top bar, bottom tray of tattoo thumbnails, editing sheet that appears only when a tattoo is selected.
- Gesture grammar that never changes by mode: a touch that starts on the selected tattoo moves it; two fingers on it scale and rotate; a touch anywhere else orbits; two fingers elsewhere pinch-zoom and pan. Pencil hover does nothing. Keep this rule. It is the main reason Jake prefers this version.
- Tap a tattoo or its tray chip: select and glide the camera to it. Double-tap empty space or Full body: back to overview.
- Ink rendering: decals with multiply blending over a white-backed texture, so ink darkens the lit skin and white paper drops out for free.
- Body: MakeHuman CC0 base mesh (13,524 verts including eyes) with male / neutral / female and muscle / weight morphs. Height is normalised to 1.75 units; a height setting drives real-world size readouts.
- Tattoos stay attached through shape changes by anchoring to triangle + barycentric coordinates (`anchorsNow` / `applyAnchors`).
- Edit controls: name, size, turn, ink strength, mirror, duplicate, lock, planned vs already-on-me, hide, remove, undo/redo.
- Share: picture of this view, artist sheet (PNG), blank body to sketch on, project backup (JSON).
- Opens v47 `.ink.json` backups with exact placements (`importInkJson`). v47 anchors are in its "Original" mesh space, which is this repo's `legacy` shape scaled to 1.8 tall, so the mapping is exact.
- Saves to IndexedDB (`ink-atlas-proto` / `kv` / `project`).

## First tasks, in order

1. `npm install`, `npm run build`, open `dist/index.html`, confirm it runs.
2. Remove the artifact-only pieces: the `window.claude.use('downloads')` path in `src/app.js`. Replace with `navigator.share({files})` when `navigator.canShare` accepts the file, falling back to a download link. This is the single biggest win of leaving the sandbox.
3. Set up a real build (Vite is fine), split `app.js` into modules, and stop inlining three.js and the body data. Add a PWA manifest so it can be added to the iPad home screen.
4. Deploy to a static host and give Jake the URL. He should confirm on the iPad that nothing regressed before the big pass starts. Ask him which host he wants; do not create accounts for him.

## The pass Jake asked for

Two fixes he reported from the iPad:

- **Body sliders shift the whole screen while dragging.** Most likely the page itself pans under the finger. Lock `html`/`body` (position fixed, overscroll none), set `touch-action: none` on range inputs, and `overscroll-behavior: contain` on the scrolling popover. Verify on the iPad.
- **The body looks weird and "needs to be more anatomically correct."** Claude's reading: he wants a more realistic human, not a smooth mannequin. Confirm with him whether that includes anatomical detail the prototype deliberately left out. Likely work: replace the single muscle slider with MakeHuman's proper muscle x weight target grid (the nine `universal-*-young-{min,average,max}muscle-{min,average,max}weight` targets, bilinear weights, 0.5 = average), add the v47 body-fit sliders (shoulders, chest, waist, hips, depth, abs, back: formulas in the spec), better skin shading, visible landmarks such as navel and nipples that matter for placement, and eyes that are not skin-coloured.

Then all eleven parity items, which he wants in one pass:

1. **Photo cleanup.** Crop, erase/restore brush, background removal, contrast, non-destructive (keep source + mask + crop). Automatic cutout with MediaPipe interactive segmenter (v47 bundles `magic-touch.tflite`; algorithm in the spec under CUTOUTS). Outside the sandbox the model can be loaded.
2. **Wrapping around limbs.** Wrap, bend and taper controls. Replace `DecalGeometry` with a custom projector: flood-fill outward from the anchor triangle over mesh adjacency so ink never jumps from arm to torso, warp U toward a cylinder for wrap, clip to the UV square. The spec describes v47's warped decal and connected skin walk.
3. **Poses.** `data-src/rig/` holds the CC0 MakeHuman default skeleton and weights. Do real skinning rather than v47's shader approximations. Because decal vertices can be stored as triangle + barycentric supports, ink follows any pose for free and placement can work in any pose, which v47 could not do. Target roughly 30 stills and a set of motion loops with play, speed and scrub (lists in the spec).
4. **Alternatives and checkpoints.** Named layouts that share existing ink, wipe and side-by-side compare, 2/3/4-inch size studies, saved versions.
5. **Multiple projects.** A shelf, new, rename, duplicate, archive, restore as a copy.
6. **Notes, drawing and measuring on the body**, plus the Procreate round trip: export a square guide of a body patch, draw over it, bring the transparent PNG back onto the same patch.
7. **Layers.** Reorder, solo, groups, group transforms, linked artwork shared across placements.
8. **Finer body fit.** The sliders above plus photo-guided fitting from landmarks.
9. **Fuller artist sheet.** Front, back, left, right and detail views, size table, notes, printable.
10. **Account saves across devices.** Needs a real backend choice. Ask Jake before picking one.
11. **Small placement controls.** 1/2/3/4-inch buttons, exact width entry, nudge.

Advice from the v47 thread worth taking: one surface adapter for hit testing, decals, pose deformation and guide export; keep fixtures for v47 backups and curved-arm ink; test the first complete workflow on the iPad before widening scope.

## Things that are easy to get wrong

- Every UI addition must keep the canvas dominant. v47 failed on clutter, not on missing features. New features go into sheets and panels that appear when needed.
- Plain words on the surface. Jake could not find "Focus ink" or work out "Current View" in v47.
- 44pt minimum touch targets. Test portrait and landscape.
- Jake's real project and backup must always open with nothing lost. Never ship a storage change without a migration.
- Custom likeness (his face on the avatar) was shelved by Jake. Do not bring it back unless he asks.

## Commands

- `npm run build`: bundle to `dist/index.html`.
- `npm run mesh`: regenerate `src/body.js` from `data-src/` (base mesh plus shape targets).
- `npm run shot`: headless screenshot. `tools/tests/*.mjs` are small scripted checks; run as `node tools/shot.mjs <url> <out.png> <test.mjs>`. Set `CHROME` if Chrome is not in the default macOS location. Headless WebGL needs the swiftshader flags already in `tools/shot.mjs`.

## Licences

Body mesh, shape targets, skeleton and weights are MakeHuman assets released CC0. three.js is MIT.
