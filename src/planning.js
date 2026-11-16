// Planning metadata lives inside the parent project. This module never persists,
// publishes, or replaces active state itself: the caller's applyState owns undo,
// validation and saving. Image keys referenced by snapshots must remain in backups.
const KEYS = ['layouts', 'checkpoints', 'views'];
export const MAX_PLANNING_PREVIEW_LENGTH = 768 * 1024;
export function validPlanningPreview(value) {
  return typeof value === 'string' && value.length <= MAX_PLANNING_PREVIEW_LENGTH && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(value) ? value : null;
}
export const PLANNING_LIMITS = { layouts: 20, checkpoints: 12, views: 24 };
export function assertPlanningRoom(state, kind, adding = 1) {
  const count = Array.isArray(state[kind]) ? state[kind].length : 0;
  if (count + adding > PLANNING_LIMITS[kind]) throw new Error(`This project can keep ${PLANNING_LIMITS[kind]} ${kind}, including archived items. There is not room for ${adding === 1 ? 'another saved item' : 'three size studies'}. No items were changed.`);
}

const clone = value => JSON.parse(JSON.stringify(value));
const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
const title = value => String(value || 'Untitled').trim().slice(0, 80) || 'Untitled';
export function capturePlanningState(state) {
  if (!state || !Array.isArray(state.tattoos)) throw new Error('The current project cannot be captured.');
  const result = clone(state);
  for (const key of KEYS) delete result[key];
  validateArtworkReferences(result);
  return result;
}
function validateArtworkReferences(state) {
  for (const tattoo of state.tattoos || []) {
    if (tattoo.artworkId == null) continue; // Legacy placements only have img.
    const art = state.artworks?.[tattoo.artworkId];
    if (!art || typeof art !== 'object' || typeof art.source !== 'string' || !art.source || typeof art.output !== 'string' || !art.output) {
      throw new Error('Artwork source information is missing. Keep the current project and its backup before switching plans.');
    }
  }
}
export function restorePlanningState(current, saved, kind = 'layout') {
  const next = capturePlanningState(saved);
  validateArtworkReferences(current);
  for (const key of KEYS) if (Array.isArray(current[key])) next[key] = clone(current[key]);
  // Both layouts and checkpoints change proposed ink, never erase or revert ink
  // already on the person. Preserve its latest artwork as well as its placement.
  const existing = clone(current.tattoos.filter(t => t.status === 'existing'));
  const ids = new Set(existing.map(t => t.id));
  const planned = next.tattoos.filter(t => t.status !== 'existing').map(t => {
    if (ids.has(t.id)) t.id = uid();
    ids.add(t.id); return t;
  });
  const artworks = clone(next.artworks || {});
  for (const tattoo of existing) {
    const id = tattoo.artworkId;
    if (!id) continue;
    const latest = current.artworks[id];
    if (artworks[id] && JSON.stringify(artworks[id]) !== JSON.stringify(latest)) {
      // A linked image may have changed since the saved plan. Preserve the saved
      // planned output under a new identity, and keep existing ink's current one.
      const savedId = uid(); artworks[savedId] = artworks[id];
      for (const p of planned) if (p.artworkId === id) p.artworkId = savedId;
    }
    artworks[id] = clone(latest);
  }
  next.tattoos = [...existing, ...planned];
  if (Object.keys(artworks).length) next.artworks = artworks;
  validateArtworkReferences(next);
  return next;
}
export function makeSizeStudy(state, inches, tattooId) {
  if (![2, 3, 4].includes(inches)) throw new Error('Choose a 2, 3 or 4 inch study.');
  const result = capturePlanningState(state);
  const tattoo = result.tattoos.find(t => t.id === tattooId);
  if (!tattoo || tattoo.status === 'existing' || tattoo.locked) throw new Error('Choose an unlocked planned tattoo for the size study.');
  const height = Number(result.heightCm);
  if (!(height > 0 && Number.isFinite(height))) throw new Error('Set the body height before making a size study.');
  tattoo.width = inches * 2.54 / 100 * 175 / height;
  return result;
}
export function planningImageKeys(state) {
  const keys = new Set();
  const add = s => {
    for (const tattoo of s?.tattoos || []) for (const key of ['img','sourceImg']) if (typeof tattoo[key] === 'string') keys.add(tattoo[key]);
    for (const artwork of Object.values(s?.artworks || {})) for (const field of ['source','output','mask']) if (typeof artwork?.[field] === 'string') keys.add(artwork[field]);
  };
  add(state); for (const key of ['layouts','checkpoints']) for (const row of state?.[key] || []) add(row.state || row);
  return [...keys];
}
export function summarizePlanningDifference(current, saved) {
  const now = current.tattoos || [], then = saved.tattoos || [], map = new Map(now.map(t => [t.id,t]));
  let added = 0, changed = 0, unchanged = 0;
  for (const t of then) { const old = map.get(t.id); if(!old) added++;else if(JSON.stringify(old)===JSON.stringify(t)) unchanged++;else changed++; }
  const removed = now.filter(t => !then.some(x => x.id === t.id)).length;
  return {current: now.length,saved: then.length,added,removed,changed,unchanged};
}

