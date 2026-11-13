# Ink Atlas rebuild: parity audit and staged plan

Written 2026-11-11 from the code in `src/`, the scripts in `tools/tests/`, `CLAUDE.md`, `docs/v47-spec.md` and the competitive strategy report (kept in `docs/private/`, which is git-ignored).

## Current checkpoint (November 12, local versus live)

**Deployment baseline:** cleanup-only release `d2cf602` was verified live before this parity release candidate. This document records implementation/test evidence, not a live deployment guarantee; use the latest successful GitHub Pages run and a fresh site check to establish what is currently live.

**Local built and automated-tested:** project shelf; layouts/checkpoints/saved-picture comparisons; layer/group transforms and linked revisions; notes/body pins/drawing; chord and mesh-edge ruler; static pose + three restrained motion previews; approximate coverage masks; manual photo-reference fitting to a copy; Procreate patch round trip; artist packet; static GLB export/read-only import; strict v47 compatibility export and source-preserving import; explicit alignment/symmetry; view-roll and tap-to-place.

**Still partial or absent against the original v47 specification:**
- Cleanup: resumable crop/restore pixels now supported, plus exact crop/trim/pan/zoom/backdrops; still no replayable filter layers, Pencil-only setting, automatic subject segmentation or multi-photo angle combination.
- Placement: explicit durable transform drafts now supported; direct drags/uploads are not yet universally draft-based and on-canvas transform handles remain absent. Actual-decal alpha/depth tap selection and overlap cycling now tested; drag-start ownership retains its generous rectangle. Live center/edge guides and optional snapping now tested.
- Artwork: basic artwork library with linked/independent placement now supported; no full reference-photo/artist-board manager. Historical layouts are intentionally not silently rewritten by linked cleanup.
- Body: manual reference fitting, not eight-landmark estimation; no portrait/likeness work (explicitly shelved). Approximate clothing/hair masks are not fitted garments.
- Pose: 24 bounded static previews and 12 motion studies, not the full original catalog or full posed editing/IK/anatomical simulation.
- Comparison: saved pictures plus local synchronized live 3D wipe for layouts matching the active neutral body/fit/skin; differing-body live comparison remains unsupported.
- Drawing/export: tangent-square patch, not arbitrary UV unwrap. Direct flat-patch drawing/erase now tested. Mesh-edge ruler can overestimate and is not a tape measurement.
- 3D: static GLB and local OBJ/MTL/PNG ZIP export with separate decals; no UV-baked skin, editable foreign-body replacement or OBJ import round trip.
- Compatibility: unsupported old metadata retained in untouched source archive, not all runtime-editable; original runtime round trip not tested.
- Accounts/private cross-device collaboration and AI-provider features remain deferred pending backend/provider decisions.
- Real iPad Chrome/Pencil/share-sheet/performance acceptance remains outstanding for the new work.

### Session note, 2026-11-12 (Claude, Opus, overnight continuation)

Jake authorized continuing the parity work and deploying overnight (directly, in the Claude session, after forwarded relays which on their own were not treated as authorization). Verified the inherited parity release first: build green (50 modules), all 16 node unit tests pass, and the full t1-t28 browser suite passes.

Found and fixed one **severe regression** in the live release: selecting a tattoo flew the camera to frame it at screen centre, but the parity edit sheet had grown to about 420px tall and covered that spot, so pointer events hit the sheet and the core "drag the selected tattoo" gesture did nothing. The automated t1 masked it because it dragged from hardcoded coordinates rather than the tattoo's real position. Fix: `focusTattoo` now frames the selected tattoo in the canvas area above the sheet (measuring the sheet's height); t1 drags from the projected position and fails loudly otherwise. Deployed to `main` (commit 037ab8e) and verified live (`index-96K-3mCE.js`).

**Flagged, not yet changed:** the edit sheet is tall (about 420px), so on a landscape iPad a selected tattoo works in only the upper part of the screen. It is functional now but presses on the "keep the canvas dominant" rule; worth tightening (collapse or shorten the sheet) in a follow-up.

**Honest status of the "build everything" ask:** most of the long parity list was already implemented and tested by the prior agent and is live. What genuinely remains is advanced or reserved, not quick wins: full pose catalog and posed editing (24 poses / 12 motions exist), synchronized live wipe compare (saved-picture compare exists), UV-baked OBJ/skin export (static GLB exists), automatic subject segmentation (manual cleanup exists), and anything needing a backend or AI provider (reserved for Jake). These are not claimed complete.

The original audit tables below are a **historical baseline**, not current feature status. Later checkpoints record implementation and test evidence. Do not read their old “Missing” labels as a current regression.

## Rules of evidence used here

- The v47 spec describes the older ChatGPT-built app. It is a checklist of intent, never proof that this rebuild does something.
- A competitor feature listed on its own website is a published claim. Nobody here has tested it.
- "Tested" below means an automated run in headless Chrome on a Mac, with simulated touch where noted. It does not mean it works on an iPad with fingers or Apple Pencil. That column is separate on purpose.
- A button existing is not a feature working. Only rows with a named test count as tested.

Ground rules carried from Jake's handoff: keep the canvas-first layout, the gesture grammar and 44pt targets; never lose his project, placements or older backups; the original app at `ink-atlas-ipad.jakehalbakken.chatgpt.site` is never touched; no deploys, public publishing, paid services, checkout, accounts, cloud upload or AI credentials without his explicit OK; no fake buttons for things that are not built; custom facial likeness stays shelved.

## Audit

Status words: **Built+tested** (code exists and an automated test exercises it), **Built** (code exists, no automated test), **Partial**, **Missing**. iPad column: **Jake** = covered by his general OK on the first deploy (2026-11-10: "It's all looking good", after being asked to check sharing, gestures and opening a backup; he did not report feature by feature), **No** = never checked on a real device.

### Core editing and placement

