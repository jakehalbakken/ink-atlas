INK ATLAS V47 REBUILD SPECIFICATION

This describes the published v47 behavior. The compatibility-critical pieces are the canonical mesh and vertex ordering, the backup format, artwork identity across placements, and the distinction between a draft and a saved placement. Match those before tuning the visuals. This pass used source inspection. Native iPad sharing, Pencil behavior, and performance should be tested in the rebuild on-device.

FEATURE INVENTORY

Workspace and first launch

The 3D canvas occupies the main workspace in portrait and landscape. The top bar has the project name, undo/redo and Share. The bottom tray has Add ink, tattoo thumbnails and Manage ink. The footer shows local save status, Add from photos and Alternatives.
A first-run project is original, named “My tattoo plan,” with one sample, “Still becoming · sample.” Its art is generated on an 800 × 500 canvas using two lines of italic Georgia. The starter uses the male mesh, default skin #bb8f72 and neutral proportions. A named new project starts without ink and carries forward measurements from the previous project.
A dismissible gesture coach stores its dismissal in localStorage under ink-atlas-canvas-coach. An empty project prompts the user to add ink. A model failure shows a visible error. Local project and artwork controls still have value when 3D is unavailable.
The legacy-starter correction recognizes the exact old bundled portrait and fit on an otherwise untouched original sample project at startup. It checks for user work, including a draft, altered sample, measurements, layouts, notes, groups, views and versions. It uses a digest of the historical image, so the old portrait need not ship. A real saved avatar or imported copy retains its fit.

Body and avatar

View options has Male and Original figures, a continuous light-to-deep skin tone slider, height and weight, photo-guided body fitting and a portrait close-up when a saved portrait is present.
Fit your 3D body opens a separate preview. Add one front photo and optionally one back photo, place eight landmarks per reference, undo the last mark, remove a photo, or use the estimated proportions. Manual body and face sliders work independently. Compare Before/Fitted at the same view, use front/back/side or face angles, and preview neutral, flexed arm or seated. Reset, cancel, remove an existing portrait, or apply to a separate project copy.
Reference photos used for body fitting are temporary. They stay in the dialog and are released on close. The saved result is the fit parameters. A portrait already in the project travels with that project’s copies and backups.

Importing art and cleanup

Add ink accepts PNG, JPEG or WebP and opens the artwork editor. A new finished image is processed to PNG with a maximum 1,600 px edge, preserving aspect. Apply creates a planned item and starts placement when 3D is available. Without 3D, it can be saved unplaced.
Add from photos takes 1–8 images of the same tattoo. It decodes them sequentially, reports per-image failures and lets the user choose a photo. Default is Keep original, initially the first decoded photo. Other paths are Automatic cutout, Edit cutout and Combine angles · Beta when multiple images were supplied. The user may preview the suggested photo after automatic processing. It does not silently switch the selected photo.
Batch placement offers manual placement or a preset area. With an area, it previews the tattoo as existing ink and locks placement when saved. Manual placement starts planned. Batch imports retain the decoded original photos as artwork references. The external ChatGPT helper copies a prompt and opens ChatGPT for a manual handoff. The app’s old paid isolation endpoint returns 410.
The editor offers drag crop or exact pixel edges, trim transparent edges, erase, restore, pan, zoom 1–4× in half steps, Fit, Original comparison, and transparency/white/charcoal/warm-skin backdrops. Brush diameter is 5–180 px, default 45, with Pencil pressure and an optional Pencil-only switch. Contrast is −100 to +100. Manual background removal has a preview and a 0–50 strength control. Restore source photo is undoable. The editor has its own ten-step undo stack and redo. Pencil hover can show a brush cursor without editing.
Art input caps are 10 MiB, 24 million decoded pixels and aspect 0.05–20. Names initially use up to 100 characters from the filename. The canvas supports 30 items and the artwork library 120.

Placement, layers and references

