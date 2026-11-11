# Ink Atlas

iPad-first 3D tattoo placement studio.

## Run it locally

    npm install
    npm run dev          # dev server with hot reload
    # or build + preview the production bundle:
    npm run build
    npm run preview

`open dist/index.html` no longer works on its own: the app is now a real
ES-module bundle, so it must be served over http (the dev/preview servers do
that). Open the URL they print.

## Build and deploy

- `npm run build` writes the production site to `dist/` (three.js and the body
  data are split into their own cached chunks; a PWA manifest and service
  worker are generated so it can be added to the iPad home screen).
- Pushing to `main` deploys to GitHub Pages via
  `.github/workflows/deploy.yml`. The live base path is `/ink-atlas/`.
- `npm run icons` regenerates the PWA icons in `public/` (needs Chrome).
- `npm run shot` serves `dist/` and takes a headless screenshot
  (`tools/tests/*.mjs` are scripted checks: `npm run shot -- out.png tools/tests/t1.mjs`).

## Continue building with Claude Code

Open this folder in Claude Code. `CLAUDE.md` holds the full brief: what exists,
what Jake asked for next, and the order to do it in. `docs/v47-spec.md` is the
written specification of the earlier ChatGPT-built version, used as the feature
checklist.
