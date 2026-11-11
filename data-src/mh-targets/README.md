# MakeHuman shape targets

77 `.target` files copied unmodified from the official MakeHuman repository,
`github.com/makehumancommunity/makehuman`, branch `master`, folder
`makehuman/data/targets/` (subfolders `macrodetails`, `measure`, `torso`,
`stomach`, `buttocks`, `breast`, `genitals`, `armslegs`). Fetched 2026-11-11.

Each file carries MakeHuman's own header: the assets were released as CC0.

They are build inputs only. `npm run mesh` (tools/mesh.py) bakes the ones listed
there into `src/body.js`. To add a slider: drop the `-decr` / `-incr` pair here,
add it to `PAIRS` in tools/mesh.py and to `FIT_GROUPS` in src/fit.js, then run
`npm run mesh`.