Select from the tray or tap visible ink. Hit testing considers alpha and surface depth. Repeated taps can cycle overlapping items. Selecting placed ink frames it with an eased camera move and returns to the neutral pose. The sheet offers Edit tattoo, Notes & drawing and View options.
An unlocked selected tattoo can be dragged directly by touch. Two contacts beginning on it can scale and rotate it. A background-start touch orbits, and two background contacts pan by midpoint and zoom by separation, including during placement editing. Gesture ownership starts with the first contact. A cancelled ink drag drops its provisional preview. A completed drag records one change. Pencil hover does not commit or move a placement.
A placement draft supports initial contact placement, Change body area, screen-axis nudge buttons, exact or slider width, 1/2/3/4-inch buttons, rotation, opacity, Mirror artwork, Wrap, Bend, Taper, optional on-canvas move/size/rotate handles, reset transforms, compare draft against saved ink, Save and Cancel. A draft with changes prompts before leaving. The durable backup and account snapshot contain committed placements.
Rename, duplicate, remove with confirmation, choose Planned or Existing, and lock/unlock placement. Existing ink defaults to locked. An independent duplicate becomes a new unplaced planned item.
Manage ink opens the Layers workspace. Each placement can hide/show, lock/unlock, solo, raise/lower, detach shared artwork and leave a group. There is multi-select, clear selection, clear solo, named groups with collapse and group select/hide/lock/solo, plus group nudges, grow 10%, shrink 10% and rotate 15°. Group transforms require at least two placed, unlocked items and abort the whole change if a member cannot be reprojected. Up to 50 groups.
The artwork library supports Place linked and Independent copy. Artwork edits propagate across linked placements and layouts. Placement position and transforms stay per instance. References show the original source, accept up to eight JPG reference images resized to a 680 px edge, allow individual removal, and provide shared artist notes up to 3,000 characters. Up to 120 artwork boards.
Undo/redo covers project edits and has a separate stack during a placement draft. Project history keeps up to 20 prior states, draft history up to 30. Layout or project switching starts fresh history. Keyboard shortcuts include Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl/Cmd+Y. Escape closes controls or exits the active draft/review as appropriate.

Views, poses, alternatives and versions

Full body and double-tap empty canvas return to front overview. View options offers front, back, left, right and upper-body angles, and a separate portrait close-up for saved portraits. Mouse drag orbits and wheel zooms. The viewport shows an approximate one-inch bar at camera focus depth.
View options offers All ink, Existing ink and No ink, Dim existing ink, clear solo, and named camera bookmarks. Up to 24 bookmarks. A bookmark stores camera position, target and up vector. Clean review removes editing overlays and allows previous/next through bookmarks or built-in angles. The pose picker includes still poses, movement loops and area studies. Loops have play/pause, ½×, 1× and 1½× speed and a scrubber.
Alternatives branch the current planned placements into a named layout. Existing ink remains shared across layouts. Each layout keeps planned placements, visibility and order. Compare two alternatives with side-by-side or a draggable wipe using the same camera and pose. A placed planned design can generate 2/3/4-inch alternatives as a three-way study. There are 20 layout slots total, and a study needs three free slots.
Save named or automatically numbered checkpoints of planned placements and order, with timestamp and source layout. Restore replaces the active layout’s planned ink, keeps current existing ink, and creates new placement and artwork IDs for the restored planned set. It copies associated boards where available. Restore is undoable. Up to 12 checkpoints.

Markup and sketching

Notes & drawing lets the user place a body note, draw directly on the model or measure between two points. Markup is scoped to a layout. Notes have edit/delete, drawings have clear-with-confirmation, and visibility can be toggled. Clear drawings keeps text notes. The limit is 180 marks per project, 220 points per mark and 240 characters per note.
The two-point measurement tries a sampled surface path for nearby points with compatible normals and falls back to straight-line distance if the path is unreliable. Body guides and optional snap assist placement. Guides, marks and direct surface interaction are designed around the neutral view.
Sketch on a body area opens a local 768 × 768 patch. Pick one of the body regions, draw with pressure-sensitive Pencil or touch, toggle the approximate existing-ink overlay and undo strokes or the imported base. Cancel prompts before discarding edits. The drawing clips to the patch. With WebGL unavailable it can still load the patch for sketching and file exchange. Applying it to the body requires working 3D.
Return artwork from Procreate as a full-size transparent PNG. Reject wrong dimensions, empty images, fully opaque backgrounds or visible pixels outside the patch. Apply as placement draft creates a planned item with the same patch anchor and preserves the source project.