const DOTS='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';
const EYE='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const BODY='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="M5 9h14M12 9v6m0 0-3 6m3-6 3 6"/></svg>';
// When it was saved, the way the iPad lists say it: Today, 5:00 AM / Yesterday / 12 Nov.
function when(at){
  const d=new Date(at);if(!Number.isFinite(d.getTime()))return '';
  const time=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),day=new Date();day.setHours(0,0,0,0);
  if(d>=day)return 'Today, '+time;if(d>=new Date(day.getTime()-864e5))return 'Yesterday, '+time;
  return d.toLocaleDateString([],{day:'numeric',month:'short',year:d.getFullYear()===day.getFullYear()?undefined:'numeric'})+', '+time;
}
// What is different from the body now, in a sentence instead of a table of counts.
export function differenceLine(d){
  const parts=[];
  if(d.changed)parts.push(d.changed+(d.changed===1?' tattoo is':' tattoos are')+' placed or sized differently');
  if(d.added)parts.push(d.added+(d.added===1?' is':' are')+' only in this one');
  if(d.removed)parts.push(d.removed+(d.removed===1?' is':' are')+' only on the body now');
  return parts.length?parts.join(', ')+'.':'Same tattoos in the same places as the body now.';
}
const COPY={
  layouts:{one:'layout',explain:'Other ways to place your planned tattoos. Ink already on you stays as it is when you open one.',open:'Open',done:'Opened. Undo goes back.',empty:'No layouts yet. Name the one on the body now and tap Save.'},
  checkpoints:{one:'checkpoint',explain:'A copy of the body and plan as it is now, to come back to. Ink already on you stays as it is.',open:'Restore',done:'Restored. Undo goes back.',empty:'No checkpoints yet. Tap Save to keep this moment.'},
  views:{one:'view',explain:'Saved camera angles. Going to one only moves the view.',open:'Go to view',done:'',empty:'No views yet. Turn the body the way you like and tap Save.'}
};
const CSS=`.ink-planning{position:fixed;inset:0;z-index:10000;padding:16px;display:grid;place-items:center;background:rgba(8,9,12,.42);color:var(--text);font:500 15px/1.35 var(--body);overscroll-behavior:contain;box-sizing:border-box}.ink-planning *{box-sizing:border-box}
.ink-planning .ip-panel{width:min(600px,100%);max-height:min(100%,860px);gap:14px}
.ink-planning .ip-panel>.seg{display:grid;grid-template-columns:repeat(3,1fr)}
.ink-planning .ip-explain{margin:-2px 4px 0;color:var(--muted);font-size:13px;line-height:1.35}
.ink-planning .ip-group{background:var(--fill-soft);border-radius:var(--r-md,14px);overflow:hidden;flex:none}
.ink-planning .ip-save,.ink-planning .ip-study{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px}
.ink-planning .ip-save input,.ink-planning select{flex:1;min-width:0;min-height:44px;font:inherit;font-size:16px;color:var(--text);background:transparent;border:0;padding:0;outline:none;touch-action:auto}
.ink-planning select{appearance:none;-webkit-appearance:none;padding-right:22px;background:no-repeat right 4px center/12px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4.5 6 8.5 10 4.5' fill='none' stroke='%23999' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");text-overflow:ellipsis;cursor:pointer}
.ink-planning select option{color:#1b1c22}
.ink-planning .ip-save input::placeholder{color:var(--faint)}
.ink-planning .ip-status{margin:-6px 4px 0;min-height:0;font-size:13px;color:var(--muted)}.ink-planning .ip-status:empty{display:none}.ink-planning .ip-status.bad{color:var(--danger)}
.ink-planning .ip-item+.ip-item{border-top:1px solid var(--line)}
.ink-planning .ip-line{display:grid;grid-template-columns:52px minmax(0,1fr) auto 44px;align-items:center;gap:12px;padding:8px 6px 8px 10px;min-height:68px}
.ink-planning .ip-thumb{width:52px;height:52px;border-radius:10px;background:var(--fill);display:grid;place-items:center;overflow:hidden;color:var(--muted)}.ink-planning .ip-thumb img{width:100%;height:100%;object-fit:cover}
.ink-planning .ip-text{min-width:0}.ink-planning .ip-text b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ink-planning .ip-text small{display:block;color:var(--muted);font-size:13px;margin-top:2px}
.ink-planning .ip-more{min-width:44px;padding:0;background:transparent;border-color:transparent;color:var(--muted)}.ink-planning .ip-more[aria-expanded=true]{color:var(--text);background:var(--fill)}
.ink-planning .ip-acts{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 10px 74px}.ink-planning .ip-acts .btn{min-height:40px;font-size:14px;flex:none}.ink-planning .ip-acts input{flex:1;min-width:120px;min-height:44px;font:inherit;font-size:16px;color:var(--text);background:var(--fill);border:1px solid var(--line);border-radius:10px;padding:0 10px;touch-action:auto}
.ink-planning .ip-acts .danger{color:var(--danger)}
.ink-planning .ip-note{margin:0;padding:0 10px 10px 74px;font-size:13px;color:var(--muted)}
.ink-planning .ip-empty{margin:0;padding:16px;color:var(--muted);font-size:14px}
.ink-planning .ip-link{align-self:flex-start;min-height:44px;padding:0 4px;background:none;border:0;color:var(--stencil);font:600 15px/1 var(--body);cursor:pointer}
.ink-planning .ip-pick{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;padding:4px 14px;border-bottom:1px solid var(--line)}.ink-planning .ip-pick span{color:var(--muted);font-size:13px}
.ink-planning .ip-two{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px}.ink-planning .ip-two .btn{white-space:normal;line-height:1.15}
.ink-planning .ip-foot{margin:-6px 4px 0;color:var(--muted);font-size:13px}
.ink-planning .ip-visual{flex:none}.ink-planning .ip-visual-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ink-planning .ip-visual figure{margin:0;min-width:0}.ink-planning .ip-visual img{width:100%;height:220px;object-fit:contain;background:var(--fill-soft);border-radius:var(--r-md,14px)}.ink-planning .ip-visual figcaption{font-weight:600;font-size:13px;margin:0 4px 6px;overflow-wrap:anywhere}.ink-planning .ip-missing-preview{font-size:13px;padding:16px;background:var(--fill-soft);border-radius:var(--r-md,14px);color:var(--muted);margin:0}
.ink-planning [hidden]{display:none!important}
@media (max-width:520px){.ink-planning{padding:0;place-items:end stretch}.ink-planning .ip-panel{width:100%;border-radius:var(--r-lg,22px) var(--r-lg,22px) 0 0}.ink-planning .ip-acts,.ink-planning .ip-note{padding-left:10px}.ink-planning .ip-two{grid-template-columns:1fr}}`;

