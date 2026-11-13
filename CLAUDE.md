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

A Vite app. `src/index.html` is the entry, `src/app.js` the main module (scene, gestures, UI, persistence), with `mesh.js` (shape math), `fit.js` (the list of body sliders), `skin.js` (skin material and anatomy detail), `pose.js` (rig and dual-quaternion skinning), `clothes.js`, `aging.js`, `procreate-edit.js`, `slider.js` (the touch slider), `share.js`, `swatches.js` (Procreate palette), `procreate-draw.js` (guide for drawing a new tattoo on a painted area), `skin-tone.js` (your own skin tone), `lighting.js` (Preview light) and `sample-art.js` beside it. `src/body.js` is generated. Builds to `dist/` with three.js and the body data as separate cached chunks, plus a PWA manifest and service worker. Live at https://jakehalbakken.github.io/ink-atlas/ (GitHub Pages, repo `jakehalbakken/ink-atlas`, deploys on push to `main`; Vite `base` is `/ink-atlas/`).

- Canvas-first layout: full-screen body, floating top bar, bottom tray of tattoo thumbnails, editing sheet that appears only when a tattoo is selected.
- Gesture grammar that never changes by mode: a touch that starts on the selected tattoo moves it; two fingers on it scale and rotate; a touch anywhere else orbits; two fingers elsewhere pinch-zoom and pan (turning the view needs a clear twist, so a two-finger drag is a clean pan). Pencil hover does nothing. Keep this rule. It is the main reason Jake prefers this version.
- Tap a tattoo: select it and keep the view (Jake hates the view jumping); only slide the picture if the edit panel would cover it. A tray chip goes to its tattoo only when it is out of sight; tapping the selected chip again zooms to it. Double-tap empty space or Full body: back to overview.
- Before/after, Pose, Clothes, Aging and Light (Studio, Daylight, Warm room, Midday sun; kept per device in localStorage `ia-light`, never in the project) sit behind one Preview button. Body > Skin tone has a + swatch for your own tone (lighter/deeper and cooler/warmer sliders, or Match a photo of your skin); it is stored in the existing `state.skinHex`, so no storage change. Panels fade while a finger moves the body. Wide landscape puts the tray and edit panel in a right-hand column.
- Ink rendering: decals with multiply blending over a white-backed texture, so ink darkens the lit skin and white paper drops out for free. The decal geometry is a connected-surface walk from the anchor triangle (`src/decal.js`), not three.js DecalGeometry, so ink wraps a limb but never jumps to a disconnected surface. Wrap / bend / taper live under "Wrap around the body" in the edit sheet.
- Body: MakeHuman CC0 base mesh. Vertex order is body (13,380), eyes (144), then the genital geometry (MakeHuman's helper, subdivided at bake time); body and eye indices must never change because saved anchors use them. Male / neutral / female, MakeHuman's muscle x weight grid (0..1, 0.5 = average), and about 30 fine-tune sliders in `state.fit` (-1..1, 0 = standard) driven by real MakeHuman targets: torso, chest and breasts, arms, legs, neck, genitals. Height is normalised to 1.75 units; a height setting drives real-world size readouts.
- Anatomy detail is painted in the skin shader from landmark vertices, so it follows every shape: eyes, lips, areolae and nipples, navel, crease shading. Genital geometry shows for the male body and has a show/hide toggle.
- Sliders are the custom `<ink-slider>` element, not `<input type=range>`: it takes horizontal drags and leaves vertical ones to the panel, and the page itself is locked (fixed body plus a touchmove guard). This is the fix for "sliders shift the whole screen".
- Tattoos stay attached through shape changes by anchoring to triangle + barycentric coordinates (`anchorsNow` / `applyAnchors`).
- On-canvas handles on the selected tattoo: corner resizes, the dot above turns.
- Edit controls: name, size, turn, ink strength, mirror, duplicate, copy to other side (mirrored, linked artwork), real size on screen (pixels per inch guessed per device, bank-card check kept in localStorage `ia-screen-ppi`), lock, planned vs already-on-me, hide, remove, undo/redo.
- Draw in Procreate (tray): paint an area of the body with a finger or the Pencil (one finger off the body still turns, two fingers still move the view), get a square guide of that skin for Procreate, and Copy All > Paste brings the drawing back as a new planned tattoo on the same spot, trimmed to what was drawn. The pending guide lives in localStorage `ia-procreate-edit` with `kind: 'new'`, outside the project.
- Share: picture of this view, artist sheet (PNG), blank body to sketch on, project backup (JSON).
- Opens v47 `.ink.json` backups with exact placements (`importInkJson`). v47 anchors are in its "Original" mesh space, which is this repo's `legacy` shape scaled to 1.8 tall, so the mapping is exact.
- Saves to IndexedDB (`ink-atlas-proto` / `kv`) through `store.js`: `project` holds the state and a list of artwork keys, each artwork is its own `img:<key>` record, `recovery` plus `rec:<id>` hold up to 8 earlier saves, and an unreadable save is moved to `quarantine:<time>` instead of being overwritten. Every load, backup and recovery copy goes through `cleanState` in `project.js` and `openProject` in `app.js` before it may replace the project. Saves report failure honestly and flush when the app leaves the screen. State is `v: 2`. Older saves are upgraded on open by `adoptState`: it rebuilds the exact shape the save was made on, pins each tattoo to its triangle, then switches to the current shape, so no ink moves. Any future shape or storage change must do the same.
- Share uses `navigator.share({files})` when the device accepts the file and a plain download otherwise (`share.js`).

## First tasks, in order

Status: all four done and confirmed by Jake on the iPad (2026-11-10). Kept here for the record.

1. `npm install`, `npm run build`, open `dist/index.html`, confirm it runs.
2. Remove the artifact-only pieces: the `window.claude.use('downloads')` path in `src/app.js`. Replace with `navigator.share({files})` when `navigator.canShare` accepts the file, falling back to a download link. This is the single biggest win of leaving the sandbox.
3. Set up a real build (Vite is fine), split `app.js` into modules, and stop inlining three.js and the body data. Add a PWA manifest so it can be added to the iPad home screen.
4. Deploy to a static host and give Jake the URL. He should confirm on the iPad that nothing regressed before the big pass starts. Ask him which host he wants; do not create accounts for him.

## The pass Jake asked for

Status (2026-11-11): both fixes below are built and pass the headless checks, including Jake's answer on scope: he wants everything, every part of the body, and every part adjustable. They still need his check on the real iPad before the parity items start. Known rough edges to raise with him: the genital geometry is MakeHuman's helper mesh smoothed once (no finer detail), very large breast sizes show polygon edges underneath, there is no hair or eyebrows, and female anatomy is only what the MakeHuman base mesh models.

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

- Deploying, pushing, or publishing anything needs Jake's explicit OK each time. The repo and site are public. Private strategy and business notes go in `docs/private/`, which is git-ignored. Never touch the original app at the chatgpt.site address.
- `docs/parity-audit-and-plan.md` is the honest status of every feature (built, tested, missing, checked on iPad) and the staged checklist. Update it when a stage lands. The v47 spec is intent, not proof.

- Every UI addition must keep the canvas dominant. v47 failed on clutter, not on missing features. New features go into sheets and panels that appear when needed.
- Plain words on the surface. Jake could not find "Focus ink" or work out "Current View" in v47.
- 44pt minimum touch targets. Test portrait and landscape.
- Jake's real project and backup must always open with nothing lost. Never ship a storage change without a migration.
- Custom likeness (his face on the avatar) was shelved by Jake. Do not bring it back unless he asks.

## Commands

- `npm run dev`: dev server. `npm run build`: production site to `dist/`. `npm run preview`: serve the build. The app is ES modules now, so `dist/index.html` cannot be opened straight from disk.
- `npm run uv`: regenerate `src/body-uv.js` (MakeHuman UVs in body triangle order, for the painted 3D model export). Rerun after `npm run mesh` if the triangle order ever changes.
- `npm run mesh`: regenerate `src/body.js` from `data-src/` (base mesh, rig weights, and the shape targets in `data-src/` and `data-src/mh-targets/`).
- `npm run shot`: headless screenshot of the build. `tools/tests/*.mjs` are scripted checks; run as `node tools/shot.mjs <out.png> <test.mjs>` after a build (it serves `dist/` itself). t1 gestures and export, t2 shape change with ink, t3 v47 import, t4 body visuals (`shots/b_*.png`), t5 old-save upgrade plus slider touch, t6 durable projects (reopen, old storage format, damaged files, earlier saves, failing disk, touch target sizes), t7 curved placement stays connected, t7b wrap visual, t36 before/after, t37 tap to cut out (real model), t38 painted 3D model, t39 poses (posed editing, motion), t40 print at real size, t41 spin video, t42 clothes, t43 Apple Pencil taps on buttons, t44 back from Procreate (painted model in, new tattoos out), t45 layered PSD, t46 aging, t47 edit in Procreate and bring it back, t48 tap keeps the view, clean two-finger pan, fading panels, Preview menu, t49 on-canvas resize and turn handles, t50 Procreate colour palette (`swatches-unit.mjs` for its maths), t51 copy to other side and real size on screen, t52 draw a new tattoo in Procreate on a painted area, t53 your own skin tone (`skin-tone-unit.mjs` for its maths), t54 light in Preview; `pose-deform-unit.mjs` checks elbows and knees keep their volume, the biceps flexes and fists close. Run the whole suite before deploying. Set `CHROME` if Chrome is not in the default macOS location. Headless WebGL needs the swiftshader flags already in `tools/shot.mjs`.
- Deploy: push to `main`. Jake's own GitHub account is `jakehalbakken`; `gh` on this machine usually has a different account active, so switch for the push and switch back.

## Licences

Body mesh, shape targets, skeleton and weights are MakeHuman assets released CC0. three.js is MIT.