Projects, saves and sharing

The project-name button opens Projects, with the current project, archived local projects, New project, Rename current, Import backup and Account snapshots. The local shelf supports 20 projects including current. Restore reviews the name and placement/layout counts before opening a separate copy with a new ID.
Share opens four cards: Send this view, Artist sheet, Sketch in Procreate and Back up project. Prepared image, artist and guide cards show previews. Backup uses an icon. The sketch card suggests a nearby area for selected placed ink, with an explicit area picker. It produces a guide PNG. The complete sketch editing and return workflow remains in the drawing tool.
Native file sharing is used only when canShare({files}) accepts that exact file. Otherwise the app offers download and, for image/HTML files, open. Cancel keeps the file available and never triggers an automatic download. The app reports the handoff without claiming the destination saved the file.
BODY, FIT AND POSES

Mesh contract

body.json is Original, serialized as standard. The UI has no separately labeled Female preset. Use Original for v47 parity. body-male.json is Male, serialized as male. Both are indexed MakeHuman hm08-derived body-only meshes under CC0. Each has 13,380 vertices and 26,756 triangles. The files contain flat positions and indices arrays. Generate smooth normals at runtime.
Male applies the CC0 universal-male-young-averagemuscle-averageweight target at weight 1 and the African, Asian and Caucasian male-young targets at one-third each, then normalizes height. Reuse the supplied meshes for exact geometry and shared index ordering.
Y is up. The floor is Y=0 and crown Y=1.8. +Z faces forward and +X is the subject’s left. The model is centered laterally and stands in a relaxed A-like pose, arms angled down and outward and legs slightly apart. Neutral pose is the original vertex buffer with all pose parameters zero.
Exact bounds in model units:
Plain text
X range Y range Z range
Original -0.536221 to +0.536221 0–1.8 -0.109714 to +0.347349
Male -0.589046 to +0.589046 0–1.8 -0.103994 to +0.392410

Fit math

All breadth/depth/face sliders have neutral value 1. Relief defaults to 0. Fit clones the mesh, keeps its indices, and recomputes normals and bounds. In the following formulas, band(v,c,r) = 1 − smoothstep(0,r,abs(v−c)), and e = abs(x).

Plain text
Parameter Range Deformation
shoulders .86–1.14 X breadth band (y 1.43, radius .13), plus outer shoulder blend
chest .82–1.18 X breadth band (1.34, .14)
waist .80–1.20 X breadth band (1.10, .19)
hips .86–1.14 X breadth band (.93, .16)
depth .84–1.16 Z scaling weighted by torso blend
abs 0–1 Front Z relief up to .010 across three abdominal bands
back 0–1 Rear Z relief down to −.014 across upper back
faceLength .94–1.08 Lower-face Y scales around 1.68
cheeks .90–1.10 Front cheek X breadth at (1.655, .046)
jaw .88–1.12 Front jaw X breadth at (1.595, .045)
nose .85–1.15 Local nose Z displacement, coefficient .048
Torso applies only for Y≥.73 and e≤.34. Its weight is (1−smoothstep(.17,.30,e)) × smoothstep(.74,.96,y) × (1−smoothstep(1.43,1.53,y)). Multiply X by 1 + torsoWeight × sum(breadth bands × (slider−1)) + .45 × shoulderBlend. Shoulder blend uses band (1.43,.10) with inner .14–.22 and outer .24–.34 tapers. Multiply Z by 1+torsoWeight×(depth−1), then add relief. Front relief uses smoothstep(.058,.12,z), lateral band (.044,.051) and Y bands at 1.20,1.13,1.06, radius .04. Back relief uses 1−smoothstep(−.09,−.045,z) and bands (y,1.34,.18) and (e,.10,.095).
Face applies above Y=1.53. Front weight is smoothstep(.055,.13,z). The lower-face band is (1.611,.078). Nose uses Y band (1.64,.047), centerline band (e,.002,.031) and smoothstep(.11,.16,z).
Body references accept JPEG, PNG or WebP up to 24 MiB and 24 MP. Mark crown, floor, then left/right shoulders, waist and hips as viewed in the image. Crown-to-floor must cover at least 40% of image height. The width pairs must be ordered, nearly level and descend down the body. Normalize pair width by image aspect and marked height, then compare against .55/.28/.34 reference breadth at height 1.8. Reject raw ratios outside .65–1.45. If two photos disagree by over 15% on any breadth, require correction. Average usable ratios and clamp to slider limits. Estimate shoulders, waist and hips only.