| Area | Status | Where in the code | Automated test | iPad | Gap |
|---|---|---|---|---|---|
| Add PNG / JPEG / WebP art | Built+tested | `addImage`, file handler in `app.js` | t3, t6 (art created in the page) | Jake (first deploy) | Downsizes to 1024 px (v47 kept 1600). No "unplaced" state: every piece is put on the body. 40 MB per picture cap. |
| Move, pinch size and turn, sliders | Built+tested for drag | pointer handlers, `slider()` | t1 mouse drag and orbit; pinch has no automated test | Jake (first deploy) | Two-finger gestures need a scripted touch test. |
| Mirror, duplicate, hide, remove, ink strength | Built | sheet buttons in `app.js` | Mirror in t6; others none | Jake (first deploy) | No vertical mirror. No grayscale. |
| Existing vs planned ink, lock | Built+tested on import | `t.status`, `t.locked` | t3, t6 | No | Existing ink is only move-locked. It can still be restyled or removed without a warning. |
| Curved-surface placement (wrap, bend, taper, no bleed from arm to torso) | Built+tested | `decal.js` walks connected triangles from the anchor, gated by the artwork rectangle and surface facing; `decalGeometry` in `app.js` calls it | t7 (connected reach stays local on arm and chest), t7b (wrap curves around the thigh, visual) | **No** | Wrap / bend / taper controls under "Wrap around the body" in the edit sheet; v47 values now read on import. Ink vertices are rebuilt from the anchor on every shape change, not yet stored as triangle + barycentric supports (that is Stage 3 for poses). Hit testing for selection is still a flat rectangle. |
| Tap to select overlapping ink | Partial | `tattooAt`, `insideTattoo` | t1 selects via the tray only | Jake (first deploy) | Rectangle hit test, top piece only, ignores transparent areas, no cycling. |
| Layers: reorder, solo, groups, group moves | **Missing** | Draw order is array order | None | No | Only hide exists. |
| Linked artwork and an art library | **Missing** | Duplicates share an image key but nothing links their edits | None | No | |
| Photo cleanup: crop, erase / restore, background removal, contrast | **Missing** | White paper drops out only because ink is multiplied onto skin | None | No | No editor, no kept source or mask. |
| Several photos of one tattoo, automatic cutout, combine angles | **Missing** | | None | No | Needs the MediaPipe model; ask before adding any download. |
| Undo and redo | Built+tested | `snapshot`, `restore` (40 steps) | t6 (25 undos, undo after going back) | No | No separate undo while editing a draft, because there is no draft mode. |

### Body

| Area | Status | Where | Automated test | iPad | Gap |
|---|---|---|---|---|---|
| Body types, muscle x weight grid, about 30 part sliders, height, 5 skin tones | Built+tested | `mesh.js`, `fit.js`, Body panel | t2, t4 (visual), t5 | **No** (built after his last check) | Skin is 5 swatches; v47 had a continuous slider (an imported v47 colour is kept). |
| Ink stays put through shape changes | Built+tested | `anchorsNow`, `applyAnchors` | t2, t5 (0 mm error) | No | |
| Anatomy detail: eyes, lips, nipples, navel, creases, genital geometry | Built, visually checked | `skin.js`, `tools/mesh.py` | t4 screenshots, judged by eye | No | No hair, eyebrows or clothing. Genital geometry is MakeHuman's helper smoothed once. |
| Sliders do not move the page | Built+tested (simulated touch) | `slider.js`, page lock in `index.html` | t5 | **No** | Safari is the real test. |
| Photo-guided body fitting | **Missing** | | None | No | v47 only estimated shoulder / waist / hip breadth from landmarks. Not photo-to-3D. |
| Poses and movement | Built+tested (2026-11-12, branch) | `pose-view.js` skins body and ink in the main view; 29 stills, 17 loops; posed editing | t39, t12, t17, pose units | No | See Major features pass |
| Clothing and hair for visibility checks | Built+tested | `clothes.js` | clothes-unit, t42 | No | Skin-tight approximate garments and two hair lengths, in any pose. |

### Planning, notes and output

| Area | Status | Where | Automated test | iPad | Gap |
|---|---|---|---|---|---|
| Alternatives (layouts), compare side by side or wipe, size studies, checkpoints, saved views | **Missing** | | None | No | |
| Notes, drawing and measuring on the body | **Missing** | | None | No | A per-tattoo size readout exists (`sizeText`) and is marked with "≈". |
| Picture of this view, blank body | Built+tested (render) | `shot` | t1 | Jake (first deploy) | "Blank body" is a screen capture, not a Procreate patch with a return path. |
| Artist sheet | Partial, tested (render) | `artistSheet`: one view, up to 7 pieces, sizes with an "approximate" line | t1 | Jake (first deploy) | No front / back / side views, notes, or print layout. |
| Native share sheet with download fallback | Built | `share.js` | Not automatable (native sheet) | Jake (first deploy) | |
| Procreate patch export and transparent PNG return | **Missing** | | None | No | |
| GLB import, GLB / OBJ export | **Missing** | See feasibility note below | None | No | |

### Saving, backups and projects

