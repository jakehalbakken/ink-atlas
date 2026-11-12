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
export function contrastPixels(data, amount = 0) {
  const out = new Uint8ClampedArray(data), factor = (100 + amount) / 100;
  for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) out[i + c] = (out[i + c] - 128) * factor + 128;
  return out;
}
const picture = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Could not open this picture')); image.src = src; });
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export async function editArtwork(sourceDataUrl, currentDataUrl = sourceDataUrl) {
  const [source, current] = await Promise.all([picture(sourceDataUrl), picture(currentDataUrl)]);
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const host = document.createElement('div'); host.id = 'ink-cleanup'; host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-labelledby', 'ic-title');
    host.innerHTML = `<style>
#ink-cleanup{position:fixed;inset:0;z-index:10000;background:#f4f1eb;color:#242725;display:flex;flex-direction:column;padding:12px;box-sizing:border-box;font:16px system-ui;overscroll-behavior:none}
#ink-cleanup *{box-sizing:border-box}#ink-cleanup header,#ink-cleanup .ic-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#ink-cleanup header{justify-content:space-between}#ink-cleanup h2{font-size:20px;margin:0}#ink-cleanup button,#ink-cleanup select,#ink-cleanup input{min-height:44px;font:inherit;border:1px solid #aaa69e;border-radius:10px;background:#fff;color:inherit;padding:8px 12px}#ink-cleanup button:disabled{opacity:.4}#ink-cleanup button[aria-pressed=true]{background:#d5e8df;border-color:#34725d}#ink-cleanup .ic-primary{background:#234e40;color:white}#ink-cleanup .ic-tools{max-height:35vh;overflow:auto;flex:none;padding:8px 0;display:grid;gap:8px;touch-action:pan-y}#ink-cleanup label{display:flex;align-items:center;gap:6px}#ink-cleanup input[type=number]{width:80px}#ink-cleanup .ic-work{flex:1;min-height:100px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:repeating-conic-gradient(#dedbd4 0% 25%,#f9f7f2 0% 50%) 50%/24px 24px;border-radius:12px}#ink-cleanup canvas{max-width:100%;max-height:100%;object-fit:contain;touch-action:none;display:block}#ink-cleanup .ic-note{font-size:13px;margin:6px 0;color:#555}#ink-cleanup footer{display:flex;justify-content:space-between;gap:8px;padding-top:8px}#ink-cleanup .ic-status{font-size:13px;margin:5px 0;min-height:18px}
</style><header><h2 id="ic-title">Clean up tattoo</h2><button data-action="cancel">Cancel</button></header>
<p class="ic-note">Local edits only. Your source picture is kept. Use light-background removal for artwork on pale paper, or erase by hand.</p>
<div class="ic-tools"><div class="ic-row"><button data-mode="erase" aria-pressed="true">Erase</button><button data-mode="restore" aria-pressed="false">Restore</button><button data-mode="crop" aria-pressed="false">Crop</button><label>Brush <input id="ic-brush" type="number" min="2" max="150" value="24" aria-label="Brush width"></label><button data-action="crop" disabled>Apply crop</button></div>
<div class="ic-row"><label>Paper threshold <input id="ic-threshold" type="number" min="100" max="255" value="235"></label><button data-action="paper">Remove light background</button><label>Contrast <input id="ic-contrast" type="number" min="-80" max="150" value="25"></label><button data-action="contrast">Apply contrast</button></div>
<div class="ic-row"><button data-action="undo" disabled>Undo</button><button data-action="redo" disabled>Redo</button><button data-action="compare" aria-pressed="false">Compare original</button><button data-action="reset">Reset to source</button></div></div>
<div class="ic-work"><canvas aria-label="Tattoo cleanup canvas"></canvas></div><p class="ic-status" role="status">Drag to erase. Restore brings back pixels from the start of this editing session.</p><footer><span class="ic-note">Nothing changes until you apply.</span><button class="ic-primary" data-action="apply">Apply cleanup</button></footer>`;
    (document.querySelector('#viewport') || document.body).append(host);
    const view = host.querySelector('canvas'), work = canvasOf(1, 1), original = canvasOf(1, 1), wctx = work.getContext('2d', {willReadFrequently: true});
    const status = host.querySelector('.ic-status');
    let history = [], future = [], mode = 'erase', comparing = false, crop = null, pointer = null, last = null, settled = false;
    const button = action => host.querySelector(`[data-action="${action}"]`);
    const setImage = image => { const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight)); work.width = Math.max(1, Math.round(image.naturalWidth * scale)); work.height = Math.max(1, Math.round(image.naturalHeight * scale)); wctx.drawImage(image, 0, 0, work.width, work.height); original.width = work.width; original.height = work.height; original.getContext('2d').drawImage(work, 0, 0); };
    const capture = () => ({w:work.width, h:work.height, pixels:wctx.getImageData(0,0,work.width,work.height), original:original.getContext('2d').getImageData(0,0,original.width,original.height)});
    const trim = stack => { while(stack.length>1 && stack.reduce((n,s)=>n+s.w*s.h*8,0)>48*1024*1024)stack.shift(); };
    const snapshot = () => { history.push(capture()); trim(history); future=[]; };
    const restore = state => { work.width=original.width=state.w; work.height=original.height=state.h; wctx.putImageData(state.pixels,0,0); original.getContext('2d').putImageData(state.original,0,0); crop=null; };
    const draw = () => { const scale=Math.min(1,1600/Math.max(source.naturalWidth,source.naturalHeight));view.width=comparing?Math.max(1,Math.round(source.naturalWidth*scale)):work.width;view.height=comparing?Math.max(1,Math.round(source.naturalHeight*scale)):work.height; const ctx=view.getContext('2d'); ctx.drawImage(comparing ? source : work,0,0,view.width,view.height); if(crop&&!comparing){ctx.strokeStyle='#00a48b';ctx.lineWidth=Math.max(2,work.width/300);ctx.setLineDash([8,6]);ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);} button('undo').disabled=!history.length;button('redo').disabled=!future.length;button('crop').disabled=!crop||Math.abs(crop.w)<2||Math.abs(crop.h)<2; button('compare').setAttribute('aria-pressed',String(comparing)); };
    const boundedValue = (id,min,max) => { const n=Number(host.querySelector(id).value);return Math.min(max,Math.max(min,Number.isFinite(n)?n:min)); };
    const pos = event => { const r=view.getBoundingClientRect();return {x:Math.max(0,Math.min(work.width,(event.clientX-r.left)*work.width/r.width)),y:Math.max(0,Math.min(work.height,(event.clientY-r.top)*work.height/r.height))}; };
    const brush = (a,b) => { const r=view.getBoundingClientRect(),size=boundedValue('#ic-brush',2,150)*work.width/r.width; const distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(distance/Math.max(1,size/4))); for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;wctx.save();wctx.beginPath();wctx.arc(x,y,size/2,0,Math.PI*2);wctx.clip();if(mode==='erase'){wctx.clearRect(x-size,y-size,size*2,size*2);}else{wctx.clearRect(x-size,y-size,size*2,size*2);wctx.drawImage(original,0,0);}wctx.restore();} };
    const finish = result => { if(settled)return;settled=true;document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancelStroke);host.remove();previousFocus?.focus?.();resolve(result); };
    const cancelStroke = () => {pointer=null;last=null;};
    const key = e => { if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(null);} if(e.key==='Tab'){const els=[...host.querySelectorAll('button:not(:disabled),input')];const first=els[0],end=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}} };
    document.addEventListener('keydown',key,true);window.addEventListener('blur',cancelStroke);
    view.addEventListener('pointerdown',e=>{if(pointer!==null||comparing)return;e.preventDefault();pointer=e.pointerId;view.setPointerCapture(e.pointerId);last=pos(e);if(mode==='crop'){crop={x:last.x,y:last.y,w:0,h:0};}else{snapshot();brush(last,last);}draw();});
    view.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||!last)return;e.preventDefault();const p=pos(e);if(mode==='crop'){crop.w=p.x-crop.x;crop.h=p.y-crop.y;}else{brush(last,p);last=p;}draw();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(event,cancelStroke);
    host.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{cancelStroke();mode=b.dataset.mode;comparing=false;crop=null;host.querySelectorAll('[data-mode]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));status.textContent=mode==='crop'?'Drag a rectangle, then Apply crop.':mode==='restore'?'Drag to restore pixels from the start of this editing session.':'Drag to erase.';draw();}));
    host.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;cancelStroke();const action=b.dataset.action;
      if(action==='cancel')return finish(null);
      if(action==='apply')return finish({dataUrl:work.toDataURL('image/png'),aspect:work.width/work.height});
      if(action==='compare'){comparing=!comparing;draw();return;}
      comparing=false;
      if(action==='undo'&&history.length){future.push(capture());trim(future);restore(history.pop());}
      if(action==='redo'&&future.length){history.push(capture());trim(history);restore(future.pop());}
      if(action==='reset'){snapshot();setImage(source);crop=null;status.textContent='Restored the untouched source. Undo brings your draft back.';}
      if(action==='paper'||action==='contrast'){snapshot();const d=wctx.getImageData(0,0,work.width,work.height);d.data.set(action==='paper'?removeLightPixels(d.data,boundedValue('#ic-threshold',100,255)):contrastPixels(d.data,boundedValue('#ic-contrast',-80,150)));wctx.putImageData(d,0,0);status.textContent=action==='paper'?'Light pixels removed. Undo or use Restore to recover pale details.':'Contrast applied. Undo is available.';}
      if(action==='crop'&&crop){snapshot();const x=Math.floor(Math.min(crop.x,crop.x+crop.w)),y=Math.floor(Math.min(crop.y,crop.y+crop.h)),w=Math.max(1,Math.min(work.width-x,Math.round(Math.abs(crop.w)))),h=Math.max(1,Math.min(work.height-y,Math.round(Math.abs(crop.h))));const p=wctx.getImageData(x,y,w,h),o=original.getContext('2d').getImageData(x,y,w,h);work.width=original.width=w;work.height=original.height=h;wctx.putImageData(p,0,0);original.getContext('2d').putImageData(o,0,0);crop=null;status.textContent='Crop applied. Undo restores the previous picture.';}
      draw();
    });
    setImage(current);draw();button('cancel').focus();
  });
}