Rendering and pose model

Three.js perspective camera FOV 34°, near/far .01/20, front overview near (0,1,3.55) looking toward (0,.94,0), zoom distance .55–4.5. Antialiasing and preserved drawing buffer are enabled. Device pixel ratio is capped at 2. Use sRGB output, ACES filmic tone mapping at 1.15 exposure, a charcoal stage, floor disk and ring, and hemisphere/key/rim lights. Body is matte, roughness .88, metalness 0. The skin slider interpolates RGB across these stops:
Plain text
#f3dac6 #e5c2a5 #cca184 #bb8f72 #966649 #70472f #462d22 #281a15
v47 retains the supplied mesh anatomy. It uses a solid material without a skin-detail texture by default. For saved portraits, the shader projects a feathered front crop around the face and can blend an optional side crop. The optional hair:true flag adds a separate procedural auburn shell and lock geometry. The app retains portrait rendering compatibility and does not generate a new portrait from body-reference photos.
Pose deformation runs in the vertex shader without a skeletal rig. Use a triple [lift,reach,elbow] per arm and [leftHip,rightHip,twist,hinge,leftKnee,rightKnee] for the core. Angles are radians. Shoulder and elbow anchors are approximately (±.215,1.423,.013) and (±.356,1.249,.028). Apply weighted elbow flex and biceps relief, then shoulder reach/lift with a blended shoulder cap. Bend legs around Y/Z knee and hip pivots (.50,.024) and (.92,0), twist/hinge the torso gradually, and compensate vertically for the lower foot. Estimate deformed normals using finite differences in local tangent directions. Body, hair and tattoo shaders share the same pose parameters. Transitions blend over about .27 seconds. Motion loops smoothstep between cyclic keyframes.
Plain text
Still poses
Neutral; Arms lifted; Double biceps; Reach forward; Overhead stretch;
Open arms; Left/right arm forward; Left/right biceps flex; Boxing guard;
Chest opener; Torso turn left/right; Side reach; Hip hinge; Squat preview;
Single knee lift; Chair seated; Left/right shoulder lateral, forward,
overhead and behind body; Left/right bicep flexed; Stride stance.

Motion loops, seconds per cycle
Sit and stand 4.8; Arm warm-up 2.8; Biceps curl 2.5; Lateral raise 2.8;
Overhead press 3.0; Reach and return 2.7; Alternating arm swing 2.4;
Overhead wave 2.5; Chest opening sweep 3.2; Alternating torso turns 3.8;
Alternating punches 2.8; Squat and stand 3.6; Hip hinge and return 3.3;
March in place 2.8; Walk in place 2.3; Jumping jack arms 2.1;
Slow stretch sequence 5.8.

Studies, with camera and pose paired
Knee: standing front/side, seated looking down, seated bent side, sit-to-stand side.
Back of shoulder: arm down, lifted sideways, forward, overhead, behind.
Bicep: relaxed and flexed.
Hip/glute: standing and seated rear three-quarter.

Studies mirror camera X and choose the corresponding pose side using selected placement X. They are visualization presets. Elbow shape and skin movement remain approximate.

PLACEMENT MATH

Store an anchor as a position and outward normal in Original’s neutral mesh coordinates. Raycast the displayed body for a touch or preset. When the displayed geometry is Male or fitted, use the hit triangle’s shared index and barycentric coordinates to map the hit back to Original. In the other direction, find the closest Original triangle, calculate barycentrics, then interpolate the corresponding target vertices and target vertex normals. Reproject the decal after a shape change. Width remains in model units. An unplaced item has both vectors null.

