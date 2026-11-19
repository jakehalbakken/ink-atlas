// Local-only artwork editor. The caller retains the untouched source artwork.
import { rectMask, lassoMask, pieceMask, combineMasks, invertMask, isEmptyMask, maskBounds, identityFor, pieceToLocal, growPads, snapStraight, snapTurn, twoFingerTransform, moveWords } from './cleanup-select.js';
// No image leaves the device. All edits remain a draft until Apply.
export function removeLightPixels(data, threshold = 235) {
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    const light = Math.min(out[i], out[i + 1], out[i + 2]);
    const keep = Math.max(0, Math.min(1, (threshold - light) / 18));
    out[i + 3] = Math.round(out[i + 3] * keep);
  }
  return out;
}
// Four-connected pale pixels reachable from the image border only. Not subject segmentation.
// One visit per pixel; bounded to the editor's 1600 × 1600 working raster.
export function removeEdgeLightPixels(data,width,height,threshold=235){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1600||height>1600||data.length!==width*height*4||!Number.isFinite(threshold)||threshold<100||threshold>255)throw new Error('Invalid edge-background dimensions or threshold');
 const out=new Uint8ClampedArray(data),seen=new Uint8Array(width*height),queue=new Uint32Array(width*height);let head=0,tail=0;
 const visit=p=>{if(seen[p])return;seen[p]=1;const i=p*4;if(data[i+3]===0||Math.min(data[i],data[i+1],data[i+2])>threshold-18)queue[tail++]=p;};
 for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}for(let y=1;y<height-1;y++){visit(y*width);visit(y*width+width-1);}
 while(head<tail){const p=queue[head++],i=p*4,light=Math.min(data[i],data[i+1],data[i+2]);out[i+3]=Math.round(data[i+3]*Math.max(0,Math.min(1,(threshold-light)/18)));const x=p%width;if(x>0)visit(p-1);if(x<width-1)visit(p+1);if(p>=width)visit(p-width);if(p<(height-1)*width)visit(p+width);}
 return out;
}
// Remove only four-connected pixels within per-channel RGB tolerance of the tapped pixel.
// Fully transparent pixels are boundaries, not bridges to disconnected artwork.
export function removeConnectedColor(data,width,height,x,y,tolerance=24){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1600||height>1600||data.length!==width*height*4||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height||!Number.isFinite(tolerance)||tolerance<0||tolerance>100)throw new Error('Invalid connected-color sample, dimensions or tolerance');
 const out=new Uint8ClampedArray(data),seed=(y*width+x)*4;if(data[seed+3]===0)return out;
 const seen=new Uint8Array(width*height),queue=new Uint32Array(width*height);let head=0,tail=0;
 const visit=p=>{if(seen[p])return;seen[p]=1;const i=p*4;if(data[i+3]>0&&Math.max(Math.abs(data[i]-data[seed]),Math.abs(data[i+1]-data[seed+1]),Math.abs(data[i+2]-data[seed+2]))<=tolerance)queue[tail++]=p;};
 visit(y*width+x);while(head<tail){const p=queue[head++],col=p%width;out[p*4+3]=0;if(col>0)visit(p-1);if(col<width-1)visit(p+1);if(p>=width)visit(p-width);if(p<(height-1)*width)visit(p+width);}return out;
}
export function brushPressureScale(pointerType,pressure,enabled){return enabled&&pointerType==='pen'?Math.max(.1,Math.min(1,Number.isFinite(pressure)?pressure:.5)):1;}
// Blend a bounded brush patch in premultiplied-alpha space; baseline remains untouched.
export function featherBrushPixels(data,baseline,width,height,cx,cy,radius,feather,restore=false){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1600||height>1600||data.length!==width*height*4||baseline.length!==data.length||![cx,cy,radius,feather].every(Number.isFinite)||radius<=0||radius>3200||feather<0||feather>1)throw new Error('Invalid feather brush patch');
 const out=new Uint8ClampedArray(data),inner=radius*(1-feather);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const distance=Math.hypot(x+.5-cx,y+.5-cy);if(distance>=radius)continue;let mix=1;if(distance>inner){const t=(radius-distance)/(radius-inner);mix=t*t*(3-2*t);}const i=(y*width+x)*4,a=data[i+3]/255;
 if(!restore){out[i+3]=Math.round(data[i+3]*(1-mix));continue;}
 const b=baseline[i+3]/255,alpha=a*(1-mix)+b*mix;for(let c=0;c<3;c++)out[i+c]=alpha?Math.round((data[i+c]*a*(1-mix)+baseline[i+c]*b*mix)/alpha):0;out[i+3]=Math.round(alpha*255);
 }return out;
}
export function contrastPixels(data, amount = 0) {
  const out = new Uint8ClampedArray(data), factor = (100 + amount) / 100;
  for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) out[i + c] = (out[i + c] - 128) * factor + 128;
  return out;
}
// Bounds include every nonzero alpha pixel, including faint antialiased edges.
export function transparencyBounds(data,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length!==width*height*4)throw new Error('Invalid pixel dimensions');
 let x=width,y=height,right=-1,bottom=-1;
 for(let j=0;j<height;j++)for(let i=0;i<width;i++)if(data[(j*width+i)*4+3]>0){x=Math.min(x,i);y=Math.min(y,j);right=Math.max(right,i);bottom=Math.max(bottom,j);}
 return right<0?null:{x,y,w:right-x+1,h:bottom-y+1};
}
export function exactCrop(value,width,height){
 if(!value||!['x','y','w','h'].every(k=>Number.isInteger(value[k]))||value.x<0||value.y<0||value.w<1||value.h<1||value.x+value.w>width||value.y+value.h>height)throw new Error('Use whole pixel coordinates within the current image.');
 return {x:value.x,y:value.y,w:value.w,h:value.h};
}
export function validateCleanupSession(value){
 if(!value||value.version!==1||typeof value.sourceHash!=='string'||typeof value.outputHash!=='string'||!/^[a-f0-9]{64}$/.test(value.sourceHash)||!/^[a-f0-9]{64}$/.test(value.outputHash))throw new Error('Invalid cleanup session identity');
 const dimensions=url=>{if(typeof url!=='string'||url.length>12000000||!/^data:image\/png;base64,[a-z0-9+/]+={0,2}$/i.test(url))throw new Error('Invalid cleanup session PNG');const b=atob(url.slice(url.indexOf(',')+1));if(b.length<33||[137,80,78,71,13,10,26,10].some((v,i)=>b.charCodeAt(i)!==v)||b.slice(12,16)!=='IHDR')throw new Error('Invalid cleanup PNG header');const n=o=>b.charCodeAt(o)*16777216+(b.charCodeAt(o+1)<<16)+(b.charCodeAt(o+2)<<8)+b.charCodeAt(o+3);return [n(16),n(20)];};
 const [w,h]=dimensions(value.workingDataUrl),[rw,rh]=dimensions(value.restoreDataUrl),c=value.crop;
 if(w<1||h<1||w>1600||h>1600||w!==rw||h!==rh||!c||!['x','y','w','h'].every(k=>Number.isInteger(c[k]))||c.x<0||c.y<0||c.w<1||c.h<1||c.x+c.w>w||c.y+c.h>h)throw new Error('Invalid cleanup session dimensions or crop');
 return {version:1,sourceHash:value.sourceHash,outputHash:value.outputHash,workingDataUrl:value.workingDataUrl,restoreDataUrl:value.restoreDataUrl,crop:{x:c.x,y:c.y,w:c.w,h:c.h}};
}
async function fingerprint(text){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');}
const picture = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Could not open this picture')); image.src = src; });
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// What the outer edge of a picture looks like: 'paper' when most of it is opaque and pale (art on paper),
// 'opaque' when most of it is opaque in another colour (a photo, a tattoo on skin), 'clear' otherwise.
// Picks the tool the workspace opens on and whether an upload is offered a cleanup.
export function edgeKind(data, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) return 'clear';
  let pale = 0, solid = 0, white = 0, total = 0;
  const look = (x, y) => { const i = (y * width + x) * 4; total++; if (data[i + 3] <= 200) return; solid++; const m = Math.min(data[i], data[i + 1], data[i + 2]); if (m > 190) pale++; if (m > 247) white++; };
  const step = Math.max(1, Math.floor(Math.max(width, height) / 200));
  for (let x = 0; x < width; x += step) { look(x, 0); look(x, height - 1); }
  for (let y = 0; y < height; y += step) { look(0, y); look(width - 1, y); }
  if (!total || solid / total <= 0.6) return 'clear';
  return pale / total > 0.6 ? (white / total > 0.9 ? 'white' : 'paper') : 'opaque';
}
// The paper's own lightness: the median darkest channel of the opaque edge pixels, or null with no opaque edge.
// Remove white paper starts just under it, so off-white or photographed paper goes in one tap.
export function paperLevel(data, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) return null;
  const v = [], step = Math.max(1, Math.floor(Math.max(width, height) / 200));
  const look = (x, y) => { const i = (y * width + x) * 4; if (data[i + 3] > 200) v.push(Math.min(data[i], data[i + 1], data[i + 2])); };
  for (let x = 0; x < width; x += step) { look(x, 0); look(x, height - 1); }
  for (let y = 0; y < height; y += step) { look(0, y); look(width - 1, y); }
  if (!v.length) return null; v.sort((a, b) => a - b); return v[v.length >> 1];
}
export const hasPaperBackground = (data, width, height) => ['paper', 'white'].includes(edgeKind(data, width, height));
// The pan that keeps the picture point first under `mid0` under `mid` after zooming from zoom0 to zoom.
// Offsets are from the middle of the stage; the canvas scales about its own centre.
export function pinchPan(mid0, pan0, zoom0, mid, zoom) {
  const qx = (mid0.x - pan0.x) / zoom0, qy = (mid0.y - pan0.y) / zoom0;
  return { x: mid.x - zoom * qx, y: mid.y - zoom * qy };
}

