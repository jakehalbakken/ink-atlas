# Ink Atlas rebuild: parity audit and staged plan

Written 2026-11-11 from the code in `src/`, the scripts in `tools/tests/`, `CLAUDE.md`, `docs/v47-spec.md` and the competitive strategy report (kept in `docs/private/`, which is git-ignored).

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
| Curved-surface placement (wrap, bend, taper, no bleed from arm to torso) | **Missing** | `decalGeometry` uses three.js `DecalGeometry`: a flat box projection with a normal filter | None | No | The biggest placement risk. Large pieces on limbs stretch, and ink can land on a nearby surface. v47 wrap / bend / taper values are ignored on import. |
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
| Poses and movement | **Missing** | Rig and weights are in `data-src/rig/`; only the lips mask uses them | None | No | |
| Clothing and hair for visibility checks | **Missing** | | None | No | Competitor publishes these. Not in v47. Decide if wanted. |

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
- [ ] **1b Curved-surface placement.** Replace `DecalGeometry` in `decalGeometry` with our own projector: walk outward from the anchor triangle over mesh adjacency so ink cannot jump from arm to torso, clip to the artwork rectangle, add `wrap` / `bend` / `taper` (default 0, read from v47 files), keep each ink vertex as triangle + barycentric so poses can move it later. Fixtures: forearm band, upper arm beside the torso, shoulder cap, large back piece, inner thigh. Pass mark: no ink triangle on a surface not connected to the anchor within the piece's size.
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
- [ ] 3e **Clothing and hair** (Jake: yes). Optional overlays for visibility checks (sleeve, collar, shorts coverage across alternatives) and a less bare mannequin. Keep them toggled off by default so the body stays usable and the canvas uncluttered. Hair as a simple shell, clothing as generic garments marked approximate, not fitted tailoring.

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