Plain text
Default new width .14 model units
Allowed width .025–.35
Tattoo height width / aspect
Rotation signed degrees, −180…180, about projector normal
Opacity .10–1
Wrap / Bend / Taper 0–1 / −1…1 / −.75…+.75
Mirror U becomes 1−U; anchor and camera stay put
Reference height 180 / 2.54 inches
Displayed width width / 1.8 × user height or reference height
Entered inches inches / height × 1.8, clamped to width bounds
Height input 36–96 inches
Weight input 50–700 pounds; saved as context, no geometry effect

Projection paths:

Standard planar decal. Orient local +Z onto the surface normal, then apply local rotation. Clip candidate triangles with a width × height × .16 projector box. Use a cached triangle bounds scan to narrow candidates. Reject triangles whose average normal dots the anchor normal below .12. Offset resulting vertices .00035 along their normals.
Warped decal. For other areas with nonzero wrap, bend or taper, project nearby triangles to local coordinates. Blend planar X toward atan2(x,z+radius) × radius using Wrap, with radius clamp(.57×width,.046,.15). Bend offsets local Y quadratically across the width by .35×width×bend. Taper multiplies width by 1+taper×clamp(2y/height,−1,1). Reject faces outside the depth/normal envelope, clip to the UV square, triangulate and apply the same skin offset.
Connected skin walk. Use for qualifying arms, posterior shoulders and knees with decal height below .45. Use a stable world-up tangent where possible. Start in the center, walk up/down the centerline, then across each row with short rays along the previous normal. Use columns 2×ceil(clamp(width/.014,5,22)), rows 2×ceil(clamp(height/.018,4,20)), and a .027 spatial grid for triangle lookup. Require forward-facing hits, step distance within 1.55×step+.002 and normal dot at least .70. Retry tight bends using two half-steps. Recover missing row segments vertically only where the neighbor and orientation checks still pass. Reject folds and oversized edges. Try the other cell diagonal if it produces more valid triangles. Wrap expands arc width by up to 15%. Emit .0013 normal offset and carry the three support triangle vertices plus barycentric weights per decal vertex.

During poses, regular decals use the same point deformation as the body. Connected decals interpolate the three posed triangle vertices, then preserve the small difference between the posed decal vertex and its rest-surface point. This keeps the ink attached through bending. Render transparent, rough decals with alpha test .015, polygon offset, no depth write, and stable layer order. The canvas picks the visible alpha near the front body intersection. Direct placement hit testing uses neutral geometry, so v47 restricts direct ink manipulation to the neutral pose.

Body-area presets are Original surface rays from front or rear. Width is max(.025,min(areaWidth,.22×aspect)), rotation 0. The complete selector has left/right chest, stomach, upper/lower back, and left/right variants of rear shoulder, front/rear upper arm, front/rear forearm, glute, front knee, front thigh, rear calf and front shin.

PORTABLE BACKUP FORMAT

A .ink.json backup is UTF-8 JSON, maximum 256 MiB. The wrapper deduplicates image data URLs. Traverse the project recursively and replace a data URL occurring under image, images, source, mask, or originalPhoto with ink-atlas-image:N. The index is zero-based into assets. Decode expands these references only in those fields. Reject missing or invalid references. Accept legacy unwrapped version:1 project JSON too.

Plain text
Wrapper
format: "ink-atlas-portable"
project: ProjectV1, with eligible image strings replaced by asset references
assets: up to 2,400 PNG/JPEG/WebP base64 data URLs, each ≤12,000,000 characters

ProjectV1
version: 1
skin: six-digit #RRGGBB
figure?: "standard" | "male"; absent on legacy import defaults to "standard"
measurements?: {heightInches?: number, weightPounds?: number}
tattoos: Tattoo[]; active canvas, at most 30, IDs unique in each validated list
studio?: Studio; absent on legacy import is filled by the application

Tattoo
id: placement identity
name: display name, at most 120 characters
image: PNG/JPEG/WebP data URL, at most 12,000,000 characters
aspect: image width/height, .05–20
width, rotation, opacity: the model-unit and degree values above
status: "planned" | "existing"
position, normal: null/null or two finite XYZ triples
artworkId?: shared source ID; if absent use the tattoo ID
groupId?: placement group ID
hidden?: visibility toggle
layerLocked?: explicit layer lock
placementLocked?: explicit placement lock override; existing defaults locked
flipX?: horizontal UV mirror
wrap?, bend?, taper?: optional numeric controls above; missing means zero
cleanup?: Cleanup

