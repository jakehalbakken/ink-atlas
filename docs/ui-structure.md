# How the app is laid out

Jake, 2026-11-15: "we have gone absolutely overboard on the tools and features. They need a massive organization and design haul." This is the structure every panel follows from now on. Ids stay the same, so tests and New to try keep working; only where things sit and how they look changes.

## The main screen

Only four things float over the body:

1. **Top bar, left:** the Ink Atlas mark with the save state under it, and a small New pill with its count when there are untried features.
2. **Top bar, right:** one toolbar. Undo and Redo as icons, then Body, Preview, Plan, then Share as the one primary button. People here, Point and the account button sit at its end (accounts code owns their behaviour; the toolbar only gives them a slot).
3. **View switcher, top centre:** one segmented control: Full body, Front, Left, Back, Right. Below the top bar on narrow screens.
4. **Bottom dock:** the tattoo tray (Add, Procreate, the tattoo chips), and the edit sheet above it when a tattoo is selected. In wide landscape it stands as a column at the right.

Nothing else floats on the left any more. Panels open from the button that owns them and sit under the top bar at the right (Body, Preview's panels, New to try, Go back to), except Match a photo of me and Try other spots, which stay at the left so the body stays clear beside them. Bars for a mode (tape measure, pain map, open skin, comments, follow, tap to place, paint, Procreate) sit centred under the top bar.

## Where every tool lives, by step of the work

| Step | Place | What is in it |
|---|---|---|
| Bring in art | Tray: Add, Procreate | Upload pictures or backups; the Procreate menu: send the 3D body, bring back drawings as tattoos, draw on one spot, paint controls |
| Place and fit | Body button; edit sheet | Body: figure, match a photo, face, muscle, weight, height, skin tone, hair, beard, body hair, eyes, fine-tune. Edit sheet: see below |
| Look at it | Preview | Before/after, Pose, Clothes, Aging, Light, Tape measure, Pain map, Open skin, Comments |
| Plan the sessions | Plan; edit sheet's Plan section | Plan: projects, layouts and checkpoints, layers and groups, artwork library, saved artwork, reference board, artist notes, body pins, photo references, align and symmetry, New to try |
| Share and approve | Share | Send and approve; pictures; for your artist; Procreate files; keep it safe; other files |

## The edit sheet

Always shown: name, size, Done; the review row on shared projects; one row of quick actions (Tap to place, Clean up artwork, Lock, Edit in Procreate, Reference pictures, Comments).

More controls opens sections, each with a small heading:

1. **Size and shape:** Size, Turn, Ink strength; Precise placement; Bend and taper.
2. **About this spot:** size as an everyday thing, where it sits, what it shows in, how it holds up, how it stretches, straighten, who it reads for, even placement.
3. **Check it:** Ink check, Try other spots, Find room for it, Real size on screen, Try on with camera.
4. **Plan it:** time to tattoo and rate, every sitting in the plan, sittings, versions, note for your artist, who did it.
5. **Copy and arrange:** Mirror, Flip vertical, Duplicate, Copy to other side, Split into designs, Clean up linked copies, Stencil for your artist.
6. **This tattoo:** Planned or already on me, Hide, Remove.

## The Body panel

Figure (Male, Neutral, Female) and Reset to plain body stay at the top. Then sections: **Shape** (muscle, weight, height), **From your photos** (match a photo of me, add my face), **Skin**, **Hair** (style and colour, then Beard and Body hair under their own small labels, then match my hair from a photo), **Eyes**, **Fine-tune each part** (with Reset body shape).

## The older Plan panels

Layers and groups shows its group and selection buttons only once a tattoo is ticked or a group exists. Layouts and saved views shows Compare only with two saved, and Show archived only when something is archived. Words are plain everywhere (no "tangent frame", "chord", "identity"). The full-screen pins and photo tools take the backdrop colour from `--stage-b`, so they follow light and dark.

## Removed duplicates

- Plan > Poses, Plan > Clothes and Plan > Try exact numbers: the same panels are under Preview > Pose, Preview > Clothes and More controls > Precise placement.
- The left-hand Full body, Preview and New to try buttons: now in the view switcher and the top bar.

## Look

- One set of tokens in `src/index.html`: spacing 4, 8, 12, 16, 24; type 12, 13, 15, 17, 22; radii 10, 14, 20; one accent (stencil violet); surfaces, fills and lines as variables, so light and dark are one switch.
- Buttons: one height (44), one radius, icon plus word in the toolbar, words only elsewhere. Primary only for the one main action in a place.
- Light and dark follow the device.
- Sections in sheets and modals use the small uppercase heading (`.shHead`).

## For the accounts thread

Keep your panels inside `.modal` or `.pop` and use the shared classes (`.btn`, `.btn.primary`, `.card`, `.shHead`, `.tip`, `.row`) and the colour variables (`--surface`, `--fill`, `--line`, `--text`, `--muted`, `--accent`) rather than fixed colours, so they pick up light and dark. Your top bar buttons (`#showSpotBtn`, `#hereNow`, `#accountBtn`) stay in `#top .toolbar` at its end. No accounts logic changes here.
