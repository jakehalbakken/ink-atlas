// Local-only artwork editor. The caller retains the untouched source artwork.
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
export async function editArtwork(sourceDataUrl, currentDataUrl = sourceDataUrl, priorSession = null) {
  const sourceHash=await fingerprint(sourceDataUrl);let session=null,fullImage=null,restoreImage=null;
  if(priorSession){session=validateCleanupSession(priorSession);if(session.sourceHash!==sourceHash||session.outputHash!==await fingerprint(currentDataUrl))throw new Error('Cleanup session does not match this source and edited image');[fullImage,restoreImage]=await Promise.all([picture(session.workingDataUrl),picture(session.restoreDataUrl)]);}
  const [source, current] = await Promise.all([picture(sourceDataUrl), picture(currentDataUrl)]);
  if(session){
    const c=session.crop;if(current.naturalWidth!==c.w||current.naturalHeight!==c.h)throw new Error('Cleanup crop does not match the edited image dimensions');
    const a=canvasOf(c.w,c.h),b=canvasOf(c.w,c.h),ac=a.getContext('2d'),bc=b.getContext('2d');ac.drawImage(fullImage,c.x,c.y,c.w,c.h,0,0,c.w,c.h);bc.drawImage(current,0,0);const x=ac.getImageData(0,0,c.w,c.h).data,y=bc.getImageData(0,0,c.w,c.h).data;
    if(x.some((v,i)=>v!==y[i]))throw new Error('Cleanup working pixels do not match the edited image');
  }

  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const host = document.createElement('div'); host.id = 'ink-cleanup'; host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-labelledby', 'ic-title');
    host.innerHTML = `<style>
#ink-cleanup{position:fixed;inset:0;z-index:10000;background:#f4f1eb;color:#242725;display:flex;flex-direction:column;padding:12px;box-sizing:border-box;font:16px system-ui;overscroll-behavior:none}
#ink-cleanup *{box-sizing:border-box}#ink-cleanup header,#ink-cleanup .ic-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#ink-cleanup header{justify-content:space-between}#ink-cleanup h2{font-size:20px;margin:0}#ink-cleanup button,#ink-cleanup select,#ink-cleanup input{min-height:44px;font:inherit;border:1px solid #aaa69e;border-radius:10px;background:#fff;color:inherit;padding:8px 12px}#ink-cleanup button:disabled{opacity:.4}#ink-cleanup button[aria-pressed=true]{background:#d5e8df;border-color:#34725d}#ink-cleanup .ic-primary{background:#234e40;color:white}#ink-cleanup .ic-tools{max-height:35vh;overflow:auto;flex:none;padding:8px 0;display:grid;gap:8px;touch-action:pan-y}#ink-cleanup label{display:flex;align-items:center;gap:6px}#ink-cleanup input[type=number]{width:80px}#ink-cleanup .ic-work{flex:1;min-height:100px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;touch-action:none;background:repeating-conic-gradient(#dedbd4 0% 25%,#f9f7f2 0% 50%) 50%/24px 24px;border-radius:12px}#ink-cleanup canvas{max-width:none;max-height:none;flex:none;touch-action:none;display:block;transform-origin:center}#ink-cleanup summary{min-height:44px;padding:12px 4px;cursor:pointer}#ink-cleanup .ic-note{font-size:13px;margin:6px 0;color:#555}#ink-cleanup footer{display:flex;justify-content:space-between;gap:8px;padding-top:8px}#ink-cleanup .ic-status{font-size:13px;margin:5px 0;min-height:18px}
</style><header><h2 id="ic-title">Clean up tattoo</h2><button data-action="cancel">Cancel</button></header>
<p class="ic-note">Local edits only. Your source picture is kept. Remove light backgrounds from pale paper, or erase by hand; this is not automatic subject cutout. Saved sessions keep crop, outside pixels and the restore baseline. Undo starts fresh when reopened; contrast and paper removal are baked into pixels, not editable layers.</p>
<div class="ic-tools"><div class="ic-row"><button data-mode="erase" aria-pressed="true">Erase</button><button data-mode="restore" aria-pressed="false">Restore</button><button data-mode="crop" aria-pressed="false">Crop</button><label><input id="ic-stylus-only" type="checkbox"> Stylus-only drawing</label><label>Brush <input id="ic-brush" type="number" min="2" max="150" value="24" aria-label="Brush width"></label><button data-action="crop" disabled>Apply crop</button><button data-action="uncrop">Remove crop</button></div>
<div class="ic-row"><label>Paper threshold <input id="ic-threshold" type="number" min="100" max="255" value="235"></label><label>Scope <select id="ic-paper-scope" aria-label="Light background removal scope"><option value="all">All light pixels</option><option value="edges">Edge-connected only</option></select></label><button data-action="paper">Remove light background</button><label>Contrast <input id="ic-contrast" type="number" min="-80" max="150" value="25"></label><button data-action="contrast">Apply contrast</button></div>
<div class="ic-row"><button data-mode="pan" aria-pressed="false">Pan</button><button data-action="zoomout" aria-label="Zoom out">−</button><output id="ic-zoom" aria-live="polite">100%</output><button data-action="zoomin" aria-label="Zoom in">+</button><button data-action="fit">Fit</button><label>Backdrop <select id="ic-backdrop"><option value="checker">Checker</option><option value="white">White</option><option value="dark">Dark</option></select></label></div>
<details><summary>Brush feel</summary><div class="ic-row"><label><input id="ic-pressure" type="checkbox"> Pen pressure changes size</label><label>Feather % <input id="ic-feather" type="number" min="0" max="100" value="0"></label></div><p class="ic-note">Default: hard, fixed-size brush. Pressure affects pen size only; mouse and touch stay fixed. Feather blends erase/restore edges into pixels, not editable layers.</p></details>
<details><summary>Colored background removal</summary><p class="ic-note">Tap a background color to remove only its connected region. Tolerance is RGB difference (0–100). Similar-colored artwork connected to it can also be removed. Transparent gaps stop removal. Not AI subject cutout; Undo or Restore recovers details.</p><div class="ic-row"><button data-mode="color" aria-pressed="false">Tap color to remove</button><label>Tolerance <input id="ic-color-tolerance" type="number" min="0" max="100" value="24"></label></div></details>
<details><summary>Exact crop &amp; transparent edges</summary><p class="ic-note">Whole pixels in the current image. Trim keeps even faint visible pixels.</p><div class="ic-row"><label>X <input id="ic-x" type="number" min="0" value="0"></label><label>Y <input id="ic-y" type="number" min="0" value="0"></label><label>Width <input id="ic-w" type="number" min="1"></label><label>Height <input id="ic-h" type="number" min="1"></label><button data-action="exactcrop">Crop to pixels</button><button data-action="trim">Trim transparent edges</button></div></details>
<div class="ic-row"><button data-action="undo" disabled>Undo</button><button data-action="redo" disabled>Redo</button><button data-action="compare" aria-pressed="false">Compare original</button><button data-action="reset">Reset to source</button></div></div>
<div class="ic-work"><canvas aria-label="Tattoo cleanup canvas"></canvas></div><p class="ic-status" role="status">Drag to erase. Restore brings back pixels from the retained cleanup baseline.</p><footer><span class="ic-note">Nothing changes until you apply.</span><button class="ic-primary" data-action="apply">Apply cleanup</button></footer>`;
    (document.querySelector('#viewport') || document.body).append(host);
    const view = host.querySelector('canvas'), work = canvasOf(1, 1), original = canvasOf(1, 1), wctx = work.getContext('2d', {willReadFrequently: true});
    const status = host.querySelector('.ic-status'), full=canvasOf(1,1), baseline=canvasOf(1,1);let rect={x:0,y:0,w:1,h:1};
    let zoom=1,panX=0,panY=0,panStart=null;const stage=host.querySelector('.ic-work');
    let history = [], future = [], mode = 'erase', comparing = false, crop = null, pointer = null, last = null, settled = false;
    const button = action => host.querySelector(`[data-action="${action}"]`);
    const setImage = image => { const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight)); work.width = Math.max(1, Math.round(image.naturalWidth * scale)); work.height = Math.max(1, Math.round(image.naturalHeight * scale)); wctx.drawImage(image, 0, 0, work.width, work.height); original.width = work.width; original.height = work.height; original.getContext('2d').drawImage(work, 0, 0);full.width=baseline.width=work.width;full.height=baseline.height=work.height;full.getContext('2d').drawImage(work,0,0);baseline.getContext('2d').drawImage(work,0,0);rect={x:0,y:0,w:work.width,h:work.height}; };
    const merge=()=>{const ctx=full.getContext('2d');ctx.clearRect(rect.x,rect.y,rect.w,rect.h);ctx.drawImage(work,rect.x,rect.y);};
    const capture = () => ({fw:full.width,fh:full.height,full:full.getContext('2d').getImageData(0,0,full.width,full.height),baseline:baseline.getContext('2d').getImageData(0,0,baseline.width,baseline.height),rect:{...rect},w:work.width, h:work.height, pixels:wctx.getImageData(0,0,work.width,work.height), original:original.getContext('2d').getImageData(0,0,original.width,original.height)});
    const trim = stack => { while(stack.length>1 && stack.reduce((n,s)=>n+(s.w*s.h+s.fw*s.fh)*8,0)>48*1024*1024)stack.shift(); };
    const snapshot = () => { history.push(capture()); trim(history); future=[]; };
    const restore = state => { work.width=original.width=state.w; work.height=original.height=state.h; wctx.putImageData(state.pixels,0,0); original.getContext('2d').putImageData(state.original,0,0);full.width=baseline.width=state.fw;full.height=baseline.height=state.fh;full.getContext('2d').putImageData(state.full,0,0);baseline.getContext('2d').putImageData(state.baseline,0,0);rect={...state.rect};crop=null; };
    const fit=()=>{zoom=1;panX=panY=0;};
    const layout=()=>{const scale=Math.min(1,stage.clientWidth/view.width,stage.clientHeight/view.height),w=view.width*scale,h=view.height*scale;panX=Math.max(-Math.max(0,(w*zoom-stage.clientWidth)/2),Math.min(Math.max(0,(w*zoom-stage.clientWidth)/2),panX));panY=Math.max(-Math.max(0,(h*zoom-stage.clientHeight)/2),Math.min(Math.max(0,(h*zoom-stage.clientHeight)/2),panY));view.style.width=w+'px';view.style.height=h+'px';view.style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`;host.querySelector('#ic-zoom').value=Math.round(zoom*100)+'%';button('zoomin').disabled=zoom>=8;button('zoomout').disabled=zoom<=1;};
    const draw = () => { const scale=Math.min(1,1600/Math.max(source.naturalWidth,source.naturalHeight));view.width=comparing?Math.max(1,Math.round(source.naturalWidth*scale)):work.width;view.height=comparing?Math.max(1,Math.round(source.naturalHeight*scale)):work.height; const ctx=view.getContext('2d'); ctx.drawImage(comparing ? source : work,0,0,view.width,view.height); if(crop&&!comparing){ctx.strokeStyle='#00a48b';ctx.lineWidth=Math.max(2,work.width/300);ctx.setLineDash([8,6]);ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);} button('undo').disabled=!history.length;button('redo').disabled=!future.length;button('crop').disabled=!crop||Math.abs(crop.w)<2||Math.abs(crop.h)<2; button('uncrop').disabled=rect.x===0&&rect.y===0&&rect.w===full.width&&rect.h===full.height;button('compare').setAttribute('aria-pressed',String(comparing));layout(); };
    const boundedValue = (id,min,max) => { const n=Number(host.querySelector(id).value);return Math.min(max,Math.max(min,Number.isFinite(n)?n:min)); };
    const pos = event => { const r=view.getBoundingClientRect();return {pressure:brushPressureScale(event.pointerType,event.pressure,host.querySelector('#ic-pressure').checked),x:Math.max(0,Math.min(work.width,(event.clientX-r.left)*work.width/r.width)),y:Math.max(0,Math.min(work.height,(event.clientY-r.top)*work.height/r.height))}; };
    const brush = (a,b) => { const r=view.getBoundingClientRect(),baseSize=boundedValue('#ic-brush',2,150)*work.width/r.width,feather=boundedValue('#ic-feather',0,100)/100;const distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(0,Math.ceil(distance/Math.max(1,baseSize*Math.min(a.pressure??1,b.pressure??1)/4)));for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/(steps||1),y=a.y+(b.y-a.y)*i/(steps||1),size=baseSize*((a.pressure??1)+((b.pressure??1)-(a.pressure??1))*i/(steps||1));
 if(feather){const radius=size/2,left=Math.max(0,Math.floor(x-radius)),top=Math.max(0,Math.floor(y-radius)),width=Math.min(work.width,Math.ceil(x+radius))-left,height=Math.min(work.height,Math.ceil(y+radius))-top;if(width<1||height<1)continue;const d=wctx.getImageData(left,top,width,height),base=original.getContext('2d').getImageData(left,top,width,height);d.data.set(featherBrushPixels(d.data,base.data,width,height,x-left,y-top,radius,feather,mode==='restore'));wctx.putImageData(d,left,top);}
 else{wctx.save();wctx.beginPath();wctx.arc(x,y,size/2,0,Math.PI*2);wctx.clip();if(mode==='erase'){wctx.clearRect(x-size,y-size,size*2,size*2);}else{wctx.clearRect(x-size,y-size,size*2,size*2);wctx.drawImage(original,0,0);}wctx.restore();}}
    };
    const finish = result => { if(settled)return;settled=true;document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancelStroke);observer.disconnect();host.remove();previousFocus?.focus?.();resolve(result); };
    const cancelStroke = () => {const id=pointer;pointer=null;last=null;panStart=null;if(id!==null&&stage.hasPointerCapture(id))stage.releasePointerCapture(id);};
    const key = e => { if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(null);} if(e.key==='Tab'){const els=[...host.querySelectorAll('button:not(:disabled),input,select,summary')];const first=els[0],end=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}} };
    document.addEventListener('keydown',key,true);window.addEventListener('blur',cancelStroke);
    stage.addEventListener('pointerdown',e=>{if(pointer!==null||(comparing&&mode!=='pan'))return;if(mode!=='pan'&&host.querySelector('#ic-stylus-only').checked&&e.pointerType!=='pen'){status.textContent='Stylus-only drawing: use a pen to erase, restore, crop or remove a color. Fingers and mouse still work in Pan mode and on controls.';return;}const bounds=view.getBoundingClientRect();if(mode!=='pan'&&(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom))return;e.preventDefault();pointer=e.pointerId;stage.setPointerCapture(e.pointerId);if(mode==='pan'){panStart={x:e.clientX,y:e.clientY,panX,panY};return;}last=pos(e);if(mode==='color'){const x=Math.min(work.width-1,Math.floor(last.x)),y=Math.min(work.height-1,Math.floor(last.y)),d=wctx.getImageData(0,0,work.width,work.height);if(!d.data[(y*work.width+x)*4+3]){status.textContent='That pixel is already transparent. Tap an opaque background area.';}else{snapshot();d.data.set(removeConnectedColor(d.data,work.width,work.height,x,y,boundedValue('#ic-color-tolerance',0,100)));wctx.putImageData(d,0,0);status.textContent='Connected sampled color removed. Check pale or similar-colored details; Undo and Restore are available.';}cancelStroke();draw();return;}if(mode==='crop'){crop={x:last.x,y:last.y,w:0,h:0};}else{snapshot();brush(last,last);}draw();});
    stage.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;e.preventDefault();if(panStart){panX=panStart.panX+e.clientX-panStart.x;panY=panStart.panY+e.clientY-panStart.y;layout();return;}if(!last)return;const p=pos(e);if(mode==='crop'){crop.w=p.x-crop.x;crop.h=p.y-crop.y;}else{brush(last,p);last=p;}draw();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,e=>{if(e.pointerId===pointer)cancelStroke();});
    host.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{cancelStroke();mode=b.dataset.mode;comparing=false;crop=null;host.querySelectorAll('[data-mode]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));status.textContent=mode==='color'?'Tap a background region to remove its connected sampled color. Undo is available; this is not subject segmentation.':mode==='pan'?'Drag to pan. Use + / − to zoom, or Fit to return.':mode==='crop'?'Drag a rectangle, then Apply crop.':mode==='restore'?'Drag to restore pixels from the retained cleanup baseline.':'Drag to erase.';draw();}));
    host.querySelector('#ic-stylus-only').addEventListener('change',e=>{cancelStroke();status.textContent=e.target.checked?'Stylus-only drawing: only pen input edits the canvas. Fingers and mouse can use Pan and all controls.':'Finger, mouse and pen drawing enabled.';});
    const syncFields=()=>{host.querySelector('#ic-x').value=host.querySelector('#ic-y').value=0;host.querySelector('#ic-w').value=work.width;host.querySelector('#ic-h').value=work.height;};
    const applyCrop=c=>{const {x,y,w,h}=exactCrop(c,work.width,work.height);snapshot();merge();rect={x:rect.x+x,y:rect.y+y,w,h};const p=wctx.getImageData(x,y,w,h),o=original.getContext('2d').getImageData(x,y,w,h);work.width=original.width=w;work.height=original.height=h;wctx.putImageData(p,0,0);original.getContext('2d').putImageData(o,0,0);crop=null;fit();syncFields();};
    const observer=new ResizeObserver(layout);observer.observe(stage);
    host.querySelector('#ic-backdrop').addEventListener('change',e=>{stage.style.background=e.target.value==='white'?'#fff':e.target.value==='dark'?'#272b2c':'';});
    host.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;cancelStroke();const action=b.dataset.action;
      if(action==='cancel')return finish(null);
      if(action==='apply'){host.querySelectorAll('button,input').forEach(b=>b.disabled=true);try{merge();const dataUrl=work.toDataURL('image/png'),saved=validateCleanupSession({version:1,sourceHash,outputHash:await fingerprint(dataUrl),workingDataUrl:full.toDataURL('image/png'),restoreDataUrl:baseline.toDataURL('image/png'),crop:{...rect}});return finish({dataUrl,aspect:work.width/work.height,session:saved,settings:{paperThreshold:boundedValue('#ic-threshold',100,255),contrast:boundedValue('#ic-contrast',-80,150)}});}catch(error){host.querySelectorAll('button,input').forEach(b=>b.disabled=false);status.textContent='Could not preserve editable cleanup: '+error.message;draw();return;}}
      if(action==='fit'||action==='zoomin'||action==='zoomout'){if(action==='fit')fit();else zoom=Math.max(1,Math.min(8,zoom*(action==='zoomin'?1.5:1/1.5)));layout();return;}
      if(action==='compare'){comparing=!comparing;fit();draw();return;}
      comparing=false;
      if(action==='trim'||action==='exactcrop'){
        let c;try{c=action==='trim'?transparencyBounds(wctx.getImageData(0,0,work.width,work.height).data,work.width,work.height):exactCrop({x:Number(host.querySelector('#ic-x').value),y:Number(host.querySelector('#ic-y').value),w:Number(host.querySelector('#ic-w').value),h:Number(host.querySelector('#ic-h').value)},work.width,work.height);}catch(error){status.textContent=error.message;return;}
        if(!c){status.textContent='Nothing to trim: this image is fully transparent.';return;}
        if(c.x===0&&c.y===0&&c.w===work.width&&c.h===work.height){status.textContent='The image already fills these bounds.';return;}
        crop=c;applyCrop(c);status.textContent=action==='trim'?'Transparent edges trimmed. All visible pixels retained. Remove crop or Undo restores the canvas.':'Exact pixel crop applied. Remove crop or Undo restores the canvas.';draw();return;
      }
      if(action==='undo'&&history.length){future.push(capture());trim(future);restore(history.pop());}
      if(action==='redo'&&future.length){history.push(capture());trim(history);restore(future.pop());}
      if(action==='reset'){snapshot();setImage(source);crop=null;status.textContent='Restored the untouched source. Undo brings your draft back.';}
      if(action==='paper'||action==='contrast'){snapshot();const d=wctx.getImageData(0,0,work.width,work.height);d.data.set(action==='paper'?(host.querySelector('#ic-paper-scope').value==='edges'?removeEdgeLightPixels(d.data,work.width,work.height,boundedValue('#ic-threshold',100,255)):removeLightPixels(d.data,boundedValue('#ic-threshold',100,255))):contrastPixels(d.data,boundedValue('#ic-contrast',-80,150)));wctx.putImageData(d,0,0);status.textContent=action==='paper'?(host.querySelector('#ic-paper-scope').value==='edges'?'Edge-connected pale pixels removed. Enclosed light details kept; gaps in outlines can let removal reach inside. Not automatic subject cutout.':'Light pixels removed throughout the image. Undo or Restore recovers pale details.'):'Contrast applied. Undo is available.';}
      if(action==='uncrop'){snapshot();merge();work.width=original.width=full.width;work.height=original.height=full.height;wctx.drawImage(full,0,0);original.getContext('2d').drawImage(baseline,0,0);rect={x:0,y:0,w:full.width,h:full.height};crop=null;status.textContent='Full working canvas restored. Cropped-area edits were retained.';}
      if(action==='crop'&&crop){const x=Math.floor(Math.min(crop.x,crop.x+crop.w)),y=Math.floor(Math.min(crop.y,crop.y+crop.h)),w=Math.max(1,Math.min(work.width-x,Math.round(Math.abs(crop.w)))),h=Math.max(1,Math.min(work.height-y,Math.round(Math.abs(crop.h))));applyCrop({x,y,w,h});status.textContent='Crop applied. Undo restores the previous picture.';}
      if(['undo','redo','reset','uncrop'].includes(action)){fit();syncFields();}
      draw();
    });
    setImage(current);if(session){full.width=baseline.width=fullImage.naturalWidth;full.height=baseline.height=fullImage.naturalHeight;full.getContext('2d').drawImage(fullImage,0,0);baseline.getContext('2d').drawImage(restoreImage,0,0);rect={...session.crop};work.width=original.width=rect.w;work.height=original.height=rect.h;wctx.drawImage(full,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);original.getContext('2d').drawImage(baseline,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);status.textContent='Saved crop and restore baseline resumed. Undo starts fresh.';}syncFields();draw();button('cancel').focus();
  });
}