Cleanup
source: full-size working PNG before crop/mask/contrast
originalPhoto?: PNG source for Restore source photo
mask: PNG edit mask at the working source size
crop: {x,y,width,height}, integer source pixels, positive extent within 1,600²
contrast: −100…100
Cleanup images are PNG data URLs, each ≤12,000,000 characters.

Studio
id, name: project identity and display name
activeLayout: ID of one entry in layouts
layouts: up to 20 unique-ID Layout objects
artworks: up to 120 unique-ID Tattoo-shaped artwork records; legacy may omit
groups: up to 50 {id,name}
views: up to 24 {id,name,camera:{position,target,up}}
versions: up to 12 {id,name,date,layoutId,planned,order?}
boards: up to 120 keys by artwork identity, values {notes,images}
marks: up to 180 {id,layoutId,color,points,text?}
bodyFit?: BodyFit

Layout
id, name
planned: Tattoo[], at most 30; only planned entries participate
order?: ordered placement IDs, at most 30, may interleave existing and planned
study?: {series:string,inches:2|3|4}; connects the three study variants

Version
date: creation timestamp, emitted as ISO
layoutId: source layout
planned, order: checkpoint of planned ink and ordering

Board
notes: up to 3,000 characters
images: up to eight PNG/JPEG/WebP data URLs, ≤2,500,000 characters each

Mark
color: #RRGGBB
points: up to 220 {position:[x,y,z],normal:[x,y,z]}
text?: note up to 240 characters; absent means a drawing

BodyFit
shoulders,chest,waist,hips,depth,abs,back: required when a fit is present
faceLength?,cheeks?,jaw?,nose?: optional; missing means neutral
faceTexture?: {image,crop,side?,hair?}
image: PNG/JPEG/WebP data URL, ≤4,000,000 characters
crop and side: normalized [left,top,width,height] in the same image,
positive size and wholly inside [0,1]²
hair: omit or literal true

Studio names and IDs are nonblank, generally up to 120 characters. UI creation commonly caps names at 100. Tattoo position/normal components must have absolute value below 10, and a placed normal must have length above .5. Studio vectors generally cap absolute components at 12, with camera up and markup normals capped at 2. Camera up must be nonzero and target cannot coincide with camera position. Validate the whole document before replacing any working state. Reconstruct missing artwork-library entries from tattoo records in the current canvas and layouts. On export, update the active layout’s planned list and order to reflect the current committed canvas.

Minimal example in the real format. Replace PNG_BASE64 with actual encoded PNG bytes before importing.

JSON
{
"format": "ink-atlas-portable",
"project": {
"version": 1,
"skin": "#bb8f72",
"figure": "male",
"tattoos": [
{
"id": "test-ink",
"name": "Sample design",
"image": "ink-atlas-image:0",
"aspect": 1,
"width": 0.14,
"rotation": 0,
"opacity": 0.9,
"status": "planned",
"position": null,
"normal": null
}
],
"studio": {
"id": "sample",
"name": "Sample plan",
"activeLayout": "main",
"layouts": [{"id": "main", "name": "Main layout", "planned": [], "order": ["test-ink"]}],
"artworks": [],
"groups": [],
"views": [],
"versions": [],
"boards": {},
"marks": []
}
},
"assets": ["data:image/png;base64,PNG_BASE64"]
}

Local storage is IndexedDB ink-atlas-studio, version 1, object store projects. Keys are current, placementDraft, archiveIndex, and project:<id>. Save the current committed project and draft changes atomically. Switching archives the outgoing project and activates the incoming one in one transaction. A failed write or cancelled restore preserves the current project. Undo stacks, current camera unless bookmarked, active pose, compare mode, and UI visibility are session state.

