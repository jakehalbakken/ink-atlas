// Pure primitives for app integration. No camera, DOM or tattoo mutations.
export function wrapAngle(angle){if(!Number.isFinite(angle))throw new Error('Angle must be finite');return Math.atan2(Math.sin(angle),Math.cos(angle));}
export function twoPointerMetrics(points){
 if(!points||points.length!==2)throw new Error('Exactly two pointers required');
 for(const p of points)if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('Invalid pointer coordinates');
 const [a,b]=points;return {distance:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};
}
export function twoPointerDelta(previous,current,{minimumSpan=12}={}){
 if(!Number.isFinite(minimumSpan)||minimumSpan<=0)throw new Error('Invalid span guard');
 for(const m of [previous,current])if(!m||![m.distance,m.angle,m.cx,m.cy].every(Number.isFinite)||m.distance<0)throw new Error('Invalid gesture metrics');
 // Fingers crossing/coinciding make angular orientation unstable. Rebaseline
 // these frames in the caller, without an artificial 180-degree camera flip.
 const stable=previous.distance>=minimumSpan&&current.distance>=minimumSpan;
 return {zoomRatio:stable?previous.distance/current.distance:1,rollDelta:stable?wrapAngle(current.angle-previous.angle):0,dx:current.cx-previous.cx,dy:current.cy-previous.cy,stable};
}
export function planTapPlacement(tattoo,hit){
 if(!tattoo||tattoo.locked||tattoo.hidden||tattoo.status==='existing'||tattoo.status&&tattoo.status!=='planned')throw new Error('Choose an unlocked planned tattoo to place');
 if(!hit||!Array.isArray(hit.pos)||hit.pos.length!==3||!hit.pos.every(Number.isFinite)||!Array.isArray(hit.normal)||hit.normal.length!==3||!hit.normal.every(Number.isFinite))throw new Error('Tap directly on the body');
 const length=Math.hypot(...hit.normal);if(length<1e-9)throw new Error('Body hit has no valid normal');
 return {...structuredClone(tattoo),pos:[...hit.pos],normal:hit.normal.map(v=>v/length)};
}