| Area | Status | Where | Automated test | iPad | Gap |
|---|---|---|---|---|---|
| Autosave with an honest status | Built+tested (this pass) | `save`, `flushSave` in `app.js`, `store.js` | t6: reopen, failed disk shown as "Not saved", recovers | **No** | |
| Save when the app leaves the screen | Built+tested (this pass) | `visibilitychange` / `pagehide` flush | t6 (simulated `pagehide`) | **No** | Whether iPadOS always lets the write finish needs a real check. |
| Earlier saves to go back to (up to 8 copies) | Built+tested (this pass) | `store.addRecovery`, Share > "Go back to an earlier save" | t6: go back, undo, redo | **No** | Copies are on the same device. They do not protect against losing the device or clearing Safari data. |
| Loads and backups are validated before they replace anything | Built+tested (this pass) | `project.js` `cleanState`, `openProject` | t6: 8 damaged files rejected unchanged, 1 partly damaged file repaired | n/a | |
| An unreadable save is never overwritten | Built+tested (this pass) | `store.quarantine`, boot fallback | t6 | n/a | No screen yet to export a quarantined save; it is kept in IndexedDB. |
| Old saves upgrade without moving ink | Built+tested | `adoptState` (body model), `store.load` (storage format) | t5, t6 | **No** (Jake's own save has not been opened in this build) | |
| Own backup file | Built+tested | `backupNow`, `importBackup` | t6 | Jake (first deploy, older format) | Open replaces the project. No "restore as a copy" because there is only one project. |
| Open v47 `.ink.json` with exact placements | Built+tested | `importInkJson`, `readInkJson` | t3, t6 (damaged file) | Not confirmed: his general OK followed a request to open a backup, but he did not say which file | Reads tattoos, body type, skin, height, body-fit sliders. Ignores layouts, artwork links, groups, views, versions, notes, marks, cleanup data, wrap / bend / taper. Opening a v47 file here and saving loses those parts in this app (the original file is untouched). |
| Write v47-compatible backups | **Missing** | | None | No | One-way today. |
| Several projects, shelf, archive | **Missing** | One `project` key | None | No | |
| Installable, works offline | Built | Vite PWA plugin | Build output checked; offline not tested | Unknown | |
| Accounts, cloud sync, share links, private review, comments | **Missing** | | None | No | Needs a backend choice and consent wording from Jake first. |
| AI art, photo-to-3D body | **Missing** | | None | No | Deferred. Needs consent, a provider, and a cost decision. |

### 3D interoperability, honestly

- The baked body has no UV coordinates: `tools/mesh.py` reads `v` and `f` from `base.obj` and drops `vt`. Ink is drawn as separate decal meshes, not painted into a body texture.
- So an OBJ or GLB of the bare body is easy, but "export with tattoos" that opens correctly in Procreate (which needs a UV-mapped OBJ or USDZ) requires two new pieces: carry MakeHuman's UVs through the bake (seams mean splitting vertices in a render-only copy, while anchors keep the current indices), and bake the ink into a texture in UV space. Until both exist, an export button would be a fake round trip. Not built.
- GLB import of someone else's mesh is a separate problem: no anchors, unknown scale and units, arbitrary size. It needs file-size and triangle limits, a scale step, and a per-mesh surface adapter. Not built, and not safe to accept blindly.

## Staged checklist

Each stage ends with: `npm run build`, all scripts in `tools/tests/`, new tests for the stage, and a note of what still needs the real iPad.

### Stage 1: core reliability and parity

- [x] **1a Durable projects** (done 2026-11-11, t6, 24 checks)
  - [x] Validate every load and import before it replaces the project (`project.js`)
  - [x] Saves confirm they reached disk; failures show "Not saved" and offer a backup
  - [x] Save immediately when the app leaves the screen
  - [x] Artwork stored once, not rewritten on every edit (`img:<key>`), with an atomic upgrade from the old format
  - [x] Up to 8 earlier saves, taken on open, before any backup is opened, and every 5 minutes of work
  - [x] Unreadable saves are set aside, never overwritten; fall back to the newest good copy
  - [x] Ask the browser to keep the data (`navigator.storage.persist`)
  - [ ] Real iPad: open Jake's own project in this build, leave the app mid-edit and come back, go back to an earlier save
- [x] **1b Curved-surface placement** (done 2026-11-11, `src/decal.js`, t7 and t7b). Connected-surface walk from the anchor triangle, gated by the artwork rectangle (white texture margin hides the overhang, no clipping math) and by surface facing, replacing three.js `DecalGeometry`. `wrap` / `bend` / `taper` controls in the edit sheet, default 0, read from v47 files, validated in `cleanState`. t7 confirms ink reach stays within the piece size of its anchor (no jump to the torso); t7b shows wrap curving around the thigh. Not yet: triangle + barycentric supports (Stage 3, for poses) and curved hit testing. Still needs the real iPad with real art on a real arm.
- [ ] **1c Photo cleanup, non-destructive.** Give artwork its own record (source, mask, crop, contrast, result) so cleanup can be redone and so 2b can link placements to it. Editor opens as its own sheet: crop, erase and restore brush with Pencil pressure, background removal with a strength control, contrast, its own undo. State goes to `v: 3` with a migration that wraps each existing image as an artwork.
- [ ] **1d Layers.** Raise and lower, hide, lock, solo, in a "Manage ink" sheet. Groups later.
- [ ] **1e Backups, including v47-format output** (Jake: yes). Write a file the original v47 app at the chatgpt.site address can open, mapping this app's tattoos, body type, skin, height and placements onto the v47 `.ink.json` shape, and noting anything that cannot cross. Plus "restore as a copy" once 4a exists, and a screen to export a set-aside (quarantined) save.
- [ ] Scripted two-finger touch test for pinch on ink and on the background.

### Stage 2: artist and client planning

- [ ] 2a Protect existing ink: locked from edits, confirm before removing, shown apart from planned ink in the tray
- [ ] 2b Linked artwork: one design, several placements, edit once (builds on 1c)
- [ ] 2c Alternatives that share existing ink; compare two with the same camera, side by side or wipe; 2 / 3 / 4 inch size study
- [ ] 2d Checkpoints (named saved versions) on top of the 1a recovery store
- [ ] 2e Notes pinned to the body, and a two-point measure that always says it is approximate and shows which height it assumes
- [ ] 2f Artist packet: front, back, left, right and detail views, size table with the "approximate" label, notes, original-resolution artwork, printable

### Stage 3: body and interoperability

- [ ] 3a Real skinning from the MakeHuman rig; ink follows through the 1b supports; check adherence at elbow, knee and shoulder before adding poses in bulk
- [ ] 3b Procreate patch: square guide of a body area out, transparent PNG back onto the same patch, with the wrong-size and empty-image checks from the v47 spec
- [ ] 3c UVs through the bake and ink baked to a texture, then OBJ / GLB export with a manifest (units, model version, texture size). Round-trip it through Procreate on a real iPad before calling it done.
- [ ] 3d GLB import only after 3c, with size limits and a scale step
- [x] 3e **Clothing and hair** (Jake: yes; built 2026-11-13, see Clothes above). Optional overlays for visibility checks (sleeve, collar, shorts coverage across alternatives) and a less bare mannequin. Keep them toggled off by default so the body stays usable and the canvas uncluttered. Hair as a simple shell, clothing as generic garments marked approximate, not fitted tailoring.

### Stage 4: private review and cross-device

- [ ] 4a Local foundations that need no server: several projects with a shelf, restore as a copy, a single-file review packet
- [ ] 4b Backend choice with Jake, then accounts and sync
- [ ] 4c Private review room: invite-only, comments pinned to a version and a body spot
- [ ] 4d Any photo upload or AI step: consent wording, provider, cost shown first

## Decisions

Answered by Jake 2026-11-11:

1. **Deploy: yes.** The body pass and Stage 1a were pushed to the live rebuild for his iPad check.
2. **Write v47-format backups: yes.** Folded into Stage 1e below: `backupNow` and the backup card should write a file the original v47 app can open, carrying across what both apps share, and the audit note about one-way loss gets revisited.
3. **Clothing and hair: yes, wanted.** Added as Stage 3e. Not in v47; the competitor publishes them. For visibility checks (does a sleeve cover it) and a less bare mannequin. Keep it optional so the body stays usable without it.
4. **Backend for accounts: yes, wanted.** Stage 4b stays, but the specific backend is still unchosen. Per the cross-device-accounts note, explain the options plainly and get his pick before building; no backend, account, upload or paid service goes in without that.

Still open:

- Order inside Stage 1 after 1a. Recommendation: 1b curved placement next, then 1c cleanup.
- Which backend for Stage 4 (deferred until the local foundations in 4a are done).

## Tests

`tools/tests/` t1 gestures and exports, t2 shape change with ink, t3 v47 import, t4 body visuals, t5 old-save body upgrade and slider touch, t6 durable projects. Run each as `node tools/shot.mjs shots/out.png tools/tests/tN.mjs` after `npm run build`. All six passed on 2026-11-11 against the working tree. None of this replaces the iPad check.

## Local implementation checkpoint — 2026-11-12 (not published)

The working tree now includes the following staged parity improvements. This is not a declaration of full v47 parity, and it has not been pushed or deployed.

- iPad navigation recovery: controls follow the visual viewport; interrupted gestures clear; Full body is always available. Synthetic portrait/landscape zoom tests pass; a real iPad check remains necessary.
- Upload and local artwork cleanup: preserve transparency and immutable original image; light-paper removal, crop, contrast, erase/restore, compare, reset and local undo. Apply creates a separate artwork revision. This is not AI subject removal, and mask/crop parameters are not yet a persistent editable recipe.
- Precise placement: approximate inch width, 1/2/3/4-inch presets, small surface nudges and transform reset. Locked ink blocks editing.
- Plan menu: named project copies, recoverable archive, layouts, checkpoints, saved views and size studies. Restoring a layout preserves current existing ink. Comparisons currently summarize counts, not visual side-by-side canvases.
- Layers: order, selection, named groups, visibility, opacity, locks and view-only solo. Spatial group transforms remain unimplemented.
- Artist export: full self-contained printable HTML with four body views, all artwork, available untouched sources, sizes and notes. The older quick PNG is explicitly limited to seven visible tattoos. Detail-angle selection and note authoring remain future work.
- Asset retention: central image-reference traversal covers originals, outputs, layouts and checkpoints for backup/recovery/GC; original data is never overwritten.

Integration gates: build passed; t6 durability/touch-target suite, t8 navigation, t9 cleanup/shelf, t10 planning/layers, t11 full packet passed. Earlier t1/t2/t3/t5/t7/t7b passed during this pass. Tests do not replace real-iPad verification. No live original project was opened or modified.

Still required: real pose skinning/ink deformation, linked artwork edits, spatial group transforms, visual comparisons, pinned body notes/drawing and two-point measurement, full editable cleanup recipes, Procreate patch round trips, UV/3D export/import, clothing/hair, v47-compatible backup export verification, and backend/provider selection before accounts or AI uploads. A rig investigation found the current body bake excludes most joint-source vertices; safe skinning needs a separate shape-aware rig bake with unchanged body topology and all normalized weight influences, not a cosmetic pose shortcut.

Pose foundation added after the checkpoint: `tools/rig.py`, `src/rig.js`, `src/pose.js` bake 163 bones/326 shape-aware joints and retain all normalized influences in the exact 14,287-vertex order. Agent tests passed shape identity across 27 macro combinations and six slider extremes, neutral identity, repeated-pose rest immutability and root rotation. This foundation is deliberately NOT imported into the app yet: decal attachment, native bone-roll fidelity, restrained visual previews, joint-crossing artwork QA and iPad performance must pass before runtime integration.

## Next local pass — pose previews, notes and linked artwork

- Plan → Pose preview now opens an isolated cloned scene with neutral, elbow bend, raised arm and gentle torso twist. Body and ink deform using the rig; decal UVs remain fixed and each vertex follows its exact body support plus normal offset. Preview closes back to unchanged canonical editing state. It is not full posed editing, IK or an anatomical simulation.
- `t12-pose-notes.mjs` verifies all four presets, exact support mapping, unchanged UVs/input buffers/state, neutral identity, and artist-note reload persistence. Raised-arm screenshot visually inspected. `pose-unit.mjs` repeats neutral/body identity and rest immutability over 27 macro shapes. Real iPad performance remains unverified.
- Plan → Artist notes supports whole-plan and piece-linked text, edit and two-step deletion; notes feed the printable artist packet. These are not 3D body pins.
- Cleanup now offers an explicit linked-copy action when pieces share an artwork identity, alongside independent cleanup. Locked copies and historical layout snapshots are preserved. New revisions retain original sources and metadata.
- All changes remain local and unpublished; original embedded project untouched. Full posed editing, motion loops, body pins/measurement, spatial group transforms and the other uncompleted roadmap items still remain.

## Local visual comparison and spatial groups pass

- Saved layouts/checkpoints now carry a compact actual camera snapshot and support side-by-side visual comparison. These are saved pictures, not synchronized live 3D. Older entries explicitly say no preview is available; size-study generation never mislabels an unchanged picture as a resized preview.
- Layers → Move / resize selection adds group scale, rotation and small tangent-plane nudges. Scale changes spacing and artwork sizes together. Locked/existing ink is excluded. All projections must pass a short connected-triangle skin path plus distance/normal guards; ambiguous or excessive-curvature moves reject atomically. One undo restores the whole operation.
- `group-transform-unit.mjs` covers spatial transforms, protection and atomic failure. `t14-compare-groups.mjs` passed actual saved-preview comparison and adjacent chest-group scaling/undo. A cross-surface selection was correctly rejected. Visual inspection found and fixed dark input contrast and added overflow scrolling to the planning panel.
- These improvements remain local only. 3D pinned notes/measurement, posed editing/motion loops, Procreate/3D interoperability and optional clothing/hair are still unimplemented; account/AI provider decisions remain outstanding.

## Local body tools and coverage pass

- Plan → Body pins & ruler: neutral 3D notes use triangle/barycentric anchors; edits save only on explicit Save notes and preserve general/piece notes. Cancellation leaves stored notes unchanged. New notes capped at 240 characters / 180 pins; older longer text is retained. Two-point ruler reports approximate 3D straight-line distance scaled to body height, explicitly NOT a surface/tape measurement.
- Plan → Clothing coverage: optional short/long sleeves, high collar, shorts and hair silhouette, all off by default. These are approximate painted-on coverage masks, not fitted garments or realistic hair. Covered decal triangles are hidden using the same region tests; everything stays in an isolated cloned scene and disappears on close without changing the project.
- Artwork import now enforces documented PNG/JPEG/WebP, 10 MiB, 24-megapixel and 1:20–20:1 aspect limits before adding a piece; accepted originals remain retained.
- t15 integration validates pin save/reload, body picking and ruler output, temporary coverage toggles/input immutability and covered ink suppression. Visual QA caught and fixed ruler buffer growth/hidden endpoints and tattoo bleed-through on coverage overlays.
- Still remaining: direct body drawing, sampled-surface measurement, posed editing/motion loops, Procreate patch workflow, 3D interoperability, photo-guided fit and backend/AI-dependent features. All work remains local, unpublished, original app untouched.

## Local drawing and Procreate exchange pass

- Body tools now support neutral direct-on-skin drawing with triangle/barycentric anchors, continuous-surface guards, per-stroke point limits, visibility and two-step drawing-only clear. Save atomically applies notes plus drawings; cancel discards both local edits.
- Share → Sketch in Procreate creates a 768-square body patch guide from real decal UV triangles. Pending patch, guide, shape signature and anchor persist across reload; reopening resumes the pending exchange. Explicit discard is undoable. Returning a validated PNG adds a NEW planned tattoo at the saved patch; it never replaces existing ink.
- PNG return validation rejects wrong format/dimensions, empty/opaque returns and visible pixels outside the patch. Body-shape changes block application until restored or a new guide is created. Parent converts padded shader UVs back to raw image coordinates to avoid double-padding/shrinkage.
- `t16-drawing-patch.mjs` passed anchored drawing persistence and a simulated transparent-PNG exchange after reload, including new-planned-item/anchor verification. Clipping float roundoff at square boundaries was fixed during integration. This is not a verified native iPad/Procreate handoff yet; existing-ink reference-layer export and richer patch-area selection remain future work.
- All work remains local/unpublished and does not touch the original embedded project.

## Local reference, motion and manual photo-fit pass

- Procreate guide creation now offers current view, selected tattoo area, chest, back, arm, forearm and thigh. Existing ink on the exact shared patch triangles gets a separate transparent reference layer, persisted with the pending patch and exportable separately. Reference respects legacy/current image orientation and never imports the guide as ink.
- Pose preview adds a restrained elbow motion loop with <=20 skin updates/second, play/pause, background stop and close cleanup. Pause restores the static pose. `posed-picking.js` has tested inverse barycentric math, but direct posed editing remains disabled, consistent with v47's neutral-only manipulation rule.
- Manual photo-reference fitting provides temporary local front/back photos, before/after and body controls. Apply saves a restorable original in Projects BEFORE opening a fitted copy. Photos are not saved or uploaded, and no automated anatomical inference is claimed.
- Found and fixed a pre-existing vertical artwork inversion for NEW uploads and patch returns using explicit imageTopDown metadata. Untagged legacy placements keep their old appearance; an explicit Flip vertical control lets users correct them. This is intentionally not a silent visual migration.
- t17 passes motion/support/state safety and selected-patch transparent existing-ink reference; t16 still passes chooser/roundtrip. t18 passes local-photo preview, separate-copy application and original restoration. t19 pixel-tests correct new orientation, preserved legacy appearance and explicit flip. Photo-fit and orientation screenshots visually inspected.
- Still local/unpublished. Native iPad/Procreate handoff, complete 3D interchange, automatic/landmark-guided fitting and backend decisions remain separate verification/work.

## Local 3D interchange and v47 preservation pass

- Share → Export 3D model outputs a self-contained neutral GLB in meters, with body and separate tattoo meshes/embedded textures. This is static, approximate plain skin, not UV-baked or rigged; colored alpha ink can differ from the app's multiply shading. No notes/photos/arbitrary private metadata are exported. GLB is preferred to an incomplete OBJ/MTL handoff.
- Share → Preview a GLB is read-only and never replaces the canonical body/project. It rejects external resource URLs, oversized models/textures and unsupported compression. t20 verifies export/reimport bounds and state preservation plus zero external fetch on a rejected texture URL. Roundtrip screenshot inspected.
- Original-v47 export now exposes an explicitly limited compatibility copy alongside a full rebuild backup. Shared geometry maps through canonical triangle barycentrics. Unsupported counts, widths or uncertain anchors stop export rather than truncate/resize. Original-runtime testing remains NOT performed.
- Replaced the old v47 importer, which retained metadata from the previous active project, with isolated new-state conversion. Shared layouts/checkpoints/groups/artwork IDs/images are converted; unsupported source metadata is retained verbatim in v47Source and can be downloaded as an untouched original backup. Unplaced art stays unplaced in a separate saved-artwork list until explicitly placed by the user. Invalid non-null anchors are rejected instead of guessed.
- Unit export/import tests and independent t21 integration passed source archival, metadata isolation, unplaced-art reload/manual placement and failed-import safety. Full editable parity for legacy marks/boards/views/cleanup is still incomplete; the untouched source and full rebuild backup preserve those records.
- No publication or original-app modification occurred.

## Local-only motion, measurement and artist detail checkpoint

- Pose preview now offers three restrained motion studies with speed and scrub controls; isolated tests verify support mapping, UV/input preservation, pause, visibility and cleanup. These are approximate rig studies, not anatomically validated motion.
- Ruler compares chord distance with a shortest mesh-edge route. It stays on connected mesh topology, rejects disconnected routes, and scales to height. Explicitly approximate, potentially overestimating, and not a substitute for a real tape or exact geodesic.
- Artist packet includes pinned notes and drawing marks, including mark-only axis projections with clear limitations. It does not misrepresent these as body screenshots or production stencils.
- These additions are NOT part of the first upload/cleanup release slice.

## Jake's next requested artist workflow priorities

- Alignment guides like Photoshop/Slides, relative to existing tattoos: centerlines, edges and spacing, with optional snapping and no implicit movement of locked/existing ink.
- Mirror/symmetry tools: explicit preview and chosen axis/side, preserving original artwork and requiring deliberate application. Distinguish image flip from opposite-body placement.
- Export a chosen body section with existing ink to a flat drawing view, then map the returned transparent art onto the same wrap. Existing Procreate patch exchange is a partial foundation, not full UV-unwrapped section editing; retain shape/patch identity and prevent stale-body reimports.

## Local alignment, symmetry and flat-patch refinement

- Align & body symmetry provides explicit center/rectangular-edge/gap operations relative to a fixed tattoo. Preview is a rendered proposed placement without changing the project; Apply is atomic and undoable. Locked/existing pieces are not moved. Opposite-body duplication preserves the source and is distinct from image mirroring. Same-surface alignment uses connectivity checks; symmetry uses a bounded mirrored-target raycast and normal/distance checks.
- t22 verifies real preview/apply/undo and opposite-body copy with originals preserved. Pure tests cover alignment math, protected references, unsafe projections and centerline rejection. This is deliberate alignment tooling, not live Photoshop-style snapping guides during free dragging.
- Procreate patch UI now previews guide, existing ink and returned art as independently toggled layers, rejects exact guide/reference files, and requires explicit unchanged-canvas/new-ink-only confirmation before applying. Reimport resets that confirmation. It cannot automatically detect arbitrary rotation/translation; pending shape/identity checks remain enforced. It is a projected square patch, not arbitrary UV unwrapping.
- t16 saved-patch roundtrip and isolated preview/import/retry tests passed. No deployment of these additions.
- Local parity work was checkpointed before merging deployed cleanup commit d2cf602. Branch local/parity-next preserves prior work and release ancestry without reset. Future publication requires separate approval.

## Local view twist and deliberate tap placement

- Two fingers starting away from selected editable ink now pinch/pan/twist the whole view. Positive screen twist produces matching clockwise visual roll; world-up is reset before lookAt and roll is applied once, with shortest-angle smoothing. Full body resets roll. Old saved views lacking roll restore upright.
- Selected unlocked planned tattoos now have explicit Tap to place / Cancel controls and a visible armed banner. One valid body tap moves the piece with one undo step. Blank taps retain the piece and armed mode; drags/pinches while armed adjust only the camera. Selection changes, locking, hiding, Existing status, Escape and pointer cancellation disarm safely. Existing on-ink two-finger resize/rotate semantics remain unchanged.
- Pure view-gesture tests and rebuilt t23 browser tests pass: actual projected clockwise vector, no roll drift, world-up, Full reset, blank tap, armed orbit, placement/undo, lock/Escape cancellation, selected-ink resize/rotate without camera roll, and old saved-view compatibility. t5 touch-slider/panel regression also passes.
- Local only. Real iPad Chrome/Pencil acceptance remains pending; no deployment in this pass.

## Live drag alignment guides (local)

- Normal one-finger tattoo dragging now shows nearby rectangular center/edge guides against visible references, including locked/existing ink. Default is view-only; an explicit Precise placement > Snap to guides checkbox enables movement adjustment. References are never edited.
- Candidates require proximity, normal and tangent-depth agreement, then local surface connectivity through the existing projection helper. Snapping adds a bounded connected projection. Guides clear on pointer end/cancel, two-finger gestures, or disabling guides; camera roll and tap-to-place remain separate.
- Pure math tests and rebuilt t24 browser test pass for actual SVG guide display, unchanged unsnapped drag hit, existing-reference preservation, opt-in snap/undo and clearing. Guides use image rectangle bounds, not alpha outlines; this is approximate alignment on curved skin, not an anatomical or calibrated layout guarantee.
- Not deployed. Real iPad interaction/performance acceptance remains pending.

## Local flat drawing and visible-ink selection checkpoint

- The flat patch now supports local 768-square draw/erase with pressure-aware brush, transparent output, mask clipping, reference overlays, bounded undo/redo and explicit use/cancel. The result still passes the same PNG validation, alignment confirmation and parent shape/anchor guard. t26 verifies complete draw-to-new-tattoo placement at the saved anchor without replacing old ink. Saved output is raster, not a persistent editable layer stack.
- Tapping ink raycasts actual rendered decal triangles and samples their visible multiply-texture pixels, excluding white/transparent pixels and out-of-depth surfaces. Repeated taps cycle overlapping visible pieces without camera recentering between choices. t25 tests actual UV pass-through and stack cycling. Drag-start ownership intentionally retains the generous existing hit area; it is not a new precise-selection gesture.
- Independent t24 live guide and t16 saved Procreate roundtrip reruns passed after integration. No publication; live release remains cleanup-only d2cf602.

## Local durable transform drafts, resumable cleanup and artwork library

- Placement draft is an explicit, separately persisted transform editor. Size/rotation/opacity/wrap/bend/taper preview do not alter committed project/backups. Keep & close resumes after reload; Save verifies the committed baseline, writes the project, then removes the draft; Discard requires confirmation. It does not yet make every direct body drag/upload a durable draft or provide separate draft undo. t27 exercises reload, committed exclusion, save and project undo. Floating-point body normalization is rounded only in conflict fingerprints at 1e-10 precision.
- Cleanup now retains bounded full edited/restore-baseline raster sessions with crop rectangle and source/output hashes. Reopening restores crop, outside pixels and restore-brush baseline; Remove crop is non-destructive. Crop/erase/reopen/restore/undo/uncrop/stale-session tests pass. History restarts on reopen; paper/contrast remain baked raster edits, not a full replayable layer recipe.
- Artwork library discovers placed/unplaced/retained artwork and offers deliberate linked/independent placements. Sources and original instances retained. It is not yet a full reference-photo/artist-board manager.

## Release QA expansion

- Cleanup exact pixel crop, alpha-aware trim, bounded pan/zoom/Fit and backdrop choices tested; resumable crop/restore tests remain passing.
- Pose catalog expanded to 24 restrained stills and 12 bounded loops with original cycle durations where applicable. Catalog tests cover 288 finite body/phase samples, support mapping and unchanged UV/input. Partial leg/seated studies are explicitly not chair/floor/contact/IK/anatomy guarantees; original full catalog/region studies remain incomplete.
- Independent persistence reviewer found no release blocker in durable draft failed-write/reload/save/undo, cleanup source/session retention or shelf paths. Large retained image/session metadata and real-iPad performance remain risks requiring honest limits and future stress testing.

## Parity release candidate verification

Comprehensive fixture run completed through t28, covering core shape/storage/recovery/undo, old-save upgrade and malformed-import safety, all added local tools, SVG/GLB external-resource rejection, valid v47 roundtrip, guides/picking/tap/view gestures, durable draft failed-write preservation and library identity. Older t1/t2/t7b are smoke/visual scripts; asserted gesture/placement behavior is covered by t23/t24/t25. Old t3 used made-up off-surface anchors and is now explicitly a rejection-safety test; t21 validates safe canonical v47 mapping rather than accepting guessed positions. Independent persistence review found no release blocker. Final changed-module tests cover cleanup session/view controls and all 24/12 pose catalog entries. Real-device acceptance and documented incomplete features remain outstanding.

## Post-Claude cutout and draft refinement

- Preserved Claude's selected-ink drag framing fix (037ab8e); asserted t1 drag regression passes.
- Cleanup now offers edge-connected light-background removal, preserving enclosed pale details. Four-connected threshold flood fill is bounded to 1600-square images; gaps in outlines can admit removal. This is local paper cleanup, not AI subject segmentation. Source, undo/redo and resumable session/restore tests pass.
- Explicit placement drafts now retain a bounded 50-edit undo/redo history across reload. This remains separate from committed project undo. Save, discard and close disable edits while asynchronous storage finishes, preventing late edits from being lost. Reload/undo/redo and injected-write-failure tests pass.
- Remaining advanced parity and real-device acceptance gaps above still apply; no claim of full completion.

## Further local artwork review

Artwork library previews now show the cleaned output by default, with an explicit original-source switch. The switch changes only the view, never saved artwork or placement output. Updated t28 verifies unchanged project state and both linked and independent placement identities. Publication remains blocked pending authorization recognized by the execution reviewer; no new push has occurred.

Cleanup now has an explicit stylus-only editing checkbox. Pen input can erase, restore and crop; touch/mouse cannot paint while enabled but can use Pan and controls. An unrelated touch release no longer cancels an active pen stroke. Synthetic pen/touch/mouse, mixed-pointer cancellation, crop/restore and non-mutating pan tests pass. This is browser pointer-type verification, not physical Apple Pencil acceptance.

## Local sampled-color cleanup

A collapsed connected-color tool now supports tapping a colored background with adjustable RGB tolerance. It removes only the four-connected sampled region, stopping at transparent boundaries. Similar-colored connected artwork can also be removed, so Undo/Restore remain explicit; this is not semantic AI segmentation. Bounded 1600-square algorithm and source/undo/redo/reopen/restore/cancel tests pass. No publication attempted after the approval block.

## Compact selection editor (local)

- Default selection sheet retains name, dimensions, Done, Tap to place, Placement draft, Cleanup and Lock. Size/turn/fade, precise placement, wrap and secondary actions remain available under deliberate More controls. Existing action IDs are preserved; selecting a different piece returns to compact mode.
- Focus now measures the free area between the top controls and full dock (including tray), sets zoom against available height, and shifts the camera aim in screen-up including roll. Explicit details toggles and viewport resize recalculate focus without moving artwork.
- Rebuilt t29 passes real visible-ink drags and undo in compact, expanded, resized and rolled landscape views. At 1024×768, default sheet measured 194 px with 382 px unobscured canvas; expanded sheet measured 422 px and selected ink remained above the dock. Affected older tests now explicitly open More controls only when using an advanced action.
- Original embedded app untouched. No deployment in this pass. Physical iPad/Pencil acceptance remains pending.

### Responsive top toolbar (local)
- Fixed tablet turn-pill overlap with Undo: a left-offset single row at 901–1199px and a separate turn row at ≤900px; related popup/placement hints remain below that row. Existing action IDs and 44px hit targets preserved.
- `t30-toolbar-targets.mjs` passes at 768/1024/1366px: all ten visible toolbar/full-view targets unobscured at multiple sample points, pairwise non-overlap, bounds and actual view/body button clicks. 1024px screenshot reviewed.
- Compact editor `t29` actual drag/undo regression passes in compact, expanded, resized and rolled states; default landscape sheet remains 194px with 382px free canvas. No app logic changes or deployment; physical iPad verification remains pending.

### Live shared-body layout wipe (local)
- Plans and versions now offers Live 3D wipe alongside saved-picture comparison. Two saved layouts/checkpoints use independently cloned scenes with one synchronized orbit/zoom camera and a 0–100% wipe; Close leaves active project and camera unchanged.
- Deliberately limited to matching neutral body, fit, height, skin and model identity, also matching the open project for safe parent decal reconstruction. Different bodies use existing saved-picture comparison. No posed comparison or editing inside preview.
- `t31-layout-compare.mjs` passes through actual Plan UI: orbit, wipe endpoints, active-state/camera preservation, close, mismatch/missing-image rejection. Screenshot inspected. Source `layout-compare-resources.mjs` confirms all four cloned geometries/two cloned ink materials disposed, zero source-resource disposals, borrowed texture retained, state/geometry unchanged. Procedural skin materials are owned/disposed in module but use separate optimized Three instance in source fixture.
- No deployment; physical-device acceptance pending.


## Local OBJ package and live compare verification

Static OBJ package export now includes meter-scale body/separate decal geometry, MTL and current rendered PNG textures in one ZIP, excluding private notes/source artwork. Actual app t32 initially caught naturally out-of-range decal UVs. Fixed with bounded pixel-aligned edge padding and one affine UV remap, preserving interpolation rather than clamping vertices. Normal/padded loader, orientation/alpha, immutability and ZIP CRC tests pass; actual app t32 now passes. Viewer alpha/skin differences remain documented; this is not UV-baked skin or rigging.

Live comparison t31 passes actual Plan navigation, synchronized orbit/wipe, unchanged active project/camera, close, mismatched-body and missing-image rejection. Independent resource test verifies clone disposal and zero disposal/mutation of source textures/geometry. Both features are local-only; no publication retried.

## Local artist boards and soft cleanup

Artwork library now supports named boards with create/rename/filter and explicit add/remove membership. Each saved member pins original/output keys and orientation, so a board-only legacy artwork can still be placed independently after its last placement is removed. Linked placement requires a current canonical identity. Boards are bounded to 120 collections, 500 members each and 2 MiB metadata. They organize existing project artwork, not a complete external reference-photo manager. Asset traversal includes board references in active state and historical layouts/checkpoints. Actual UI t33 verifies failed-write preservation, reload, no placement mutations and board-only placement after removing the last legacy placement.

Cleanup adds opt-in pen-pressure sizing and feathered erase/restore; defaults retain hard fixed-size behavior. Soft restore blends the retained baseline in premultiplied alpha, bounded to the brush patch. Independent tests cover pressure bounds/defaults, outside-pixel preservation, undo/redo and reopened saved sessions. Physical Apple Pencil acceptance remains pending. No publication retried.

## Cloud bug sweep (2026-11-12, Claude)

- Full suite run in a Linux cloud container (chrome-headless-shell 157, SwiftShader). t23, t24 and t33 failed there on fixed waits (camera glide, boot, debounced save) and now wait on `__ink.ready()`, `__ink.settled()` and the saved status instead.
- Fixed: the service worker auto-update reloaded the page the moment a new version took control, which can land seconds after opening the app and drop a drag, an open editor or an unwritten save. Now it reloads at once only before the first touch, otherwise offers Reload and applies on leaving the screen, always after the save is written, never while the save is failing. `t34-update-reload.mjs`.
- Fixed: the two-finger mode was decided by whichever touch the browser reported first, so a pinch that landed with only the second finger on a narrow tattoo twisted the whole view. A second finger landing on the selected tattoo before the first has moved now makes it a tattoo resize/turn. `t35-two-finger-order.mjs` (fails on the old code).
- Fixed: the hint pill sat cut off under the Body panel in portrait.
- Swept at 820x1180, 1180x820, 768x1024, 1024x768 and 1366x1024 with touch: overview controls (no overlap, nothing off-screen, 44 px), select, one-finger drag follows the finger exactly, pinch/twist on ink, pinch off ink, size slider (no page shift), undo, Body panel and Share sheet touch scrolling, cleanup editor fits. No page errors.
- Left for Jake: cleanup editor still uses technical words (paper threshold, scope, retained baseline) and a light theme unlike the rest; in landscape the selected tattoo is framed small.

## Major features pass (2026-11-12, Claude; first four deployed 23:22Z with Jake's OK)

- **Before / after** (`src/before-after.js`, button top-left under Full body). The main 3D view splits: left of the line shows the body with only ink marked "Already on me", right shows the planned ink too. Same camera, one render with a scissor split, nothing in the project changes. The line is a 44 px touch target, drags with a finger, takes arrow keys, and sits under the top bar, tray and edit sheet so editing still works while it is on. Says so plainly when nothing is planned. `t36-before-after.mjs`.
- **Tap to cut out** (`src/auto-cutout.js`, first tool in Clean up). MediaPipe interactive segmenter (MagicTouch model, CPU) runs on the device; nothing is uploaded. The runtime (`@mediapipe/tasks-vision` 0.10.32 wasm) and model (`public/vision/magic_touch.tflite`, about 6 MB) are served from this site, kept out of the service worker precache and cached on first use. Tap a part to keep it; further taps add parts; Undo takes the last tap back. Keep "What I tapped" keeps the found shape with a soft edge; "Just the ink (photo of skin)" lifts dark ink off skin inside the found shape (local skin estimate with a floor from the area's own skin, so big solid fills survive). The original picture is still kept, as before. `auto-cutout-unit.mjs` (pixel rules without the model), `t37-auto-cutout.mjs` (real model in the browser, two taps, keep switch, undo, apply). First use downloads about 17 MB (runtime plus model); not yet timed on an iPad.
- **3D model with your tattoos** (`src/uv-bake.js`, `tools/uv.py` makes `src/body-uv.js`). MakeHuman's UVs now come through (triangle order matches the body bake, 27,036 triangles), and visible ink is painted into a 4096 px skin texture by rendering each decal's triangles at their body-UV positions with the same multiply look, then dilating the edges. Share offers a USDZ ("3D model with your tattoos", for Procreate, Files and AR Quick Look) and an OBJ + MTL + skin PNG ZIP for desktop apps. Hidden tattoos are left out; the project is not changed. `uv-bake-unit.mjs` (UV alignment against the mesh shape), `t38-painted-model.mjs` (both files from the real Share sheet, texture checked for ink). Not yet opened in Procreate on an iPad. The genital helper mesh has no MakeHuman UVs and gets plain skin.
- **Poses in the main view** (`src/pose-view.js`, `src/pose-catalog.js`, Pose button top-left). Replaces the separate pose preview window. The body and every tattoo are skinned on the CPU from the MakeHuman rig into a posed copy that is swapped in only while drawing and while working out what the finger touches; anchors, decal building, saves and exports all stay on the rest body, so posing never changes the project. 29 stills in plain words (Standing; Arms; One arm, both sides; Torso; Legs) and 17 moving loops with play, pause, Slow / Normal / Fast and a step-through slider; 280 ms glide between stills; at most 20 body updates a second; motion pauses when the app leaves the screen. Ink can be selected, dragged, resized and tapped into place in any pose: the touch on the posed body maps to the same triangle and barycentric weights on the rest body, so it lands on the same skin. The lowest point of the body stays on the floor, so a squat or a raised knee stands on a foot; a seated pose has no chair. Moving the camera to the selected tattoo follows its posed spot. `t39-poses.mjs` (panel, 44 px buttons, ink follows, project unchanged, drag in a pose lands under the finger, undo, motion play/pause/step, feet on floor), `t12-pose-notes.mjs` and `t17-motion-reference.mjs` rewritten for the new panel, `pose-catalog-unit.mjs`, `pose-unit.mjs`. One pose rebuild takes about 95 ms in headless software rendering; not yet timed on an iPad. Poses are hand-tuned rotations, not anatomical simulation: extreme poses (squat, seated) crease at the hips and knees.
- Hip and knee creases in squat and seated: tried sharing hip flexion with the pelvis bone; no visible change. Linear blend skinning limit; a real fix needs corrective shapes. Parked.
- **Print at real size** (`src/print-size.js`, Share). A US Letter PDF with every visible tattoo at its true size on the body (width from the model, scaled by the height setting), white paper behind, mirrored when the tattoo is mirrored, captioned with name and size. Small pieces share pages; a piece bigger than a page is split into numbered parts that line up edge to edge. Each page has a 1 inch check square, a 5 cm bar and "print at 100%" instructions. `print-size-unit.mjs` (sizes, packing inside margins, parts cover big pieces exactly, valid PDF offsets, text escaping), `t40-print-size.mjs` (from the real Share sheet, each piece drawn at its true size, pictures decode, project unchanged). Not yet printed from an iPad.
- **Spin video** (`src/spin-video.js`, Share, `mp4-muxer` 5.2.2 MIT). A 6 second, 720 x 960, 30 fps clip of the body turning once in the current pose with visible ink, framed to the body's own height and arm reach. Frames are drawn one at a time and encoded on the device with WebCodecs into MP4 (H.264 Main), so the clip is smooth however slow each frame is; without WebCodecs it records in real time with MediaRecorder. The view, pose and project are put back afterwards. `t41-spin-video.mjs` (plays the file back: 720 x 960, 6 s, frames change, view and pose kept, project unchanged). Not yet made on an iPad.
- **Clothes** (`src/clothes.js`, Clothes button top left, also Plan > Clothes). Tops (tank top, T-shirt, long sleeve), bottoms (swim briefs, shorts, long pants) and hair (short, long to the back of the neck) drawn as a thin shell just off the skin, in the main view, over any body shape and any pose. Where each garment ends is worked out per vertex from the rig's bone weights and distances along the arm and leg, then trimmed per pixel, so hems and necklines are smooth curves. Covered ink is hidden, and the panel names which tattoos are covered, partly showing or showing. Only for looking: nothing is saved. Replaces the older Clothing coverage preview window (box-shaped regions, hard triangle edges, standing only). Garments are skin-tight approximations, not tailored clothes. `clothes-unit.mjs` (what each garment covers on all three figures), `t42-clothes.mjs` (ink hidden under cloth, panel names the tattoo, clothes follow a pose, Escape and None, project unchanged). Not yet tried on an iPad.
- **Apple Pencil taps** (`src/pen-tap.js`). Jake reported 2026-11-13 that Plan, Body and the purple Upload tattoo button ignored the Pencil while a finger worked. Cause (inferred, not seen on a device): the page-wide touchmove guard cancelled taps whose touch slid a pixel or two, which a Pencil nearly always does. One-touch moves on controls are no longer blocked, and a short pen press that starts and ends on the same control clicks it exactly once. `t43-pencil-taps.mjs`. Needs Jake's Pencil to confirm.
- **Back from Procreate** (`src/procreate-import.js`, Share > Bring back from Procreate). Opens the USDZ (or OBJ ZIP, or the bare skin picture) made by "3D model with your tattoos" after drawing on it in Procreate's 3D painting. The skin picture is compared with the same body baked again (plain skin plus the tattoos already on it, shrunk the same way, either way up), new drawing is grouped by where it sits on the body, and each group is photographed straight on from the skin and added as a new planned tattoo there, ink on transparent paper. Existing tattoos are never changed. Limits: import into the same project and body shape the model was exported from; a drawing that wraps far around a limb comes back as a flat picture. `t44-procreate-import.mjs` (mark drawn on the exported USDZ comes back within 1 cm and re-exports onto the same skin; unchanged USDZ and OBJ add nothing). Procreate's own USDZ writing is untested: needs a real round trip on the iPad.
- **Layered PSD** (`src/psd.js`, Share > Layered file for Procreate (PSD)). This view as a Photoshop file: the body (no ink) as the bottom layer, then one multiply layer per visible tattoo seen from this side, named after it and transparent around the ink, plus the flattened picture. Each tattoo is drawn alone on white with the body hiding what is behind it, then white becomes transparency, so the layers recombine exactly to the flattened view. Clothes, floor shadow and selection outline are left out. Layers are cropped and PackBits-packed. `t45-layered-psd.mjs` (layer per tattoo on its spot, recombines to the flattened picture within 1 level, side view, hidden tattoos left out, clothes left out). Checked only with our own reader: needs opening in Procreate on the iPad.
- Unchanged: the edit sheet size and the body model (both Jake's open calls).