CUTOUTS
Use MediaPipe Tasks Vision 0.10.32 and the bundled MagicTouch float32 v1 .tflite plus /vision/ WASM. The interactive segmenter is cached, initialized in IMAGE mode on CPU, category mask off and confidence masks on. Prompt with a single normalized center point (.5,.5). Take the first confidence mask, nearest-neighbor expand it to source dimensions, and close the result. A failed model initialization is retryable.
Batch photos are resized to maximum edge 800. If more than 5% of pixels have alpha below 128, use the existing transparent art. Otherwise threshold the mask above .65. Reject foreground below 8% of the canvas. Compute grayscale .299R+.587G+.114B, blur separably with [1,4,6,4,1]/16, then estimate illumination by max followed by min filtering at radius max(8,round(maxEdge×.04)). Erode the foreground by max(2,round(maxEdge×.009)).
Make pixels RGB (18,20,22) and set alpha to source alpha times interior mask times clamp((background−blurredGray−8)/max(15,.6×background),0,1). Reject if fewer than max(30,.001×pixelCount) pixels exceed .12 inferred alpha. The suggestion score is (inkCount−.2×noiseCount)/foregroundCount. Trim to alpha above 8 with a two-pixel pad. Preserve original PNG, full cutout source, white edit mask and crop.
Manual removal uses the crop’s 80th luminance percentile as an estimate of bare skin, a user-controlled threshold and dark-ink alpha. Apply contrast and the brush mask nondestructively against the working source. Erase/restore paint continuous softened strokes. Reapply edits through the stored source/mask/crop.
Combine angles ranks usable cutouts, normalizes each longest side to 48 pixels on a 64² mask, and thresholds alpha at 95. Search rotation, scale and translation for mutual overlap, penalizing extreme transforms. Coarse acceptance is .29, refined acceptance .58. Composite accepted angles behind the best reference on a 1,280² intermediate, then crop to visible alpha. Require two matched photos. This is 2D alignment, with no camera calibration or curved surface reconstruction.
EXPORTS
Send this view: <project-slug>-view.png. Captures the rendered canvas including the current angle, ink visibility and any active comparison. Pixel size is the current canvas CSS dimensions times the renderer’s pixel ratio capped at 2. The app’s chrome and sheets are excluded. Rendering overlays that are visible in the scene can appear. Missing or failed visible textures block capture with a retry message. The prepared file is the one handed to Share.
Artist sheet: <project-slug>-artist-sheet.html. Self-contained, responsive and printable HTML, max body width 1,040 CSS px. Header shows project, layout and calibrated/reference scale. Placement view gallery has front, left, right, back, and upper-body detail. If comparing, prepend the comparison with A/B or A/B/C layout names. Captures use the same viewport-sized renderer. The size table includes placed, nonhidden designs, approximate width × height to one decimal, type and linked artwork notes. Artwork gallery deduplicates by artwork identity and offers source image downloads. Active layout text body notes appear separately. Inline images, escaped project text, restrictive CSP, no required network assets. Browser print-to-PDF is available through the opened HTML where supported.
Sketch in Procreate: <area>-drawing-guide.png, 768 × 768. Opaque warm-gray canvas, pale mapped patch, dashed crosshair, border, orientation label and approximate width. Patch outline comes from the decal UV triangles mapped into square pixel coordinates. The share card contains the guide alone.
Inside the sketch tool: <area>-guide.png, <area>-existing-ink.png, <area>-artwork.png, each 768 × 768. The second is a transparent, clipped tangent-view reference of nearby existing ink. The third is transparent drawing/imported artwork only. In Procreate, import the guide, insert the reference as a separate layer if needed, draw on another layer, then hide guide/reference/background before returning the full square PNG.
Back up project: <project-slug>.ink.json, complete committed portable project with artwork. No raster dimensions. Draft is excluded and remains open. Snapshot uses the same committed payload. Filename slug is lowercase with punctuation runs replaced by hyphens.
Check file-level sharing support, invoke native Share from a user tap, and keep the prepared File for fallback or retry. HTML or JSON can be rejected by platform sharing. Procreate appears only if the OS offers it. Files fallback is a browser download/open workflow. Blob URLs are revoked after a delay so the browser can consume them.
ACCOUNTS

Local editing needs no sign-in. Account snapshots opens a private-copy dialog, checks the Sites session and offers Sign in with ChatGPT via /signin-with-chatgpt?return_to=%2F if needed. Sign-in leaves the view. The client warns about finishing a draft first.