export async function openPlanning({getState, applyState, getView, setView, getPreview, onCompare3D} = {}) {
  if (typeof getState !== 'function' || typeof applyState !== 'function') throw new Error('Planning requires project read and apply callbacks.');
  return new Promise(resolve => {
    const focusBefore = document.activeElement, root = document.createElement('div');
    root.className = 'ink-planning';
    root.innerHTML = `<style>${CSS}</style><section class="modal glass ip-panel" role="dialog" aria-modal="true" aria-labelledby="ink-planning-title"><header><h2 id="ink-planning-title">Layouts and views</h2><button class="btn" type="button" data-close>Done</button></header>
<div class="seg" role="group" aria-label="What to save"><button class="btn" type="button" data-tab="layouts" aria-pressed="true">Layouts</button><button class="btn" type="button" data-tab="checkpoints" aria-pressed="false">Checkpoints</button><button class="btn" type="button" data-tab="views" aria-pressed="false">Views</button></div>
<p class="ip-explain" data-explain></p>
<div class="ip-group ip-save"><input data-name aria-label="Name" maxlength="80" placeholder="Name this layout" enterkeyhint="done"><button class="btn primary" type="button" data-save>Save</button></div>
<p class="ip-status" role="status" aria-live="polite"></p>
<h3 class="shHead" data-list-head>Saved</h3>
<div class="ip-group ip-list"></div>
<button class="ip-link" type="button" data-archive aria-pressed="false">Show archived</button>
<div data-comparison><h3 class="shHead">Compare two</h3><div class="ip-group"><div class="ip-pick"><select data-compare-a aria-label="First to compare"></select><span>and</span><select data-compare-b aria-label="Second to compare"></select></div><div class="ip-two"><button class="btn" type="button" data-compare>Pictures side by side</button><button class="btn" type="button" data-compare-3d>Wipe between them on the body</button></div></div></div>
<div class="ip-visual" hidden></div>
<div data-studies><h3 class="shHead">Try a size</h3><div class="ip-group ip-study"><select data-piece aria-label="Tattoo to try at other sizes"></select><button class="btn" type="button" data-size-study>Save at 2, 3 and 4 in</button></div><p class="ip-foot" style="margin-top:6px">Adds three layouts with this tattoo at each width. The one on the body stays as it is.</p></div>
</section>`;
    (document.querySelector("#viewport") || document.body).append(root);const $=s=>root.querySelector(s), list=$('.ip-list'), status=$('.ip-status');
    let tab='layouts', archived=false,busy=false,closed=false,openMore=null;
    const say=(text,bad=false)=>{status.textContent=text;status.classList.toggle('bad',!!bad);};
    $('[data-compare-3d]').hidden=typeof onCompare3D!=='function';
    const close=()=>{if(busy||closed)return;closed=true;document.removeEventListener('keydown',onKey,true);root.remove();focusBefore?.focus?.();resolve();};
    const run=async fn=>{if(busy||closed)return;busy=true;say('');root.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){say(e.message||'That change could not be saved.',true);}finally{busy=false;if(!closed){root.querySelectorAll('button').forEach(b=>b.disabled=false);if(tab==='views'&&(typeof getView!=='function'||typeof setView!=='function'))$('[data-save]').disabled=true;}}};
    const apply=async next=>{await applyState(next);};
    const mutate=async fn=>{const next=clone(getState());fn(next);await apply(next);await render();};
    const action=(label,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.className='btn '+cls;b.textContent=label;b.onclick=()=>run(fn);return b;};
    async function render(){
      const state=getState(),all=Array.isArray(state[tab])?state[tab]:[],rows=all.filter(x=>!!x.archived===archived),c=COPY[tab];
      $('[data-explain]').textContent=c.explain;
      $('[data-name]').placeholder='Name this '+c.one;
      $('.ip-save').hidden=archived;
      $('[data-list-head]').textContent=archived?'Archived':'Saved';
      $('[data-studies]').hidden=tab!=='layouts'||archived;
      $('[data-piece]').replaceChildren();
      for(const t of state.tattoos||[])if(t.status!=='existing'&&!t.locked){const o=document.createElement('option');o.value=t.id;o.textContent=t.name||'Tattoo';$('[data-piece]').append(o);}
      if(!$('[data-piece]').options.length)$('[data-studies]').hidden=true;
      $('.ip-visual').hidden=true;$('.ip-visual').replaceChildren();
      for(const selector of ['[data-compare-a]','[data-compare-b]']){const control=$(selector),previous=control.value;control.replaceChildren();for(const row of rows.filter(r=>r.state)){control.add(new Option(row.name||'Untitled',row.id));}if([...control.options].some(o=>o.value===previous))control.value=previous;}
      if($('[data-compare-b]').options.length>1&&$('[data-compare-a]').value===$('[data-compare-b]').value)$('[data-compare-b]').selectedIndex=1;
      $('[data-comparison]').hidden=tab==='views'||archived||$('[data-compare-a]').options.length<2;
      const nArch=all.filter(x=>x.archived).length;$('[data-archive]').hidden=!archived&&!nArch;$('[data-archive]').textContent=archived?'Back to saved':'Show archived ('+nArch+')';
      list.replaceChildren();
      if(!rows.length){const p=document.createElement('p');p.className='ip-empty';p.textContent=archived?'Nothing archived here.':c.empty;list.append(p);}
      for(const row of rows){
        const item=document.createElement('div');item.className='ip-item';item.dataset.id=row.id;
        const line=document.createElement('div');line.className='ip-line';
        const thumb=document.createElement('span');thumb.className='ip-thumb';const preview=validPlanningPreview(row.preview);
        if(preview){const im=document.createElement('img');im.src=preview;im.alt='';thumb.append(im);}else thumb.innerHTML=tab==='views'?EYE:BODY;
        const text=document.createElement('span');text.className='ip-text';const heading=document.createElement('b'),detail=document.createElement('small');heading.textContent=row.name||'Untitled';
        const n=row.state?.tattoos?.length;detail.textContent=when(row.at)+(row.state?' · '+n+(n===1?' tattoo':' tattoos'):'');text.append(heading,detail);
        const primary=archived?action('Put back',()=>mutate(s=>{s[tab].find(x=>x.id===row.id).archived=false;})):action(c.open,async()=>{
          const latest=getState(),record=latest[tab]?.find(x=>x.id===row.id);if(!record)throw new Error('That saved item is no longer available.');
          if(tab==='views'){if(typeof setView!=='function')throw new Error('Camera views are unavailable.');await setView(clone(record.view));}
          else await apply(restorePlanningState(latest,record.state,tab==='layouts'?'layout':'checkpoint'));
          await render();if(c.done)say(c.done);
        });
        const more=document.createElement('button');more.type='button';more.className='btn ip-more';more.innerHTML=DOTS;more.setAttribute('aria-label','More for '+(row.name||'Untitled'));more.setAttribute('aria-expanded',String(openMore===row.id));
        line.append(thumb,text,primary,more);item.append(line);
        const acts=document.createElement('div');acts.className='ip-acts';acts.hidden=openMore!==row.id;
        const fill=()=>{acts.replaceChildren();
          if(row.state&&!archived)acts.append(action('What’s different',async()=>{let note=item.querySelector('.ip-note');if(note){note.remove();return;}note=document.createElement('p');note.className='ip-note';note.textContent=differenceLine(summarizePlanningDifference(getState(),row.state));item.append(note);}));
          acts.append(action('Rename',async()=>{acts.replaceChildren();const input=document.createElement('input');input.value=row.name||'';input.maxLength=80;input.setAttribute('aria-label','New name');input.enterKeyHint='done';const save=action('Save name',()=>mutate(s=>{s[tab].find(x=>x.id===row.id).name=title(input.value);}),'primary');input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save.click();}};acts.append(input,save,action('Cancel',async()=>fill()));input.focus();}));
          if(!archived)acts.append(action('Archive',()=>mutate(s=>{s[tab].find(x=>x.id===row.id).archived=true;openMore=null;}),'danger'));
        };fill();item.append(acts);
        more.onclick=()=>{const on=acts.hidden;root.querySelectorAll('.ip-acts').forEach(a=>{a.hidden=true;});root.querySelectorAll('.ip-more').forEach(m=>m.setAttribute('aria-expanded','false'));acts.hidden=!on;more.setAttribute('aria-expanded',String(on));openMore=on?row.id:null;};
        list.append(item);
      }
    }
    root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>run(async()=>{tab=b.dataset.tab;archived=false;openMore=null;root.querySelectorAll('[data-tab]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));await render();}));
    $('[data-close]').onclick=close;
    root.addEventListener('pointerdown',e=>{if(e.target===root)close();});
    $('[data-archive]').onclick=()=>run(async()=>{archived=!archived;openMore=null;$('[data-archive]').setAttribute('aria-pressed',String(archived));await render();});
    $('[data-name]').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('[data-save]').click();}});
    $('[data-save]').onclick=()=>run(async()=>{
      const base=getState();assertPlanningRoom(base,tab);const record={id:uid(),name:title($('[data-name]').value||new Date().toLocaleString()),at:Date.now(),archived:false};
      if(tab==='views'){if(typeof getView!=='function')throw new Error('Camera views are unavailable.');record.view=clone(await getView());if(!record.view||typeof record.view!=='object')throw new Error('Camera view could not be captured.');}
      else {record.state=capturePlanningState(base);if(typeof getPreview==='function'){try{const preview=validPlanningPreview(await getPreview());if(preview)record.preview=preview;}catch(_){/* A snapshot failure must not discard the saved plan. */}}}
      await mutate(s=>{assertPlanningRoom(s,tab);s[tab]=[...(Array.isArray(s[tab])?s[tab]:[]),record];});$('[data-name]').value='';say('Saved “'+record.name+'”.'+(tab!=='views'&&!record.preview?' No picture was saved with it.':''));
    });
    $('[data-size-study]').onclick=()=>run(async()=>{const base=getState();assertPlanningRoom(base,'layouts',3);const id=$('[data-piece]').value,t=base.tattoos.find(x=>x.id===id);const records=[2,3,4].map(inches=>({id:uid(),name:title((t?.name||'Tattoo')+' at '+inches+' in'),at:Date.now(),archived:false,state:makeSizeStudy(base,inches,id)}));await mutate(s=>{assertPlanningRoom(s,'layouts',3);s.layouts=[...(Array.isArray(s.layouts)?s.layouts:[]),...records];});say('Saved three layouts, one at each size. The tattoo on the body is unchanged.');});
    $('[data-compare-3d]').onclick=()=>run(async()=>{
      const rows=getState()[tab]||[],a=rows.find(r=>r.id===$('[data-compare-a]').value),b=rows.find(r=>r.id===$('[data-compare-b]').value);
      if(!a?.state||!b?.state||a.id===b.id)throw new Error('Pick two different ones to compare.');
      if(typeof onCompare3D!=='function')throw new Error('Live comparison is unavailable.');
      await onCompare3D({a:clone(a),b:clone(b)});
    });
    $('[data-compare]').onclick=()=>run(async()=>{
      const all=getState()[tab]||[],a=all.find(r=>r.id===$('[data-compare-a]').value),b=all.find(r=>r.id===$('[data-compare-b]').value);
      if(!a||!b)throw new Error('Save two to compare their pictures.');
      if(a.id===b.id)throw new Error('Pick two different ones to compare.');
      const area=$('.ip-visual');area.replaceChildren();const pair=document.createElement('div');pair.className='ip-visual-pair';
      for(const row of [a,b]){const fig=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=row.name||'Untitled';fig.append(caption);const preview=validPlanningPreview(row.preview);if(preview){const image=document.createElement('img');image.src=preview;image.alt=`Saved picture of ${row.name||'Untitled'}`;fig.append(image);}else{const note=document.createElement('p');note.className='ip-missing-preview';note.textContent='No picture was saved with this one. Open it and save it again to add one.';fig.append(note);}pair.append(fig);}
      area.append(pair);area.hidden=false;area.scrollIntoView?.({block:'nearest',behavior:'smooth'});
    });
    const onKey=e=>{if(!root.contains(e.target)&&e.target!==document.body)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){const all=[...root.querySelectorAll('button:not(:disabled),input,select')].filter(el=>el.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}else if(root.contains(e.target))e.stopPropagation();};
    document.addEventListener('keydown',onKey,true);run(render);$('[data-close]').focus();
  });
}
