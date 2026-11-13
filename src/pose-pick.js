// Which poses show a tattoo best: from the bones that move the skin under it. An arm tattoo
// gets that arm flexed, overhead and reaching forward; a leg tattoo the knee up, a squat and a
// stride; a torso tattoo arms overhead, a turn and a stretch that pulls on that side. Pure maths,
// no three.js, so it can be checked on its own.

const ARM = /^(clavicle|shoulder01|upperarm0[12]|lowerarm0[12]|wrist|finger|metacarpal)/;
const LEG = /^(pelvis|upperleg0[12]|lowerleg0[12]|foot|toe)/;
const HEAD = /^(neck0[123]|head|jaw)$/;

// bones: [name, weight] pairs (summed over the skin under the tattoo). front: true when the
// tattoo faces forward. Returns { region, side, keys } with four catalog keys, standing first.
export function posesFor(bones, front = true) {
  const sum = { armL: 0, armR: 0, legL: 0, legR: 0, head: 0, torso: 0 };
  for (const [name, w] of bones) {
    const side = name.endsWith('.L') ? 'L' : name.endsWith('.R') ? 'R' : '';
    const base = name.replace(/\.[LR]$/, '');
    if (side && ARM.test(base)) sum['arm' + side] += w;
    else if (side && LEG.test(base)) sum['leg' + side] += w;
    else if (HEAD.test(base)) sum.head += w;
    else sum.torso += w;
  }
  const best = Object.entries(sum).sort((a, b) => b[1] - a[1])[0][0];
  if (best === 'armL') return { region: 'arm', side: 'L', keys: ['neutral', 'leftBiceps', 'overheadLeft', 'leftForward'] };
  if (best === 'armR') return { region: 'arm', side: 'R', keys: ['neutral', 'rightBiceps', 'overheadRight', 'rightForward'] };
  if (best === 'legL') return { region: 'leg', side: 'L', keys: ['neutral', 'kneeLeft', 'squat', 'stride'] };
  if (best === 'legR') return { region: 'leg', side: 'R', keys: ['neutral', 'kneeRight', 'squat', 'stride'] };
  if (best === 'head') return { region: 'neck', side: '', keys: ['neutral', 'twist', 'turnRight', 'hinge'] };
  return { region: 'torso', side: '', keys: front ? ['neutral', 'raisedBoth', 'twist', 'chestOpener'] : ['neutral', 'raisedBoth', 'twist', 'hinge'] };
}
