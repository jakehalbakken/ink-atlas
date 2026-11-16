# How the app is laid out

Jake, 2026-11-15: "we have gone absolutely overboard on the tools and features. They need a massive organization and design haul." This is the structure every panel follows from now on. Ids stay the same, so tests and New to try keep working; only where things sit and how they look changes.

## The main screen

Only four things float over the body:

1. **Top bar, left:** the Ink Atlas mark with the save state under it, and a small New pill while any feature is untried, with a badge counting only what came in since the list was last opened.
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

## Design audit against Apple's iPad guidelines (2026-11-16)

Jake, 2026-11-15 22:42Z: "Imagine you're designing an apple native app. It should feel flawless." This is the audit of every surface against Apple's Human Interface Guidelines for iPadOS, what is wrong today, and the order it gets fixed in. The structure above stays; this is about how it looks, moves and reads.

### What is already right

- One full-screen canvas with chrome floating over it, like Freeform or Reality Composer. Keep it.
- One gesture grammar that never changes by mode. Keep it.
- 44 pt targets everywhere (t114 checks it at five sizes), light and dark from one set of tokens, safe-area padding, Reduce Motion for camera moves.
- One primary button per place, plain words, each tool in one home.

### What is wrong, by guideline

**Navigation model.** Four kinds of surface exist but they are not used by rule: popovers (`.pop`), centred modals (`.modal` in `.scrim`), mode bars under the top bar, and full-screen tools (Ink check, Try on, Real size). Rule from now on:
- A *menu* (Preview) is a short single-column list anchored to its button, each row an icon and a word, with a check mark beside whatever is on. Today it is a two-column grid of words with no icons and no state.
- An *inspector* (Body, Pose, Light, Clothes, Aging, the edit sheet) is a popover or the right-hand column, live, with no Cancel: changes apply as you go and Done closes it.
- A *sheet* (Share, Plan, Procreate, Projects, accounts) is a centred form sheet with a title, a Done at the top right, and grouped rows.
- A *mode* (tape measure, pain map, open skin, comments, paint) is a slim bar under the top bar with what to do and a Done.
- *Full screen* only for camera, ink check and real size.

**Naming.** Seven sheets close with Close and nine panels with Done. Apple uses Done for anything that is not cancelling a change. All become Done.

**Materials.** In dark, `--fill` is defined as itself, so it resolves to nothing and every plain button in dark has an outline and no fill; in light they have a fill. Fix the token. Glass (`.glass`) is right for floating chrome; sheets should be the thicker, more opaque material, and rows inside sheets sit on grouped-inset cards, not outlined boxes.

**Type.** The body face is Figtree from Google Fonts: it is not the system face, it needs the network on first open, and it is the single biggest thing that makes the app read as a web page. Use the system face (San Francisco on the iPad) for everything except the Ink Atlas mark; keep Figtree only as the fallback where there is no system face. Scale, matching Apple's iPad text styles: Title 2 22 (sheet titles), Headline 17 semibold (panel titles, row titles), Body and Subheadline 15 (buttons, rows), Footnote 13 (row descriptions, tips), Caption 12 (section headings, badges).

**Icons.** Toolbar buttons have glyphs; nothing else does. Apple rows lead with a glyph so the eye can find a row without reading. Share, Plan and Procreate rows, Preview menu rows and the edit sheet's quick actions all get a leading glyph in the same stroke style as the toolbar.

**Motion and feedback.** Panels, menus and sheets appear and vanish with no movement at all, and buttons give no sign of a press beyond a colour change. Apple's feel comes from short springs: a popover grows out of its button, a sheet rises, the dimming fades, a pressed button dips to 97%. All of it 180 to 260 ms, interruptible, and off with Reduce Motion. The web has no haptics on the iPad, so the press dip is the stand-in.

**Badges.** New to try shows 102. A badge that large is noise: Apple badges count things to act on now. The badge counts only what shipped in the last week and is still untried; the list puts those first under This week and the rest under Earlier.

**Instructional text.** "Tap a tattoo to work on it. Double-tap empty space for the full body." sits on screen forever, and the edit sheet carries a permanent "Drag the tattoo to move it..." line. Apple apps teach once and then get out of the way. Each shows until it has been followed once on this device.

**The edit sheet.** Four quick actions are equal outlined boxes in a grid with no glyphs, and Add reference pictures sits alone above them. They become one row of icon-over-word actions (like the share and edit actions in Photos). Sliders show no value while you drag them; size and turn should say the number.

**Lists inside sheets.** Share and Plan are grids of outlined cards whose descriptions run to four lines. Apple's pattern is a grouped inset list: a glyph, a title, one short line under it, a chevron for anything that opens more. Descriptions are cut to one line each.

**Empty states.** With nothing on the body, a single line and Upload tattoo. It should say what the app is for in one line, offer Add tattoo and Draw in Procreate side by side, and show nothing else.

**Landscape framing.** In wide landscape the right-hand column covers a third of the screen but the full-body view is centred on the whole screen, so the body sits against the column. The overview should centre in the space left of it.

### Stages

1. **Foundations.** Fix the dark fill; system face; Done everywhere; springs for every popover, menu, sheet, bar and press, off with Reduce Motion; the Preview menu as a single-column list with glyphs and check marks; New to try badge for this week only; hints that go once followed.
2. **The edit sheet.** Quick actions as one row of glyph actions; size and turn values while dragging; More controls sections as grouped rows.
3. **Sheets as lists.** Share, Plan and Procreate as grouped inset lists with glyphs and one-line descriptions; the accounts thread restyles its own panels onto the same classes (`.list`, `.list-row`).
4. **Framing and first run.** Landscape overview centred beside the column; the empty state; the first-run card in the same visual language.

Each stage ships on a green suite with its New to try entry.

## For the accounts thread

Keep your panels inside `.modal` or `.pop` and use the shared classes (`.btn`, `.btn.primary`, `.card`, `.shHead`, `.tip`, `.row`) and the colour variables (`--surface`, `--fill`, `--line`, `--text`, `--muted`, `--accent`) rather than fixed colours, so they pick up light and dark. Your top bar buttons (`#showSpotBtn`, `#hereNow`, `#accountBtn`) stay in `#top .toolbar` at its end. No accounts logic changes here.