const ICONS = {
  cutout: '<path d="M5 19 15 9"/><path d="m13 7 4 4"/><path d="M18 3v3M16.5 4.5h3M20 10v2M19 11h2M9 3v2M8 4h2"/>',
  color: '<path d="M12 3.5c3.5 4.2 5.5 7.3 5.5 10a5.5 5.5 0 0 1-11 0c0-2.7 2-5.8 5.5-10z"/><path d="M4.5 4.5l15 15"/>',
  erase: '<path d="m7.5 20-3.6-3.6a2 2 0 0 1 0-2.8l9.7-9.7a2 2 0 0 1 2.8 0l3.8 3.8a2 2 0 0 1 0 2.8L11.3 20z"/><path d="m9 9.5 5.5 5.5M11.3 20H20"/>',
  restore: '<path d="M18.4 3.6a2.1 2.1 0 0 1 3 3L12.5 15.5l-4-4z"/><path d="M8.5 11.5c-2.6 0-4.2 1.8-4.2 4 0 1.6-.6 3-1.8 4 3.6.6 7.2-.4 8.2-4"/>',
  crop: '<path d="M6.5 2.5v13a2 2 0 0 0 2 2h13"/><path d="M17.5 21.5v-13a2 2 0 0 0-2-2h-13"/>',
  lines: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  compare: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 3.5v17"/><path d="M12 3.5h5.5a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H12z" fill="currentColor" opacity=".4"/>',
  backdrop: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 3.5H12V12H3.5zM12 12h8.5v8.5H12z" fill="currentColor" opacity=".4" stroke="none"/>',
  select: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M12 4h2M18 4h.5A1.5 1.5 0 0 1 20 5.5V8M20 12v2M20 18v.5a1.5 1.5 0 0 1-1.5 1.5H18M14 20h-2M8 20H5.5A1.5 1.5 0 0 1 4 18.5V18M4 14v-2"/>',
  move: '<path d="M12 3v18M3 12h18"/><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  minus: '<path d="M6 12h12"/>', plus: '<path d="M12 6v12M6 12h12"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const TOOLS = [
  ['cutout', 'Cut out', 'Tap the design to keep it and lose everything round it. Tap more parts to add them.'],
  ['color', 'Background', 'Tap the background to remove that colour where it touches, or remove the white paper in one go.'],
  ['erase', 'Erase', 'Drag over anything you don’t want. Pinch to get closer.'],
  ['restore', 'Restore', 'Drag to paint the original picture back.'],
  ['select', 'Select', 'Tap a piece of the design to select it, or drag a box or a loop round what you want.'],
  ['move', 'Move', 'Drag the selection to move it. The corners size it, the dot above turns it, and two fingers on it do both. With nothing selected, the whole picture moves.'],
  ['crop', 'Crop', 'Drag a box round what to keep, then Crop.'],
  ['lines', 'Lines', 'Slide to darken faint lines. It shows as you slide.'],
];
const TOOL_KEYS = { w: 'cutout', b: 'color', e: 'erase', r: 'restore', m: 'select', v: 'move', c: 'crop', l: 'lines' };
const MOVE_KINDS = ['move', 'scale', 'turn', 'xform2'];

const STYLE = `
#ink-cleanup{--ic-bg:var(--bg,#121318);--ic-text:var(--text,#f1f2f6);--ic-muted:var(--muted,#a0a5b3);--ic-card:var(--surface-raised,#23252e);--ic-fill:var(--fill,rgba(255,255,255,.07));--ic-fill2:var(--fill-strong,rgba(255,255,255,.12));--ic-line:var(--line,rgba(255,255,255,.12));--ic-accent:var(--stencil,#8474ff);--ic-on:var(--seg-on,#4b4e5a);--ic-danger:var(--danger,#ff8f86);
 position:fixed;inset:0;z-index:10000;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;background:var(--ic-bg);color:var(--ic-text);box-sizing:border-box;
 padding:max(6px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));font:400 15px/1.35 var(--body,-apple-system,BlinkMacSystemFont,system-ui,sans-serif);overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;animation:ic-in .22s ease-out}
@keyframes ic-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#ink-cleanup,#ink-cleanup *{animation:none!important;transition:none!important}}
#ink-cleanup *{box-sizing:border-box}
#ink-cleanup button{min-height:44px;min-width:44px;font:inherit;font-weight:590;color:inherit;background:var(--ic-fill);border:0;border-radius:12px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:transform .12s,background .15s,opacity .15s}
#ink-cleanup button:active:not(:disabled){transform:scale(.97)}
#ink-cleanup button:disabled{opacity:.32;cursor:default}
#ink-cleanup button.ic-plain{background:transparent}
#ink-cleanup button.ic-icon{padding:0;width:44px}
#ink-cleanup button.ic-primary{background:var(--ic-accent);color:var(--on-accent,#fff);min-width:84px}
#ink-cleanup button.ic-danger{color:var(--ic-danger)}
#ink-cleanup button[aria-pressed=true].ic-icon{background:var(--stencil-soft,rgba(132,116,255,.22));color:var(--ic-text)}
#ink-cleanup .ic-bar{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:56px;position:relative;grid-column:1/-1}
#ink-cleanup .ic-side{display:flex;align-items:center;gap:4px;position:relative;z-index:1}
#ink-cleanup .ic-title{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;white-space:nowrap}
#ink-cleanup h2{font-size:17px;font-weight:650;margin:0}
#ink-cleanup .ic-note{display:block;font-size:12px;color:var(--ic-muted)}
@media (max-width:700px){#ink-cleanup .ic-title{display:none}}
#ink-cleanup .ic-confirm{position:absolute;left:0;top:52px;z-index:5;width:260px;background:var(--surface-solid,#1b1d24);border-radius:16px;padding:14px;box-shadow:var(--shadow,0 12px 34px rgba(0,0,0,.4));display:grid;gap:8px;animation:ic-pop .18s ease-out;transform-origin:top left}
#ink-cleanup .ic-confirm p{margin:0 0 4px;font-size:15px;font-weight:600}
#ink-cleanup .ic-confirm button{width:100%}
@keyframes ic-pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
#ink-cleanup .ic-work{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none;border-radius:20px;min-height:140px;background:repeating-conic-gradient(#d9dade 0% 25%,#f3f3f5 0% 50%) 50%/22px 22px}
#ink-cleanup .ic-work[data-backdrop=white]{background:#fff}#ink-cleanup .ic-work[data-backdrop=dark]{background:#26282c}
#ink-cleanup canvas{flex:none;display:block;touch-action:none;transform-origin:center;max-width:none;max-height:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.08))}
#ink-cleanup .ic-work.ic-original::after{content:'Original';position:absolute;top:12px;left:12px;background:rgba(20,21,26,.72);color:#fff;font-size:12px;font-weight:650;padding:5px 10px;border-radius:99px;letter-spacing:.02em}
#ink-cleanup .ic-status{position:absolute;left:50%;top:12px;transform:translate(-50%,-6px);max-width:min(560px,calc(100% - 24px));margin:0;padding:8px 14px;border-radius:99px;background:rgba(20,21,26,.78);color:#f4f5f8;font-size:13px;line-height:1.3;text-align:center;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
#ink-cleanup .ic-status.on{opacity:1;transform:translate(-50%,0)}
#ink-cleanup .ic-ring{position:absolute;left:0;top:0;border-radius:50%;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.55),inset 0 0 0 1px rgba(0,0,0,.35);pointer-events:none;display:none}
#ink-cleanup .ic-cropbox{position:absolute;pointer-events:none;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(10,10,14,.45);display:none}
#ink-cleanup .ic-view{position:absolute;left:10px;bottom:10px;display:flex;gap:2px;padding:3px;border-radius:14px;background:rgba(20,21,26,.7);color:#f4f5f8;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
#ink-cleanup .ic-view button{background:transparent;border-radius:10px}
#ink-cleanup .ic-view output{font-size:13px;font-variant-numeric:tabular-nums;min-width:44px;text-align:center}
#ink-cleanup .ic-dock{display:grid;gap:10px;padding-top:10px;min-width:0}
#ink-cleanup .ic-tools{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:4px;border-radius:18px;background:var(--ic-fill)}
#ink-cleanup .ic-tools button{flex-direction:column;gap:3px;min-height:58px;padding:6px 2px;font-size:12px;font-weight:600;background:transparent;color:var(--ic-muted);border-radius:14px}
#ink-cleanup .ic-tools button[aria-pressed=true]{background:var(--ic-on);color:var(--ic-text);box-shadow:0 1px 3px rgba(0,0,0,.18)}
#ink-cleanup .ic-opts{background:var(--ic-card);border-radius:20px;padding:12px 16px;display:grid;gap:10px;align-content:start;height:min(34vh,268px);overflow:auto;touch-action:pan-y;overscroll-behavior:contain}
#ink-cleanup .ic-sec{display:grid;gap:10px}#ink-cleanup .ic-sec[hidden]{display:none}
#ink-cleanup .ic-hint{margin:0;font-size:13px;color:var(--ic-muted)}
#ink-cleanup .ic-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#ink-cleanup .ic-row>button{flex:1 1 auto}
#ink-cleanup .ic-field{display:grid;gap:0;font-size:13px;color:var(--ic-muted)}
#ink-cleanup .ic-field .lbl-row{display:flex;justify-content:space-between;gap:8px}
#ink-cleanup .ic-field .val{color:var(--ic-text);font-variant-numeric:tabular-nums}
#ink-cleanup .ic-seg{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:3px;border-radius:12px;background:var(--ic-fill)}
#ink-cleanup .ic-seg button{min-height:38px;font-size:13px;background:transparent;border-radius:9px;padding:0 8px}
#ink-cleanup .ic-seg button[aria-pressed=true]{background:var(--ic-on);box-shadow:0 1px 3px rgba(0,0,0,.18)}
#ink-cleanup .ic-seg-label{font-size:13px;color:var(--ic-muted);margin-bottom:-4px}
#ink-cleanup .ic-switch{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;font-size:15px;border-top:1px solid var(--ic-line)}
#ink-cleanup input[type=checkbox]{appearance:none;-webkit-appearance:none;flex:none;width:51px;height:31px;border-radius:99px;background:var(--ic-fill2);position:relative;margin:0;cursor:pointer;transition:background .2s}
#ink-cleanup input[type=checkbox]::after{content:'';position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25);transition:transform .2s}
#ink-cleanup input[type=checkbox]:checked{background:var(--good,#34c759)}#ink-cleanup input[type=checkbox]:checked::after{transform:translateX(20px)}
#ink-cleanup details{border-top:1px solid var(--ic-line)}
#ink-cleanup summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:15px;list-style:none}
#ink-cleanup summary::-webkit-details-marker{display:none}
#ink-cleanup summary::after{content:'';margin-left:auto;width:8px;height:8px;border-right:2px solid var(--ic-muted);border-bottom:2px solid var(--ic-muted);transform:rotate(-45deg);transition:transform .2s}
#ink-cleanup details[open] summary::after{transform:rotate(45deg)}
#ink-cleanup .ic-nums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding-bottom:8px}
#ink-cleanup .ic-nums label{display:grid;gap:2px;font-size:12px;color:var(--ic-muted)}
#ink-cleanup input[type=number]{width:100%;min-height:44px;font:inherit;font-size:16px;color:inherit;background:var(--ic-fill);border:0;border-radius:10px;padding:0 10px}
#ink-cleanup select{display:none}
#ink-cleanup ink-slider{display:block;position:relative;height:44px;touch-action:pan-y;cursor:pointer;outline:none}
#ink-cleanup ink-slider .sl-track{position:absolute;left:0;right:0;top:50%;height:6px;margin-top:-3px;border-radius:3px;background:var(--ic-fill2);pointer-events:none}
#ink-cleanup ink-slider .sl-fill{position:absolute;top:0;bottom:0;border-radius:3px;background:var(--ic-accent)}
#ink-cleanup ink-slider .sl-thumb{position:absolute;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.45);pointer-events:none}
#ink-cleanup canvas.ic-sel{position:absolute;left:50%;top:50%;pointer-events:none;filter:none;display:none}
#ink-cleanup canvas.ic-float{position:absolute;left:0;top:0;pointer-events:none;display:none;transform-origin:center}
#ink-cleanup .ic-xbox{position:absolute;left:0;top:0;display:none;pointer-events:none;border:1.5px dashed #fff;box-shadow:0 0 0 1px rgba(0,0,0,.5),inset 0 0 0 1px rgba(0,0,0,.35);transform-origin:center}
#ink-cleanup .ic-xbox [data-handle]{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;pointer-events:auto;touch-action:none;cursor:nwse-resize}
#ink-cleanup .ic-xbox [data-handle]::after{content:'';position:absolute;left:15px;top:15px;width:14px;height:14px;border-radius:4px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.5),0 1px 4px rgba(0,0,0,.4)}
#ink-cleanup .ic-xbox .h-tl{left:0;top:0}#ink-cleanup .ic-xbox .h-tr{left:100%;top:0;cursor:nesw-resize}#ink-cleanup .ic-xbox .h-br{left:100%;top:100%}#ink-cleanup .ic-xbox .h-bl{left:0;top:100%;cursor:nesw-resize}
#ink-cleanup .ic-xbox .h-turn{left:50%;top:-36px;cursor:grab}#ink-cleanup .ic-xbox .h-turn::after{border-radius:50%;background:var(--ic-accent)}
#ink-cleanup .ic-xbox .h-stick{position:absolute;left:50%;top:-36px;height:36px;border-left:1.5px solid #fff;pointer-events:none}
#ink-cleanup .ic-readout{margin:0;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
#ink-cleanup .ic-sec .ic-hint[hidden]{display:none}
@media (max-width:560px){#ink-cleanup .ic-tools{grid-auto-columns:minmax(56px,1fr);overflow-x:auto;scrollbar-width:none}}
#ink-cleanup .ic-linked{border-top:0;padding:0 16px;background:var(--ic-card);border-radius:16px}
@media (min-width:980px) and (orientation:landscape){
 #ink-cleanup{grid-template-columns:minmax(0,1fr) 340px;grid-template-rows:auto minmax(0,1fr);column-gap:12px}
 #ink-cleanup .ic-dock{grid-column:2;grid-row:2;padding-top:0;align-content:start;grid-template-rows:auto minmax(0,1fr) auto;min-height:0}
 #ink-cleanup .ic-tools{grid-row:1;grid-auto-flow:row;grid-template-columns:repeat(3,minmax(0,1fr))}
 #ink-cleanup .ic-opts{grid-row:2;height:auto;max-height:none}
}
`;

export async function editArtwork(sourceDataUrl, currentDataUrl = sourceDataUrl, priorSession = null, options = {}) {
  const sourceHash = await fingerprint(sourceDataUrl); let session = null, fullImage = null, restoreImage = null;
  if (priorSession) { session = validateCleanupSession(priorSession); if (session.sourceHash !== sourceHash || session.outputHash !== await fingerprint(currentDataUrl)) throw new Error('Cleanup session does not match this source and edited image'); [fullImage, restoreImage] = await Promise.all([picture(session.workingDataUrl), picture(session.restoreDataUrl)]); }
  const [source, current] = await Promise.all([picture(sourceDataUrl), picture(currentDataUrl)]);
  if (session) {
    const c = session.crop; if (current.naturalWidth !== c.w || current.naturalHeight !== c.h) throw new Error('Cleanup crop does not match the edited image dimensions');
    const a = canvasOf(c.w, c.h), b = canvasOf(c.w, c.h), ac = a.getContext('2d'), bc = b.getContext('2d'); ac.drawImage(fullImage, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h); bc.drawImage(current, 0, 0); const x = ac.getImageData(0, 0, c.w, c.h).data, y = bc.getImageData(0, 0, c.w, c.h).data;
    if (x.some((v, i) => v !== y[i])) throw new Error('Cleanup working pixels do not match the edited image');
  }
  await import('./slider.js');
  const linkedCount = Math.max(0, Math.floor(+options.linkedCount || 0));

  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const host = document.createElement('div'); host.id = 'ink-cleanup'; host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-labelledby', 'ic-title');
    const toolButtons = TOOLS.map(([m, word]) => `<button type="button" data-mode="${m}" aria-pressed="false">${icon(m)}<span>${word}</span></button>`).join('');
    const hint = (m) => `<p class="ic-hint">${TOOLS.find(t => t[0] === m)[2]}</p>`;
    host.innerHTML = `<style>${STYLE}</style>
<header class="ic-bar">
 <div class="ic-side"><button type="button" class="ic-plain" data-action="cancel">Cancel</button><button type="button" class="ic-plain" data-action="reset">Start over</button>
  <div class="ic-confirm" role="alertdialog" aria-label="Discard changes" hidden><p>Throw away these changes?</p><button type="button" class="ic-danger" data-action="discard">Discard changes</button><button type="button" data-action="keep">Keep editing</button></div></div>
 <div class="ic-title"><h2 id="ic-title">Clean up</h2><span class="ic-note">Your original picture is kept</span></div>
 <div class="ic-side"><button type="button" class="ic-icon ic-plain" data-action="undo" aria-label="Undo" title="Undo" disabled>${icon('undo')}</button><button type="button" class="ic-icon ic-plain" data-action="redo" aria-label="Redo" title="Redo" disabled>${icon('redo')}</button><button type="button" class="ic-icon ic-plain" data-action="compare" aria-pressed="false" aria-label="Show original" title="Show original">${icon('compare')}</button><button type="button" class="ic-primary" data-action="apply">Done</button></div>
</header>
<div class="ic-work"><canvas aria-label="Tattoo picture"></canvas><canvas class="ic-sel" aria-hidden="true"></canvas><canvas class="ic-float" aria-hidden="true"></canvas><div class="ic-xbox"><span class="h-stick"></span><span data-handle="turn" class="h-turn" aria-label="Turn"></span><span data-handle="scale" class="h-tl"></span><span data-handle="scale" class="h-tr"></span><span data-handle="scale" class="h-br"></span><span data-handle="scale" class="h-bl"></span></div><div class="ic-cropbox"></div><div class="ic-ring"></div><p class="ic-status" role="status" aria-live="polite"></p>
 <div class="ic-view"><button type="button" class="ic-icon" data-action="backdrop" aria-label="Change the backdrop" title="Backdrop">${icon('backdrop')}</button><select id="ic-backdrop" aria-label="Backdrop"><option value="checker">Checker</option><option value="white">White</option><option value="dark">Dark</option></select><button type="button" class="ic-icon" data-action="zoomout" aria-label="Zoom out">${icon('minus')}</button><button type="button" class="ic-icon" data-action="fit" aria-label="Fit the picture" title="Fit"><output id="ic-zoom">100%</output></button><button type="button" class="ic-icon" data-action="zoomin" aria-label="Zoom in">${icon('plus')}</button></div>
</div>
<div class="ic-dock">
 <div class="ic-opts">
  <div class="ic-sec" data-for="cutout">${hint('cutout')}<div class="ic-seg-label">Keep</div><div class="ic-seg" data-select="ic-cutout-keep"></div><select id="ic-cutout-keep" aria-label="What the cutout keeps"><option value="subject">What I tapped</option><option value="ink">Just the ink</option></select><p class="ic-hint">Pick Just the ink for a photo of a tattoo on skin.</p></div>
  <div class="ic-sec" data-for="color">${hint('color')}<div class="ic-row"><button type="button" data-action="paper">Remove white paper</button></div><div class="ic-seg" data-select="ic-paper-scope"></div><select id="ic-paper-scope" aria-label="Where to remove white paper"><option value="all">Everywhere</option><option value="edges">Just the edges</option></select>
   <label class="ic-field">Light shades kept<ink-slider id="ic-threshold" min="100" max="255" step="1" value="235" default="235" aria-label="How light counts as paper"></ink-slider></label>
   <label class="ic-field">Colour range for a tap<ink-slider id="ic-color-tolerance" min="0" max="100" step="1" value="24" default="24" aria-label="How close a colour counts"></ink-slider></label></div>
  <div class="ic-sec" data-for="erase restore"><p class="ic-hint" data-hint-erase>${TOOLS[2][2]}</p><p class="ic-hint" data-hint-restore>${TOOLS[3][2]}</p>
   <label class="ic-field">Brush size<ink-slider id="ic-brush" min="2" max="150" step="1" value="24" default="24" unit=" pt" aria-label="Brush size"></ink-slider></label>
   <label class="ic-field">Soft edge<ink-slider id="ic-feather" min="0" max="100" step="1" value="0" default="0" unit="%" aria-label="Soft edge"></ink-slider></label>
   <label class="ic-switch">Only the Pencil draws<input id="ic-stylus-only" type="checkbox"></label>
   <label class="ic-switch">Press harder for a bigger brush<input id="ic-pressure" type="checkbox"></label><p class="ic-hint" data-hint-sel hidden>Only the selected part changes. Clear the selection in Select to work on all of it.</p></div>
  <div class="ic-sec" data-for="select">${hint('select')}<p class="ic-readout" data-sel-info>Nothing selected</p>
   <div class="ic-seg-label">Drag to draw</div><div class="ic-seg" data-select="ic-sel-shape"></div><select id="ic-sel-shape" aria-label="What a drag draws"><option value="box">Box</option><option value="lasso">Freehand loop</option></select>
   <div class="ic-seg-label">A new selection</div><div class="ic-seg" data-select="ic-sel-op"></div><select id="ic-sel-op" aria-label="What a new selection does"><option value="new">Replaces</option><option value="add">Adds</option><option value="subtract">Takes away</option></select>
   <div class="ic-row"><button type="button" class="ic-primary" data-action="tomove">Move it</button><button type="button" data-action="selall">Select all</button><button type="button" data-action="selinvert">Invert</button></div>
   <div class="ic-row"><button type="button" data-action="selnone">Clear selection</button><button type="button" class="ic-danger" data-action="seldelete">Delete it</button></div>
   <label class="ic-field">Tap joins bits closer than<ink-slider id="ic-sel-reach" min="0" max="60" step="1" value="2" default="2" unit=" px" aria-label="Gaps a tap joins"></ink-slider></label></div>
  <div class="ic-sec" data-for="move">${hint('move')}<p class="ic-readout" data-readout>Nothing to move</p>
   <div class="ic-row"><button type="button" data-action="flipx">Flip across</button><button type="button" data-action="flipy">Flip up and down</button><button type="button" data-action="turn90">Turn 90°</button></div>
   <div class="ic-row"><button type="button" data-action="duplicate">Duplicate</button><button type="button" data-action="putback">Put it back</button><button type="button" class="ic-primary" data-action="place">Place it</button></div>
   <label class="ic-switch">Snap straight across or up and down<input id="ic-snap" type="checkbox" checked></label>
   <details><summary>Exact amounts</summary><div class="ic-nums"><label>Right<input id="ic-mx" type="number" step="0.01" value="0" inputmode="decimal"></label><label>Down<input id="ic-my" type="number" step="0.01" value="0" inputmode="decimal"></label><label>Size %<input id="ic-ms" type="number" min="5" max="2000" step="1" value="100" inputmode="decimal"></label><label>Turn °<input id="ic-mr" type="number" step="1" value="0" inputmode="decimal"></label></div><p class="ic-hint" data-units></p><div class="ic-row"><button type="button" data-action="exactmove">Move by these</button></div></details></div>
  <div class="ic-sec" data-for="crop">${hint('crop')}<div class="ic-row"><button type="button" class="ic-primary" data-action="crop" disabled>Crop</button><button type="button" data-action="trim">Trim empty edges</button></div><div class="ic-row"><button type="button" data-action="uncrop">Show the whole picture</button></div>
   <details><summary>Exact size in pixels</summary><div class="ic-nums"><label>X<input id="ic-x" type="number" min="0" value="0" inputmode="numeric"></label><label>Y<input id="ic-y" type="number" min="0" value="0" inputmode="numeric"></label><label>Width<input id="ic-w" type="number" min="1" inputmode="numeric"></label><label>Height<input id="ic-h" type="number" min="1" inputmode="numeric"></label></div><div class="ic-row"><button type="button" data-action="exactcrop">Crop to these</button></div></details></div>
  <div class="ic-sec" data-for="lines">${hint('lines')}<label class="ic-field">Darker lines<ink-slider id="ic-contrast" min="-80" max="150" step="1" value="25" default="25" origin="0" unit="%" aria-label="How much darker"></ink-slider></label><div class="ic-row"><button type="button" data-action="contrast">Darken lines</button></div></div>
 </div>
  ${linkedCount >= 2 ? `<label class="ic-switch ic-linked">Also update the ${linkedCount - 1} other ${linkedCount === 2 ? 'copy' : 'copies'}<input id="ic-linked" type="checkbox"${options.linked ? ' checked' : ''}></label>` : ''}
 <nav class="ic-tools" aria-label="Cleanup tools">${toolButtons}</nav>
</div>`;
    (document.querySelector('#viewport') || document.body).append(host);
    const $ = (s) => host.querySelector(s);
    const view = $('canvas'), work = canvasOf(1, 1), original = canvasOf(1, 1), wctx = work.getContext('2d', { willReadFrequently: true });
    const selOver = $('canvas.ic-sel'), floatView = $('canvas.ic-float'), xbox = $('.ic-xbox');
    let sel = null, selVer = 0, float = null, pendingBox = null, grow = 1, nudge = null, lookCache = null, selCache = null, infoCache = null; const used = new Set();
    const status = $('.ic-status'), stage = $('.ic-work'), ring = $('.ic-ring'), cropbox = $('.ic-cropbox'), confirmBox = $('.ic-confirm');
    const full = canvasOf(1, 1), baseline = canvasOf(1, 1); let rect = { x: 0, y: 0, w: 1, h: 1 };
    let zoom = 1, panX = 0, panY = 0;
    let history = [], future = [], mode = 'erase', comparing = false, crop = null, settled = false;
    let live = null, livePending = 0, statusTimer = 0;
    const pts = new Map(); let stroke = null, pinch = null, pencilSeen = false;
    const button = action => host.querySelector(`[data-action="${action}"]`);
    const say = (text, hold = false) => { status.textContent = text; status.classList.toggle('on', !!text); clearTimeout(statusTimer); if (text && !hold) statusTimer = setTimeout(() => status.classList.remove('on'), 4200); };
    const setImage = image => { const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight)); work.width = Math.max(1, Math.round(image.naturalWidth * scale)); work.height = Math.max(1, Math.round(image.naturalHeight * scale)); wctx.drawImage(image, 0, 0, work.width, work.height); original.width = work.width; original.height = work.height; original.getContext('2d').drawImage(work, 0, 0); full.width = baseline.width = work.width; full.height = baseline.height = work.height; full.getContext('2d').drawImage(work, 0, 0); baseline.getContext('2d').drawImage(work, 0, 0); rect = { x: 0, y: 0, w: work.width, h: work.height }; };
    const merge = () => { const ctx = full.getContext('2d'); ctx.clearRect(rect.x, rect.y, rect.w, rect.h); ctx.drawImage(work, rect.x, rect.y); };
    const capture = () => ({ fw: full.width, fh: full.height, full: full.getContext('2d').getImageData(0, 0, full.width, full.height), baseline: baseline.getContext('2d').getImageData(0, 0, baseline.width, baseline.height), rect: { ...rect }, w: work.width, h: work.height, pixels: wctx.getImageData(0, 0, work.width, work.height), original: original.getContext('2d').getImageData(0, 0, original.width, original.height), sel, grow, float: float ? { ...float, T: { ...float.T } } : null });
    const trim = stack => { while (stack.length > 1 && stack.reduce((n, s) => n + (s.selOnly ? 0 : (s.w * s.h + s.fw * s.fh) * 8 + (s.float ? s.float.w * s.float.h * 8 : 0)) + (s.sel ? s.sel.length : 0), 0) > 48 * 1024 * 1024) stack.shift(); };
    const snapshot = () => { history.push(capture()); trim(history); future = []; };
    const restore = state => { work.width = original.width = state.w; work.height = original.height = state.h; wctx.putImageData(state.pixels, 0, 0); original.getContext('2d').putImageData(state.original, 0, 0); full.width = baseline.width = state.fw; full.height = baseline.height = state.fh; full.getContext('2d').putImageData(state.full, 0, 0); baseline.getContext('2d').putImageData(state.baseline, 0, 0); rect = { ...state.rect }; crop = null; sel = state.sel || null; selVer++; grow = state.grow || 1; float = state.float ? { ...state.float, T: { ...state.float.T } } : null; nudge = null; };
    // a selection change alone is a light undo step: only the selection is kept
    const snapshotSel = () => { history.push({ selOnly: true, sel }); trim(history); future = []; };
    const restoreEntry = e => { if (e.selOnly) { sel = e.sel && e.sel.length === work.width * work.height ? e.sel : null; selVer++; } else restore(e); };
    const entryNow = e => e.selOnly ? { selOnly: true, sel } : capture();
    const fit = () => { zoom = 1; panX = panY = 0; };
    const boundedValue = (id, min, max) => { const n = Number($(id).value); return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)); };
    const brushMode = () => mode === 'erase' || mode === 'restore';
    const placeCropbox = () => {
      if (!crop || comparing || mode !== 'crop' || Math.abs(crop.w) < 1 || Math.abs(crop.h) < 1) { cropbox.style.display = 'none'; return; }
      const r = view.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = r.width / work.width;
      const x = Math.min(crop.x, crop.x + crop.w), y = Math.min(crop.y, crop.y + crop.h);
      Object.assign(cropbox.style, { display: 'block', left: (r.left - s.left + x * k) + 'px', top: (r.top - s.top + y * k) + 'px', width: Math.abs(crop.w) * k + 'px', height: Math.abs(crop.h) * k + 'px' });
    };
    const layout = () => {
      const scale = Math.min(1, stage.clientWidth / view.width, stage.clientHeight / view.height), w = view.width * scale, h = view.height * scale;
      const limX = Math.max(0, (w * zoom - stage.clientWidth) / 2), limY = Math.max(0, (h * zoom - stage.clientHeight) / 2);
      panX = Math.max(-limX, Math.min(limX, panX)); panY = Math.max(-limY, Math.min(limY, panY));
      view.style.width = w + 'px'; view.style.height = h + 'px'; view.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
      $('#ic-zoom').value = Math.round(zoom * 100) + '%'; button('zoomin').disabled = zoom >= 8; button('zoomout').disabled = zoom <= 1;
      Object.assign(selOver.style, { width: w + 'px', height: h + 'px', marginLeft: -w / 2 + 'px', marginTop: -h / 2 + 'px', transform: view.style.transform });
      placeCropbox(); placeMoving();
    };
    const dirty = () => history.some(e => !e.selOnly);
    const draw = () => {
      const scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
      view.width = comparing ? Math.max(1, Math.round(source.naturalWidth * scale)) : work.width; view.height = comparing ? Math.max(1, Math.round(source.naturalHeight * scale)) : work.height;
      const ctx = view.getContext('2d'); ctx.clearRect(0, 0, view.width, view.height); ctx.drawImage(comparing ? source : work, 0, 0, view.width, view.height);
      button('undo').disabled = !history.length; button('redo').disabled = !future.length; button('crop').disabled = !crop || Math.abs(crop.w) < 2 || Math.abs(crop.h) < 2;
      button('uncrop').disabled = rect.x === 0 && rect.y === 0 && rect.w === full.width && rect.h === full.height;
      button('compare').setAttribute('aria-pressed', String(comparing)); stage.classList.toggle('ic-original', comparing);
      pendingBox = null;
      if (mode === 'move' && !float && !comparing) { const b = maskBounds(sel, work.width, work.height, wctx.getImageData(0, 0, work.width, work.height).data); if (b) pendingBox = { w: b.w, h: b.h, T: identityFor(b) }; }
      drawOverlay(); readouts();
      layout();
    };
    const pos = event => { const r = view.getBoundingClientRect(); return { pressure: brushPressureScale(event.pointerType, event.pressure, $('#ic-pressure').checked), x: Math.max(0, Math.min(work.width, (event.clientX - r.left) * work.width / r.width)), y: Math.max(0, Math.min(work.height, (event.clientY - r.top) * work.height / r.height)) }; };
    const insidePicture = e => { const b = view.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; };
    const brush = (a, b) => {
      const r = view.getBoundingClientRect(), baseSize = boundedValue('#ic-brush', 2, 150) * work.width / r.width, feather = boundedValue('#ic-feather', 0, 100) / 100;
      const distance = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(0, Math.ceil(distance / Math.max(1, baseSize * Math.min(a.pressure ?? 1, b.pressure ?? 1) / 4)));
      for (let i = 0; i <= steps; i++) {
        const x = a.x + (b.x - a.x) * i / (steps || 1), y = a.y + (b.y - a.y) * i / (steps || 1), size = baseSize * ((a.pressure ?? 1) + ((b.pressure ?? 1) - (a.pressure ?? 1)) * i / (steps || 1));
        if (feather) {
          const radius = size / 2, left = Math.max(0, Math.floor(x - radius)), top = Math.max(0, Math.floor(y - radius)), width = Math.min(work.width, Math.ceil(x + radius)) - left, height = Math.min(work.height, Math.ceil(y + radius)) - top; if (width < 1 || height < 1) continue;
          const d = wctx.getImageData(left, top, width, height), base = original.getContext('2d').getImageData(left, top, width, height);
          d.data.set(featherBrushPixels(d.data, base.data, width, height, x - left, y - top, radius, feather, mode === 'restore')); wctx.putImageData(d, left, top);
        } else { wctx.save(); wctx.beginPath(); wctx.arc(x, y, size / 2, 0, Math.PI * 2); wctx.clip(); wctx.clearRect(x - size, y - size, size * 2, size * 2); if (mode === 'restore') wctx.drawImage(original, 0, 0); wctx.restore(); }
      }
    };
    const showRing = (e, on) => {
      if (!on || !brushMode() || comparing) { ring.style.display = 'none'; return; }
      const s = stage.getBoundingClientRect(), d = boundedValue('#ic-brush', 2, 150) * brushPressureScale(e.pointerType, e.pressure, $('#ic-pressure').checked) * zoom;
      Object.assign(ring.style, { display: 'block', width: d + 'px', height: d + 'px', transform: `translate(${e.clientX - s.left - d / 2}px,${e.clientY - s.top - d / 2}px)` });
    };

    // Select and Move. A selection is a mask over the picture (one byte a pixel). Move lifts the selected
    // ink (or the whole picture) as a floating piece with its own size, turn and flip, drawn over the
    // picture until it is placed, so moving it again never blurs it. Each drag is one undo step. A piece
    // moved past the edge grows the picture evenly on both sides, so its middle and every piece's real size
    // on the body stay the same (the width grows by `grow`).
    const widthIn = Number(options.widthInches) > 0 ? Number(options.widthInches) : 0;
    const ppi = () => widthIn ? work.width / (widthIn * grow) : 0;
    const maskCanvas = (m, w, h) => { const c = canvasOf(w, h), d = new ImageData(w, h); for (let i = 0; i < m.length; i++) { const j = i * 4; d.data[j] = d.data[j + 1] = d.data[j + 2] = 255; d.data[j + 3] = m[i]; } c.getContext('2d').putImageData(d, 0, 0); return c; };
    const selCanvas = () => { if (!sel) return null; if (!selCache || selCache.ver !== selVer) selCache = { ver: selVer, c: maskCanvas(sel, work.width, work.height) }; return selCache.c; };
    const setSel = m => { sel = m && m.length === work.width * work.height && !isEmptyMask(m) ? m : null; selVer++; };
    const maskFrom = (c, w, h) => { const d = c.getContext('2d').getImageData(0, 0, w, h).data, m = new Uint8Array(w * h); for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] >= 128 ? 255 : 0; return m; };
    const drawPiece = (ctx, src, f, T = f.T) => { ctx.save(); ctx.translate(T.cx, T.cy); ctx.rotate(T.rot); ctx.scale(T.s * T.fx, T.s * T.fy); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, -f.w / 2, -f.h / 2); ctx.restore(); };
    const workPt = (x, y) => { const r = view.getBoundingClientRect(); return { x: (x - r.left) * work.width / r.width, y: (y - r.top) * work.height / r.height }; };
    const onPiece = e => {
      const f = float || pendingBox; if (!f) return false;
      const p = workPt(e.clientX, e.clientY), l = pieceToLocal(f.T, f.w, f.h, p.x, p.y), slop = 16 * work.width / Math.max(1, view.getBoundingClientRect().width) / f.T.s;
      return l.x >= -slop && l.y >= -slop && l.x <= f.w + slop && l.y <= f.h + slop;
    };
    const selLook = t => {
      const key = selVer + ':' + t + ':' + work.width + 'x' + work.height; if (lookCache?.key === key) return lookCache.c;
      const w = work.width, h = work.height, m = selCanvas(), c = canvasOf(w, h), g = c.getContext('2d');
      g.fillStyle = 'rgba(10,10,14,.42)'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'destination-out'; g.drawImage(m, 0, 0);
      // an edge just outside the selection: white on a darker band, so it shows on any picture
      const ring = (k, color) => { const o = canvasOf(w, h), q = o.getContext('2d'); for (const [dx, dy] of [[-k, 0], [k, 0], [0, -k], [0, k], [-k, -k], [k, k], [-k, k], [k, -k]]) q.drawImage(m, dx, dy); q.globalCompositeOperation = 'destination-out'; q.drawImage(m, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = color; q.fillRect(0, 0, w, h); return o; };
      g.globalCompositeOperation = 'source-over'; g.drawImage(ring(t * 2, 'rgba(0,0,0,.65)'), 0, 0); g.drawImage(ring(t, '#fff'), 0, 0);
      lookCache = { key, c }; return c;
    };
    const drawOverlay = (preview = null) => {
      const on = !comparing && !float && (sel || preview) && (mode === 'select' || mode === 'move' || brushMode());
      if (!on) { selOver.style.display = 'none'; return; }
      if (selOver.width !== work.width || selOver.height !== work.height) { selOver.width = work.width; selOver.height = work.height; }
      selOver.style.display = 'block';
      const g = selOver.getContext('2d'), r = view.getBoundingClientRect(), t = Math.max(1, Math.round(1.5 * work.width / Math.max(1, r.width)));
      g.clearRect(0, 0, selOver.width, selOver.height); if (sel) g.drawImage(selLook(t), 0, 0);
      if (preview) {
        g.save(); g.lineWidth = t * 1.5; g.strokeStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = t * 2; g.setLineDash([t * 6, t * 4]); g.beginPath();
        if (preview.box) g.rect(preview.box.x, preview.box.y, preview.box.w, preview.box.h); else { preview.path.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.closePath(); }
        g.stroke(); g.restore();
      }
    };
    const placeMoving = () => {
      const r = view.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = r.width / work.width;
      const at = f => ({ x: r.left - s.left + f.T.cx * k, y: r.top - s.top + f.T.cy * k });
      if (!float || comparing) floatView.style.display = 'none';
      else {
        if (floatView._src !== float.src) { floatView.width = float.w; floatView.height = float.h; const g = floatView.getContext('2d'); g.clearRect(0, 0, float.w, float.h); g.drawImage(float.src, 0, 0); floatView._src = float.src; }
        const p = at(float), w = float.w * k, h = float.h * k, T = float.T;
        Object.assign(floatView.style, { display: 'block', width: w + 'px', height: h + 'px', transform: `translate(${p.x - w / 2}px,${p.y - h / 2}px) rotate(${T.rot}rad) scale(${T.s * T.fx},${T.s * T.fy})` });
      }
      const f = mode === 'move' && !comparing ? (float || pendingBox) : null;
      if (!f) { xbox.style.display = 'none'; return; }
      const p = at(f), w = f.w * f.T.s * k, h = f.h * f.T.s * k;
      Object.assign(xbox.style, { display: 'block', width: w + 'px', height: h + 'px', transform: `translate(${p.x - w / 2}px,${p.y - h / 2}px) rotate(${f.T.rot}rad)` });
    };
    const inches = (px, digits = 2) => (px / ppi()).toFixed(digits) + ' in';
    const readoutText = () => float ? moveWords(float.T0, float.T, float.w, float.h, ppi())
      : pendingBox ? `${sel ? 'The selection' : 'The whole picture'}, ${ppi() ? `${inches(pendingBox.w)} × ${inches(pendingBox.h)}` : `${pendingBox.w} × ${pendingBox.h} px`}. Drag it to move it.` : sel ? 'There is no ink in the selection.' : 'Nothing to move.';
    const readouts = () => {
      const r = $('[data-readout]'); if (r) r.textContent = readoutText();
      $('[data-hint-sel]').hidden = !sel || !brushMode();
      const info = $('[data-sel-info]');
      if (info && infoCache?.ver !== selVer + ':' + work.width) { const b = sel && maskBounds(sel, work.width, work.height); infoCache = { ver: selVer + ':' + work.width }; info.textContent = !b ? 'Nothing selected' : `Selected: ${ppi() ? `${inches(b.w)} × ${inches(b.h)}` : `${b.w} × ${b.h} px`}`; }
      $('[data-units]').textContent = ppi() ? 'Right and Down are in inches at the tattoo’s real size, from where it was picked up.' : 'Right and Down are in pixels, from where it was picked up.';
      const T = float?.T, T0 = float?.T0 || T, unit = ppi() || 1, set = (id, v) => { const n = $(id); if (document.activeElement !== n) n.value = v; };
      set('#ic-mx', T ? +((T.cx - T0.cx) / unit).toFixed(ppi() ? 2 : 0) : 0); set('#ic-my', T ? +((T.cy - T0.cy) / unit).toFixed(ppi() ? 2 : 0) : 0);
      set('#ic-ms', T ? Math.round(T.s * 100) : 100); set('#ic-mr', T ? Math.round(T.rot * 180 / Math.PI) : 0);
    };
    const showMoving = (live = false) => { placeMoving(); readouts(); if (live) say(readoutText(), true); };
    // Lift the selected ink, or all of it with nothing selected. A copy leaves the original where it is.
    const liftPiece = (copy = false) => {
      if (float) return true;
      const b = maskBounds(sel, work.width, work.height, wctx.getImageData(0, 0, work.width, work.height).data);
      if (!b) { say(sel ? 'There is no ink in the selection to move.' : 'There is nothing in the picture to move.'); return false; }
      endLive(); cut = null; snapshot();
      const src = canvasOf(b.w, b.h), g = src.getContext('2d'); g.drawImage(work, -b.x, -b.y);
      let mask = null;
      if (sel) { const mc = selCanvas(); g.globalCompositeOperation = 'destination-in'; g.drawImage(mc, -b.x, -b.y); mask = canvasOf(b.w, b.h); mask.getContext('2d').drawImage(mc, -b.x, -b.y); }
      if (!copy) { wctx.save(); if (sel) { wctx.globalCompositeOperation = 'destination-out'; wctx.drawImage(selCanvas(), 0, 0); } else wctx.clearRect(0, 0, work.width, work.height); wctx.restore(); }
      float = { src, mask, w: b.w, h: b.h, T: identityFor(b), T0: identityFor(b), copy };
      used.add('move'); pendingBox = null; draw(); return true;
    };
    const startStep = () => float ? (snapshot(), true) : liftPiece();
    const loadRect = () => { work.width = original.width = rect.w; work.height = original.height = rect.h; wctx.drawImage(full, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h); original.getContext('2d').drawImage(baseline, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h); };
    const resizeCanvas = (c, w, h, draw) => { const n = canvasOf(w, h), g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; draw(g, c); c.width = w; c.height = h; c.getContext('2d').drawImage(n, 0, 0); };
    // Grow evenly: the uncropped picture and the restore picture get the same transparent margin.
    const growPicture = (px, py) => {
      const W = work.width; merge();
      for (const c of [full, baseline]) resizeCanvas(c, c.width + 2 * px, c.height + 2 * py, (g, from) => g.drawImage(from, px, py));
      rect = { x: rect.x, y: rect.y, w: rect.w + 2 * px, h: rect.h + 2 * py };
      const fc = full.getContext('2d'); fc.clearRect(rect.x, rect.y, rect.w, rect.h); fc.drawImage(work, rect.x + px, rect.y + py);
      loadRect(); setSel(null);
      grow *= work.width / W;
    };
    // Keep the picture inside the 1600 px the cleanup works in: scale everything down together.
    const fitLimit = () => {
      const big = Math.max(full.width, full.height); if (big <= 1600) return;
      const k = 1600 / big, m = sel ? maskCanvas(sel, work.width, work.height) : null; merge();
      for (const c of [full, baseline]) resizeCanvas(c, Math.max(1, Math.round(c.width * k)), Math.max(1, Math.round(c.height * k)), (g, from) => g.drawImage(from, 0, 0, Math.max(1, Math.round(from.width * k)), Math.max(1, Math.round(from.height * k))));
      const x = Math.min(full.width - 1, Math.round(rect.x * k)), y = Math.min(full.height - 1, Math.round(rect.y * k));
      rect = { x, y, w: Math.max(1, Math.min(full.width - x, Math.round(rect.w * k))), h: Math.max(1, Math.min(full.height - y, Math.round(rect.h * k))) }; loadRect();
      if (m) { const c = canvasOf(work.width, work.height); c.getContext('2d').drawImage(m, 0, 0, work.width, work.height); setSel(maskFrom(c, work.width, work.height)); } else setSel(null);
    };
    // Place the floating piece. No undo step of its own: the picture looks the same before and after.
    const commitFloat = () => {
      if (!float) return false; const f = float; float = null; nudge = null;
      const { px, py } = growPads(f.T, f.w, f.h, work.width, work.height);
      if (px || py) growPicture(px, py);
      const T = { ...f.T, cx: f.T.cx + px, cy: f.T.cy + py };
      drawPiece(wctx, f.src, f, T);
      if (f.mask) { const c = canvasOf(work.width, work.height); drawPiece(c.getContext('2d'), f.mask, f, T); setSel(maskFrom(c, work.width, work.height)); } else setSel(null);
      fitLimit();
      if (px || py) say('The picture grew to fit it. The tattoo keeps its real size and its spot on the body.');
      return true;
    };
    const selOpNow = e => e?.shiftKey ? 'add' : e?.altKey ? 'subtract' : $('#ic-sel-op').value;
    const changeSel = (m, op) => {
      commitFloat(); endLive(); cut = null;
      const next = combineMasks(sel, m, op); if (next === sel) { draw(); return false; }
      snapshotSel(); setSel(next); used.add('select'); draw(); return true;
    };
    const tapSelect = (p, e) => {
      const r = view.getBoundingClientRect(), m = pieceMask(wctx.getImageData(0, 0, work.width, work.height).data, work.width, work.height, p.x, p.y, boundedValue('#ic-sel-reach', 0, 60), 24 * work.width / Math.max(1, r.width)), op = selOpNow(e);
      if (!m) { if (op === 'new' && sel) { changeSel(null, 'new'); say('Selection cleared.'); } else say('No ink there. Tap a piece of the design.'); return; }
      changeSel(m, op); say(op === 'subtract' ? 'Taken out of the selection.' : op === 'add' ? 'Added to the selection.' : 'Piece selected. Tap Move it to drag it, or pick Adds and tap more pieces.');
    };
    const previewOf = s => { const a = s.path[0], b = s.path.at(-1); return $('#ic-sel-shape').value === 'box' ? { box: { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y } } : { path: s.path }; };
    const finishSelDraw = (s, e) => {
      const pv = previewOf(s), m = pv.box ? rectMask(work.width, work.height, pv.box) : lassoMask(work.width, work.height, pv.path);
      if (isEmptyMask(m)) { say('That was too small to select anything.'); drawOverlay(); return; }
      const op = selOpNow(e); changeSel(m, op); say(op === 'subtract' ? 'Taken out of the selection.' : 'Selected. Tap Move it to drag it.');
    };
    const nudgeBy = (dx, dy) => {
      const now = performance.now();
      if (!float) { if (!liftPiece()) return; nudge = { at: now, n: history.length }; }
      else if (!nudge || now - nudge.at > 800 || nudge.n !== history.length) { snapshot(); nudge = { at: now, n: history.length }; }
      nudge.at = now; float.T = { ...float.T, cx: float.T.cx + dx, cy: float.T.cy + dy }; showMoving(true);
    };
    // with a selection, Erase and Restore only change what is selected: outside it the stroke is put back
    const keepOutside = (a, b) => {
      if (!stroke?.outside || !sel) return;
      const r = view.getBoundingClientRect(), size = boundedValue('#ic-brush', 2, 150) * work.width / r.width + 4;
      const x0 = Math.floor(Math.min(a.x, b.x) - size), y0 = Math.floor(Math.min(a.y, b.y) - size), x1 = Math.ceil(Math.max(a.x, b.x) + size), y1 = Math.ceil(Math.max(a.y, b.y) + size);
      wctx.save(); wctx.beginPath(); wctx.rect(x0, y0, x1 - x0, y1 - y0); wctx.clip(); wctx.globalCompositeOperation = 'destination-in'; wctx.drawImage(selCanvas(), 0, 0); wctx.globalCompositeOperation = 'source-over'; wctx.drawImage(stroke.outside, 0, 0); wctx.restore();
    };

    // Paper strength and darker lines show as you slide: the first change takes one undo step and keeps
    // the picture from before it, and every later change in the same go is worked out from that picture.
    const endLive = () => { live = null; };
    const liveOutput = (kind, data) => kind === 'paper'
      ? ($('#ic-paper-scope').value === 'edges' ? removeEdgeLightPixels(data, work.width, work.height, boundedValue('#ic-threshold', 100, 255)) : removeLightPixels(data, boundedValue('#ic-threshold', 100, 255)))
      : contrastPixels(data, boundedValue('#ic-contrast', -80, 150));
    const runLive = kind => {
      if (!live || live.kind !== kind || live.w !== work.width || live.h !== work.height) { cut = null; snapshot(); live = { kind, w: work.width, h: work.height, base: wctx.getImageData(0, 0, work.width, work.height) }; }
      wctx.putImageData(new ImageData(liveOutput(kind, live.base.data), live.w, live.h), 0, 0); draw();
    };
    const scheduleLive = kind => { if (livePending) return; livePending = requestAnimationFrame(() => { livePending = 0; if (!settled) runLive(kind); }); };

    // Automatic cutout. Taps add up: each one gathers another part of the design from
    // the picture as it was before the first tap. Any other edit starts a new cutout.
    let cutting = false, cut = null;
    const cutMessage = (keep, n) => (keep === 'ink' ? 'Ink lifted off the photo.' : 'Cut out.') + (n > 1 ? ` ${n} parts kept.` : '') + ' Tap another part to add it. Undo takes the last tap back.';
    const runCutout = async p => {
      if (cutting) return; cutting = true; endLive(); const keep = $('#ic-cutout-keep').value;
      say('Finding the tattoo. The first time takes a moment while the cutout tool loads.', true); host.setAttribute('aria-busy', 'true');
      try {
        const { segmentAt, tapMask, applyCutout } = await import('./auto-cutout.js');
        if (!cut || cut.w !== work.width || cut.h !== work.height) { const base = wctx.getImageData(0, 0, work.width, work.height), canvas = canvasOf(work.width, work.height); canvas.getContext('2d').putImageData(base, 0, 0); cut = { base, canvas, w: work.width, h: work.height, masks: [], steps: [] }; }
        const conf = await segmentAt(cut.canvas, p.x, p.y); if (settled || !cut) return;
        const mask = tapMask(conf, cut.w, cut.h, p.x, p.y), r = applyCutout(cut.base.data, cut.w, cut.h, [...cut.masks, mask], keep);
        snapshot(); cut.masks.push(mask); cut.steps.push('tap'); wctx.putImageData(new ImageData(r.data, cut.w, cut.h), 0, 0); say(cutMessage(keep, cut.masks.length));
      } catch (error) { say(error && /^(Nothing found|No dark ink)/.test(error.message) ? error.message : 'The cutout tool could not load. Check your connection and tap again.'); }
      finally { cutting = false; host.removeAttribute('aria-busy'); if (!settled) draw(); }
    };
    $('#ic-cutout-keep').addEventListener('change', async e => {
      if (!cut || !cut.masks.length || cutting) return;
      try { const { applyCutout } = await import('./auto-cutout.js'); const r = applyCutout(cut.base.data, cut.w, cut.h, cut.masks, e.target.value); endLive(); snapshot(); cut.steps.push('keep'); wctx.putImageData(new ImageData(r.data, cut.w, cut.h), 0, 0); say(cutMessage(e.target.value, cut.masks.length)); } catch (error) { say(error.message); }
      draw();
    });
    const removeColourAt = p => {
      const x = Math.min(work.width - 1, Math.floor(p.x)), y = Math.min(work.height - 1, Math.floor(p.y)), d = wctx.getImageData(0, 0, work.width, work.height);
      if (!d.data[(y * work.width + x) * 4 + 3]) { say('That spot is already clear. Tap the colour you want gone.'); return; }
      endLive(); cut = null; snapshot(); d.data.set(removeConnectedColor(d.data, work.width, work.height, x, y, boundedValue('#ic-color-tolerance', 0, 100))); wctx.putImageData(d, 0, 0); say('That colour is gone where it touches. Undo brings it back.'); draw();
    };

    // Segmented switches drive the hidden selects, so the selects stay the one source of truth.
    host.querySelectorAll('.ic-seg[data-select]').forEach(seg => {
      const select = $('#' + seg.dataset.select);
      seg.innerHTML = [...select.options].map(o => `<button type="button" data-value="${o.value}" aria-pressed="false">${o.textContent}</button>`).join('');
      const paint = () => seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === select.value)));
      seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || select.value === b.dataset.value) return; select.value = b.dataset.value; select.dispatchEvent(new Event('change', { bubbles: true })); });
      select.addEventListener('change', paint); paint();
    });
    $('#ic-paper-scope').addEventListener('change', () => { if (live?.kind === 'paper') runLive('paper'); });
    $('#ic-threshold').addEventListener('input', () => scheduleLive('paper'));
    $('#ic-contrast').addEventListener('input', () => scheduleLive('lines'));
    const backdrops = ['checker', 'white', 'dark'];
    $('#ic-backdrop').addEventListener('change', e => { stage.dataset.backdrop = e.target.value; });

    const setTool = m => {
      cancelStroke(); endLive(); if (mode === 'move' && m !== 'move') commitFloat(); mode = m; comparing = false; crop = null; hideConfirm();
      host.querySelectorAll('[data-mode]').forEach(n => n.setAttribute('aria-pressed', String(n.dataset.mode === m)));
      host.querySelectorAll('.ic-sec').forEach(s => { s.hidden = !s.dataset.for.split(' ').includes(m); });
      $('[data-hint-erase]').hidden = m !== 'erase'; $('[data-hint-restore]').hidden = m !== 'restore';
      stage.style.cursor = brushMode() ? 'none' : m === 'crop' || m === 'select' ? 'crosshair' : m === 'move' ? 'move' : m === 'lines' ? 'grab' : 'pointer';
      ring.style.display = 'none'; draw();
    };
    host.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.mode)));

    const hideConfirm = () => { confirmBox.hidden = true; };
    const finish = result => { if (settled) return; settled = true; if (livePending) cancelAnimationFrame(livePending); document.removeEventListener('keydown', keyOutside, true); window.removeEventListener('blur', cancelStroke); observer.disconnect(); host.remove(); previousFocus?.focus?.(); resolve(result); };
    const askCancel = () => { if (!dirty()) return finish(null); confirmBox.hidden = false; button('keep').focus(); };

    // Pointers: one finger or the Pencil uses the tool, two fingers pinch and pan in every tool.
    // A drag in a tap tool (Cut out, Background, Lines) moves the picture instead.
    const startMove = st => {
      st.future = future; st.undoTo = history.length;
      if (!startStep()) { st.kind = 'pan'; return false; }
      st.started = true; st.T0 = { ...float.T }; return true;
    };
    const stagePoint = (x, y) => { const s = stage.getBoundingClientRect(); return { x: x - s.left - s.width / 2, y: y - s.top - s.height / 2 }; };
    const cancelStroke = () => { if (stroke && stage.hasPointerCapture?.(stroke.id)) { try { stage.releasePointerCapture(stroke.id); } catch (_) { /* gone */ } } stroke = null; };
    const takeBackStroke = () => {
      if (!stroke) return;
      if ((stroke.kind === 'brush' || MOVE_KINDS.includes(stroke.kind)) && stroke.undoTo != null) { while (history.length > stroke.undoTo) restoreEntry(history.pop()); future = stroke.future; }
      if (stroke.kind === 'sel') drawOverlay();
      if (stroke.kind === 'crop') crop = stroke.cropBefore;
      cancelStroke(); draw();
    };
    stage.addEventListener('pointerdown', e => {
      if (cutting || settled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (e.target.closest('.ic-view')) return;
      hideConfirm();
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      const touches = [...pts.values()].filter(p => p.type === 'touch');
      if (touches.length === 2 && stroke && stroke.type === 'touch' && (stroke.kind === 'move' || stroke.kind === 'piece') && mode === 'move') {
        const other = [...pts.entries()].find(([id, p]) => id !== stroke.id && p.type === 'touch');
        if (other && (stroke.started || startMove(stroke))) {
          const a = workPt(pts.get(stroke.id).x, pts.get(stroke.id).y), b = workPt(other[1].x, other[1].y);
          Object.assign(stroke, { kind: 'xform2', id2: other[0], a0: a, b0: b, T0: { ...float.T }, moved: true });
          try { stage.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
          e.preventDefault(); return;
        }
      }
      if (touches.length === 2 && (!stroke || stroke.type === 'touch')) {
        if (stroke && (stroke.moved || stroke.kind === 'brush' || stroke.kind === 'crop' || (MOVE_KINDS.includes(stroke.kind) && stroke.started))) takeBackStroke(); else cancelStroke();
        const [a, b] = touches, mid = stagePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom0: zoom, mid0: mid, pan0: { x: panX, y: panY } }; ring.style.display = 'none'; e.preventDefault(); return;
      }
      // the Pencil wins over a resting palm: a finger stroke already going is taken back
      if (stroke && e.pointerType === 'pen' && stroke.type === 'touch' && !pinch) takeBackStroke();
      if (stroke || pinch) return;
      // once the Pencil is used, fingers move the picture and only the Pencil draws, as in Notes
      if (e.pointerType === 'pen' && !pencilSeen) { pencilSeen = true; const only = $('#ic-stylus-only'); if (!only.checked) { only.checked = true; say('Only the Pencil draws now. Fingers move the picture. Turn it off in Erase.'); } }
      e.preventDefault(); try { stage.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
      const start = { x: e.clientX, y: e.clientY };
      const stylusOnly = $('#ic-stylus-only').checked && e.pointerType !== 'pen';
      let kind = 'pan';
      if (comparing) kind = 'pan';
      else if (brushMode() || mode === 'crop') { if (stylusOnly) { kind = 'pan'; say('Only the Pencil draws. Fingers move the picture.'); } else if (insidePicture(e)) kind = brushMode() ? 'brush' : 'crop'; }
      else if (mode === 'cutout' || mode === 'color') kind = insidePicture(e) ? 'tap' : 'pan';
      else if (mode === 'select') kind = 'seltap';
      else if (mode === 'move') { const h = e.target.closest?.('[data-handle]'); kind = h ? h.dataset.handle : onPiece(e) ? 'move' : 'pan'; }
      stroke = { id: e.pointerId, type: e.pointerType, kind, start, pan0: { x: panX, y: panY }, moved: false, last: null };
      if (kind === 'seltap') stroke.path = [workPt(e.clientX, e.clientY)];
      if (kind === 'scale' || kind === 'turn') startMove(stroke);
      if (kind === 'brush') { endLive(); cut = null; stroke.future = future; stroke.undoTo = history.length; snapshot(); if (sel) { stroke.outside = canvasOf(work.width, work.height); const o = stroke.outside.getContext('2d'); o.drawImage(work, 0, 0); o.globalCompositeOperation = 'destination-out'; o.drawImage(selCanvas(), 0, 0); } stroke.last = pos(e); brush(stroke.last, stroke.last); keepOutside(stroke.last, stroke.last); showRing(e, true); draw(); }
      else if (kind === 'crop') { endLive(); stroke.cropBefore = crop; const p = pos(e); crop = { x: p.x, y: p.y, w: 0, h: 0 }; draw(); }
    });
    stage.addEventListener('pointermove', e => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      if (pinch) {
        const touches = [...pts.values()].filter(p => p.type === 'touch'); if (touches.length < 2) return; e.preventDefault();
        const [a, b] = touches, mid = stagePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoom = Math.max(1, Math.min(8, pinch.zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0));
        const p = pinchPan(pinch.mid0, pinch.pan0, pinch.zoom0, mid, zoom); panX = p.x; panY = p.y; layout(); return;
      }
      if (stroke?.kind === 'xform2' && (e.pointerId === stroke.id || e.pointerId === stroke.id2)) {
        e.preventDefault(); const p1 = pts.get(stroke.id), p2 = pts.get(stroke.id2); if (!p1 || !p2 || !float) return;
        const T = twoFingerTransform(stroke.T0, stroke.a0, stroke.b0, workPt(p1.x, p1.y), workPt(p2.x, p2.y));
        float.T = { ...T, rot: $('#ic-snap').checked ? snapTurn(T.rot) : T.rot }; showMoving(true); return;
      }
      if (!stroke || e.pointerId !== stroke.id) { if (e.pointerType === 'pen' && !pts.size) showRing(e, true); return; }
      e.preventDefault();
      if (MOVE_KINDS.includes(stroke.kind)) {
        if (!stroke.moved && Math.hypot(e.clientX - stroke.start.x, e.clientY - stroke.start.y) > 4) stroke.moved = true;
        if (!stroke.moved || (!stroke.started && !startMove(stroke))) return;
        const r = view.getBoundingClientRect(), k = work.width / r.width, T0 = stroke.T0, snap = $('#ic-snap').checked;
        if (stroke.kind === 'move') { const d = snap ? snapStraight((e.clientX - stroke.start.x) * k, (e.clientY - stroke.start.y) * k, 7, e.shiftKey) : { dx: (e.clientX - stroke.start.x) * k, dy: (e.clientY - stroke.start.y) * k }; float.T = { ...T0, cx: T0.cx + d.dx, cy: T0.cy + d.dy }; }
        else {
          const c = { x: r.left + T0.cx / k, y: r.top + T0.cy / k }, d0 = Math.max(4, Math.hypot(stroke.start.x - c.x, stroke.start.y - c.y)), d1 = Math.hypot(e.clientX - c.x, e.clientY - c.y);
          if (stroke.kind === 'scale') float.T = { ...T0, s: Math.max(0.05, Math.min(20, T0.s * d1 / d0)) };
          else { const rot = T0.rot + Math.atan2(e.clientY - c.y, e.clientX - c.x) - Math.atan2(stroke.start.y - c.y, stroke.start.x - c.x); float.T = { ...T0, rot: snap ? snapTurn(rot) : rot }; }
        }
        showMoving(true); return;
      }
      if (stroke.kind === 'seltap' || stroke.kind === 'sel') {
        if (stroke.kind === 'seltap' && Math.hypot(e.clientX - stroke.start.x, e.clientY - stroke.start.y) > 8) stroke.kind = 'sel';
        if (stroke.kind === 'sel') { stroke.path.push(workPt(e.clientX, e.clientY)); drawOverlay(previewOf(stroke)); }
        return;
      }
      if (!stroke.moved && Math.hypot(e.clientX - stroke.start.x, e.clientY - stroke.start.y) > 8) stroke.moved = true;
      if (stroke.kind === 'tap' && stroke.moved) stroke.kind = 'pan';
      if (stroke.kind === 'pan') { panX = stroke.pan0.x + e.clientX - stroke.start.x; panY = stroke.pan0.y + e.clientY - stroke.start.y; layout(); return; }
      if (stroke.kind === 'crop') { const p = pos(e); crop.w = p.x - crop.x; crop.h = p.y - crop.y; draw(); return; }
      if (stroke.kind === 'brush') { const p = pos(e); brush(stroke.last, p); keepOutside(stroke.last, p); stroke.last = p; showRing(e, true); draw(); }
    });
    const endPointer = (e, cancelled) => {
      pts.delete(e.pointerId);
      if (pinch) { if ([...pts.values()].filter(p => p.type === 'touch').length < 2) pinch = null; return; }
      if (stroke?.kind === 'xform2' && (e.pointerId === stroke.id || e.pointerId === stroke.id2)) {
        if (cancelled) { takeBackStroke(); return; }
        const other = e.pointerId === stroke.id ? stroke.id2 : stroke.id; cancelStroke(); try { stage.releasePointerCapture(other); } catch (_) { /* gone */ }
        say(readoutText()); draw(); return;
      }
      if (!stroke || e.pointerId !== stroke.id) return;
      if (MOVE_KINDS.includes(stroke.kind)) {
        if (cancelled) { takeBackStroke(); return; }
        const s = stroke; cancelStroke(); if (s.started) { say(readoutText()); draw(); } return;
      }
      if (stroke.kind === 'sel' || stroke.kind === 'seltap') {
        const s = stroke; cancelStroke(); if (cancelled) { drawOverlay(); return; }
        if (s.kind === 'sel') finishSelDraw(s, e); else tapSelect(workPt(e.clientX, e.clientY), e); return;
      }
      const s = stroke; cancelStroke(); if (e.pointerType !== 'pen') showRing(e, false);
      if (s.kind === 'tap' && !cancelled) { const p = pos(e); if (mode === 'cutout') runCutout(p); else removeColourAt(p); }
      if (s.kind === 'crop') { if (!crop || Math.abs(crop.w) < 2 || Math.abs(crop.h) < 2) crop = null; else { const b = boxOf(crop); $('#ic-x').value = b.x; $('#ic-y').value = b.y; $('#ic-w').value = b.w; $('#ic-h').value = b.h; say('Tap Crop to keep what is inside the box.'); } draw(); }
    };
    stage.addEventListener('pointerup', e => endPointer(e, false));
    stage.addEventListener('pointercancel', e => endPointer(e, true));
    stage.addEventListener('lostpointercapture', e => { if (stroke && e.pointerId === stroke.id && !pts.has(e.pointerId) && stroke.kind !== 'xform2') cancelStroke(); });
    stage.addEventListener('pointerleave', e => { if (!stroke) showRing(e, false); });
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { const mid = stagePoint(e.clientX, e.clientY), z0 = zoom; zoom = Math.max(1, Math.min(8, zoom * Math.exp(-e.deltaY / 200))); const p = pinchPan(mid, { x: panX, y: panY }, z0, mid, zoom); panX = p.x; panY = p.y; }
      else { panX -= e.deltaX; panY -= e.deltaY; }
      layout();
    }, { passive: false });

    const key = e => {
      if (settled) return;
      const typing = e.target instanceof HTMLInputElement && e.target.type === 'number';
      e.stopPropagation(); // keys stay in the workspace: nothing reaches the body behind it
      if (e.key === 'Escape') { e.preventDefault(); if (!confirmBox.hidden) hideConfirm(); else askCancel(); return; }
      if (e.key === 'Tab') { const els = [...host.querySelectorAll('button:not(:disabled),input,summary,ink-slider')].filter(n => n.offsetParent); const first = els[0], end = els.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); } else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); } return; }
      if (typing) return;
      const cmd = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      if (cmd && k === 'z') { e.preventDefault(); act(e.shiftKey ? 'redo' : 'undo'); return; }
      if (cmd && k === 'y') { e.preventDefault(); act('redo'); return; }
      if (cmd && e.key === 'Enter') { e.preventDefault(); act('apply'); return; }
      if (cmd && k === 'a') { e.preventDefault(); act('selall'); return; }
      if (cmd && k === 'd') { e.preventDefault(); act('selnone'); return; }
      if (cmd && e.shiftKey && k === 'i') { e.preventDefault(); act('selinvert'); return; }
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (arrows && mode === 'move' && !cmd && !(e.target instanceof HTMLElement && e.target.closest('ink-slider'))) { e.preventDefault(); const n = e.shiftKey ? 10 : 1; nudgeBy(arrows[0] * n, arrows[1] * n); return; }
      if (e.key === 'Enter' && mode === 'move' && float && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); act('place'); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (sel || float)) { e.preventDefault(); act('seldelete'); return; }
      if (cmd || e.altKey) return;
      if (TOOL_KEYS[k] && !(e.target instanceof HTMLElement && e.target.closest('ink-slider'))) { e.preventDefault(); setTool(TOOL_KEYS[k]); return; }
      if (e.key === '[' || e.key === ']') { e.preventDefault(); const s = $('#ic-brush'); s.value = Math.round(s.value * (e.key === '[' ? 1 / 1.25 : 1.25)); return; }
      if (e.key === '0') { e.preventDefault(); act('fit'); return; }
      if (e.key === '=' || e.key === '+' || e.key === '-') { e.preventDefault(); act(e.key === '-' ? 'zoomout' : 'zoomin'); }
    };
    const keyOutside = e => { if (!host.contains(e.target)) key(e); };
    host.addEventListener('keydown', key); document.addEventListener('keydown', keyOutside, true); window.addEventListener('blur', cancelStroke);
    // a box drawn either way, in whole pixels inside the picture (the exact size fields show it too)
    const boxOf = c => { const x = Math.max(0, Math.floor(Math.min(c.x, c.x + c.w))), y = Math.max(0, Math.floor(Math.min(c.y, c.y + c.h))); return { x, y, w: Math.max(1, Math.min(work.width - x, Math.round(Math.abs(c.w)))), h: Math.max(1, Math.min(work.height - y, Math.round(Math.abs(c.h)))) }; };
    const syncFields = () => { $('#ic-x').value = $('#ic-y').value = 0; $('#ic-w').value = work.width; $('#ic-h').value = work.height; };
    const applyCrop = c => { const { x, y, w, h } = exactCrop(c, work.width, work.height); endLive(); snapshot(); merge(); rect = { x: rect.x + x, y: rect.y + y, w, h }; const p = wctx.getImageData(x, y, w, h), o = original.getContext('2d').getImageData(x, y, w, h); work.width = original.width = w; work.height = original.height = h; wctx.putImageData(p, 0, 0); original.getContext('2d').putImageData(o, 0, 0); crop = null; setSel(null); fit(); syncFields(); };
    const observer = new ResizeObserver(layout); observer.observe(stage);

    const VIEW_ONLY = ['fit', 'zoomin', 'zoomout', 'compare', 'cancel', 'apply', 'undo', 'backdrop', 'discard', 'keep'];
    // actions that leave a floating piece up (the rest place it first)
    const FLOAT_KEEP = ['fit', 'zoomin', 'zoomout', 'compare', 'cancel', 'discard', 'keep', 'backdrop', 'undo', 'redo', 'flipx', 'flipy', 'turn90', 'putback', 'duplicate', 'exactmove', 'seldelete', 'tomove'];
    const pieceStep = change => { if (!startStep()) return true; float.T = change({ ...float.T }); showMoving(); say(readoutText()); return true; };
    const selectAction = action => {
      if (action === 'selall') { changeSel(rectMask(work.width, work.height, { x: 0, y: 0, w: work.width, h: work.height }), 'new'); say('Everything is selected.'); return true; }
      if (action === 'selnone') { if (!sel) say('Nothing is selected.'); else { changeSel(null, 'new'); say('Selection cleared.'); } return true; }
      if (action === 'selinvert') { if (!sel) { say('Select something first, then flip the selection to everything else.'); return true; } changeSel(invertMask(sel), 'new'); say(sel ? 'Now everything else is selected.' : 'Nothing is left outside the selection.'); return true; }
      if (action === 'seldelete') {
        if (float) { snapshot(); float = null; setSel(null); say('Deleted. Undo brings it back.'); return true; }
        if (!sel) { say('Select something first.'); return true; }
        endLive(); cut = null; snapshot(); wctx.save(); wctx.globalCompositeOperation = 'destination-out'; wctx.drawImage(selCanvas(), 0, 0); wctx.restore(); say('Deleted. Undo brings it back.'); return true;
      }
      if (action === 'tomove') { setTool('move'); say(pendingBox ? 'Drag the selection to move it. Use the corners to size it and the dot to turn it.' : readoutText()); return true; }
      if (action === 'flipx') return pieceStep(T => ({ ...T, fx: -T.fx }));
      if (action === 'flipy') return pieceStep(T => ({ ...T, fy: -T.fy }));
      if (action === 'turn90') return pieceStep(T => ({ ...T, rot: snapTurn(T.rot + Math.PI / 2, 0.001) }));
      if (action === 'putback') { if (!float) { say('Nothing has been moved yet.'); return true; } return pieceStep(() => ({ ...float.T0 })); }
      if (action === 'place') { if (commitFloat()) say('Placed.'); else say('Nothing to place.'); return true; }
      if (action === 'duplicate') {
        commitFloat(); if (!liftPiece(true)) return true;
        const k = work.width / Math.max(1, view.getBoundingClientRect().width); float.T = { ...float.T, cx: float.T.cx + 24 * k, cy: float.T.cy + 24 * k }; float.T0 = { ...float.T };
        if (mode !== 'move') setTool('move'); showMoving(); say('A copy is up. Drag it where you want it.'); return true;
      }
      if (action === 'exactmove') {
        const num = id => { const n = Number($(id).value); return Number.isFinite(n) ? n : 0; }, unit = ppi() || 1;
        if (!float) { if (!liftPiece()) return true; } else snapshot();
        const T0 = float.T0; float.T = { ...float.T, cx: T0.cx + num('#ic-mx') * unit, cy: T0.cy + num('#ic-my') * unit, s: Math.max(0.05, Math.min(20, (num('#ic-ms') || 100) / 100)), rot: num('#ic-mr') * Math.PI / 180 };
        showMoving(); say(readoutText()); return true;
      }
      return false;
    };
    async function act(action) {
      if (settled) return; cancelStroke();
      if (action !== 'cancel') hideConfirm();
      if (cut) { if (action === 'undo' && history.length) { if (cut.steps.pop() === 'tap') cut.masks.pop(); if (!cut.steps.length) cut = null; } else if (!VIEW_ONLY.includes(action)) cut = null; }
      if (action === 'cancel') return askCancel();
      if (action === 'discard') return finish(null);
      if (action === 'keep') return;
      if (!FLOAT_KEEP.includes(action)) commitFloat();
      if (selectAction(action)) { draw(); return; }
      if (action === 'apply') {
        host.querySelectorAll('button,input').forEach(b => b.disabled = true);
        try { merge(); const dataUrl = work.toDataURL('image/png'), saved = validateCleanupSession({ version: 1, sourceHash, outputHash: await fingerprint(dataUrl), workingDataUrl: full.toDataURL('image/png'), restoreDataUrl: baseline.toDataURL('image/png'), crop: { ...rect } }); return finish({ dataUrl, aspect: work.width / work.height, session: saved, linked: linkedCount >= 2 ? !!$('#ic-linked')?.checked : undefined, widthScale: Math.abs(grow - 1) > 1e-6 ? grow : undefined, used: [...used], settings: { paperThreshold: boundedValue('#ic-threshold', 100, 255), contrast: boundedValue('#ic-contrast', -80, 150) } }); }
        catch (error) { host.querySelectorAll('button,input').forEach(b => b.disabled = false); say(error.message, true); draw(); return; }
      }
      if (action === 'backdrop') { const s = $('#ic-backdrop'); s.value = backdrops[(backdrops.indexOf(s.value) + 1) % backdrops.length]; s.dispatchEvent(new Event('change')); say(`Backdrop: ${s.selectedOptions[0].textContent}.`); return; }
      if (action === 'fit' || action === 'zoomin' || action === 'zoomout') { if (action === 'fit') fit(); else zoom = Math.max(1, Math.min(8, zoom * (action === 'zoomin' ? 1.5 : 1 / 1.5))); layout(); return; }
      if (action === 'compare') { comparing = !comparing; fit(); if (comparing) say('This is your original picture. Tap again to go back.'); draw(); return; }
      comparing = false;
      if (action === 'trim' || action === 'exactcrop') {
        let c; try { c = action === 'trim' ? transparencyBounds(wctx.getImageData(0, 0, work.width, work.height).data, work.width, work.height) : exactCrop({ x: Number($('#ic-x').value), y: Number($('#ic-y').value), w: Number($('#ic-w').value), h: Number($('#ic-h').value) }, work.width, work.height); } catch (error) { say(error.message); return; }
        if (!c) { say('Nothing to trim: the picture is empty.'); return; }
        if (c.x === 0 && c.y === 0 && c.w === work.width && c.h === work.height) { say('Already trimmed.'); return; }
        crop = c; applyCrop(c); say(action === 'trim' ? 'Empty edges trimmed. Undo puts them back.' : 'Cropped. Undo puts it back.'); draw(); return;
      }
      const dims = work.width + 'x' + work.height;
      if (action === 'undo' && history.length) { endLive(); const e = history.pop(); future.push(entryNow(e)); trim(future); restoreEntry(e); say(e.selOnly ? 'Selection undone.' : 'Undone.'); }
      if (action === 'redo' && future.length) { endLive(); const e = future.pop(); history.push(entryNow(e)); trim(history); restoreEntry(e); say('Redone.'); }
      if ((action === 'undo' || action === 'redo') && float && mode !== 'move') setTool('move');
      if (action === 'reset') { endLive(); snapshot(); setImage(source); crop = null; float = null; setSel(null); grow = 1; say('Back to the original. Undo brings your edits back.'); }
      if (action === 'paper') {
        if (live?.kind === 'paper') say('White paper is already off. Slide Light shades kept to the left to take away more.');
        else { runLive('paper'); say($('#ic-paper-scope').value === 'edges' ? 'White paper at the edges removed. Light areas inside the lines are kept.' : 'White paper removed. Slide Light shades kept to take away more or less.'); }
      }
      if (action === 'contrast') { if (live?.kind === 'lines') say('Slide Darker lines to change how much.'); else { runLive('lines'); say('Lines darkened. Slide to change how much.'); } }
      if (action === 'uncrop') { endLive(); snapshot(); merge(); work.width = original.width = full.width; work.height = original.height = full.height; wctx.drawImage(full, 0, 0); original.getContext('2d').drawImage(baseline, 0, 0); rect = { x: 0, y: 0, w: full.width, h: full.height }; crop = null; setSel(null); say('The whole picture is back. Your edits are kept.'); }
      if (action === 'crop' && crop) { applyCrop(boxOf(crop)); say('Cropped. Undo puts it back.'); }
      if (['reset', 'uncrop'].includes(action) || (['undo', 'redo'].includes(action) && dims !== work.width + 'x' + work.height)) { fit(); syncFields(); }
      draw();
    }
    host.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (!b || b.disabled) return; act(b.dataset.action); });

    setImage(current);
    if (session) { full.width = baseline.width = fullImage.naturalWidth; full.height = baseline.height = fullImage.naturalHeight; full.getContext('2d').drawImage(fullImage, 0, 0); baseline.getContext('2d').drawImage(restoreImage, 0, 0); rect = { ...session.crop }; work.width = original.width = rect.w; work.height = original.height = rect.h; wctx.drawImage(full, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h); original.getContext('2d').drawImage(baseline, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h); }
    syncFields();
    const edge = session ? 'clear' : edgeKind(wctx.getImageData(0, 0, work.width, work.height).data, work.width, work.height), paper = edge === 'paper' || edge === 'white';
    if (paper) { const level = paperLevel(wctx.getImageData(0, 0, work.width, work.height).data, work.width, work.height); if (level != null) $('#ic-threshold').value = Math.max(150, Math.min(235, level - 8)); }
    setTool(options.tool && TOOLS.some(t => t[0] === options.tool) ? options.tool : paper ? 'color' : edge === 'opaque' ? 'cutout' : 'erase');
    say(session ? 'Picked up where you left off.' : paper ? 'This picture is on paper. Remove white paper, or tap the background to take that colour away.' : edge === 'opaque' ? 'Tap the design to cut it out of the photo. Pick another tool below if you need it.' : 'Drag to erase. Pick a tool below for more.');
    button('cancel').focus({ preventScroll: true });
  });
}