(The capture above was cut here. The remaining sections are summarised below from the same reply.)

ACCOUNTS, continued
- The server trusts the identity supplied by the hosting layer. Each explicitly saved portable payload is stored in Cloudflare R2 under account-projects/<encoded-owner-id>/<snapshot-id>, display name as metadata, UUID ids, 16 MiB limit, responses private/no-store.
- List returns up to 50 rows per page: id, name, uploaded timestamp, cursor. Opening a snapshot runs the same review and restore-as-copy path as a file.
- Client status is session-scoped: no snapshot confirmed / this exact revision confirmed / current edits newer than the confirmed snapshot.
- v47 has manual snapshots only: no automatic sync, no conflict resolution, no snapshot-delete UI.

FILE MAP (app code only; the source also carries ~60 unused UI primitives under components/ui)
 1034 app/page.tsx                  Workspace state and user-facing workflows
  600 app/globals.css               Styles
   74 app/api/account-projects/route.ts  Authenticated R2 snapshot API
   94 components/account-projects.tsx    Sign-in, snapshot list, save and open
  112 components/batch-import.tsx        Photo batch selection and cutout workflow
  136 components/body-fitting.tsx        Landmark editor and body-fit preview
   61 components/file-export-dialog.tsx  File sharing, open and download fallback
   25 components/markup-panel.tsx        Notes, drawings and measurement controls
  233 components/photo-editor.tsx        Crop, brush, contrast and cutout editing
  165 components/region-sketch.tsx       Patch drawing and Procreate exchange
   89 components/studio-tools.tsx        Layers, alternatives, projects and references
   94 lib/angle-stitch.ts           2D photo overlap alignment and blending
  160 lib/arm-decal.ts              Connected skin-walk projection
   33 lib/artist-export.ts          HTML artist sheet and capture guard
   49 lib/automatic-ink.ts          Foreground-aware black ink matting
   29 lib/body-areas.ts             Region coordinates and surface anchoring
  113 lib/body-fit.ts               Reference landmarks and mesh deformation
  192 lib/body-pose.ts              Pose tables, interpolation and shader
   65 lib/file-export.ts            Capture readiness and browser file actions
   22 lib/local-segmenter.ts        MediaPipe model and mask lifecycle
   44 lib/photo-cleanup.ts          Crop, mask, contrast and luminance matting
   38 lib/portable-project.ts       Image deduplication and backup decoding
  107 lib/project-storage.ts        IndexedDB project, shelf and draft storage
  127 lib/region-sketch.ts          Patch geometry, outline and reference raster
  144 lib/studio-document.ts        Document schema, artwork links and layouts
  929 lib/studio.ts                 Three.js rendering, controls and capture
  165 lib/tattoo.ts                 Tattoo validation, decals and anchor transfer
   57 lib/warped-decal.ts           UV warp and projection clipping
  861 scripts/verify.mjs            Aggregate geometry, format and feature tests
  public/models/body.json, body-male.json   Meshes (CC0, MakeHuman hm08-derived)
  public/vision/magic-touch.tflite + wasm   MediaPipe interactive segmenter assets
The full v47 source is downloadable from the ChatGPT thread Outputs as ink-atlas-v47-source.tar.gz.

OPEN REQUESTS (per the v47 thread)
- Body realism: a simplified artist-facing mannequin, skin-like ink finish, faithful body shape and better elbow deformation were still open.
- Procreate: direct launch, guaranteed Files delivery and a verified iPad round trip were still open.
- Photo understanding: robust colour reconstruction, anatomy detection, automatic body placement and true multi-angle wrapping were never built.
- Accounts: live sync, merges and recovery from another device were never built.

WHAT THE V47 THREAD WOULD DO DIFFERENTLY
Build a small versioned document core first; separate artwork assets from placement transforms; give import, editing, gestures and file preparation explicit state transitions; use one surface adapter for hit testing, decals, pose deformation and guide export. Test the first complete workflow on iPad before widening scope: import, place, orbit during an edit, undo, send a view, restore as a copy. Keep fixtures for v47 backups, overlapping layers, curved-arm ink and a blocked share sheet.
