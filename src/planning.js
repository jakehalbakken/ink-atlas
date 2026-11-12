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

export async function openPlanning({getState, applyState, getView, setView, getPreview, onCompare3D} = {}) {
  if (typeof getState !== 'function' || typeof applyState !== 'function') throw new Error('Planning requires project read and apply callbacks.');
  return new Promise(resolve => {
    const focusBefore = document.activeElement, root = document.createElement('div');
    root.className = 'ink-planning';
    root.innerHTML = `<style>
.ink-planning{color-scheme:light;position:fixed;inset:0;z-index:10000;padding:16px;display:grid;place-items:center;background:#1119;color:#263735;font:16px system-ui;overscroll-behavior:contain;box-sizing:border-box}.ink-planning *{box-sizing:border-box}.ink-planning .ip-panel{display:flex;flex-direction:column;gap:12px;background:#f6f6ef;border-radius:20px;padding:20px;width:min(720px,100%);max-height:90dvh;overflow-y:auto;touch-action:pan-y;box-shadow:0 12px 70px #0004}.ink-planning h2{margin:0;font-size:23px}.ink-planning header,.ink-planning .ip-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ink-planning header{justify-content:space-between}.ink-planning button{min-width:44px;min-height:44px;font:inherit;background:#fff;color:#263735;border:1px solid #a7bab3;border-radius:10px;padding:8px 12px;touch-action:manipulation;cursor:pointer}.ink-planning button.primary,.ink-planning button[aria-pressed="true"]{background:#234d42;color:white}.ink-planning button:disabled{opacity:.5;cursor:wait}.ink-planning input,.ink-planning select{background:#fff;color:#263735;min-height:44px;font:inherit;font-size:16px;border:1px solid #a7bab3;border-radius:9px;padding:8px;min-width:100px;max-width:100%;flex:1}.ink-planning p{margin:0;line-height:1.4}.ink-planning .ip-list{overflow:auto;overscroll-behavior:contain;touch-action:pan-y;min-height:0}.ink-planning article{border-top:1px solid #cbd4cc;padding:12px 0;display:grid;gap:8px}.ink-planning small{color:#52645e}.ink-planning .ip-status{min-height:24px;color:#8a302e}.ink-planning .ip-studies{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ink-planning .ip-summary{padding:10px;border-radius:10px;background:#e5ece6}.ink-planning .ip-visual{overflow:auto;max-height:45vh;flex-shrink:0}.ink-planning .ip-visual-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ink-planning .ip-visual figure{margin:0;min-width:0}.ink-planning .ip-visual img{width:100%;height:220px;object-fit:contain;background:#e5ece6;border-radius:10px}.ink-planning .ip-visual figcaption{font-weight:600;overflow-wrap:anywhere}.ink-planning .ip-missing-preview{font-size:14px;padding:16px;background:#e5ece6;border-radius:10px}.ink-planning [hidden]{display:none!important}
</style><section class="ip-panel" role="dialog" aria-modal="true" aria-labelledby="ink-planning-title"><header><h2 id="ink-planning-title">Plans and versions</h2><button data-close>Close</button></header><div class="ip-row" aria-label="Planning category"><button data-tab="layouts" aria-pressed="true">Layouts</button><button data-tab="checkpoints" aria-pressed="false">Checkpoints</button><button data-tab="views" aria-pressed="false">Views</button></div><p data-explain></p><div class="ip-row"><input data-name aria-label="Name for saved plan" maxlength="80" placeholder="Give it a name"><button data-save class="primary">Save layout</button></div><div class="ip-studies" data-studies><select data-piece aria-label="Tattoo for size study"></select><button data-size-study>Create 2 / 3 / 4 inch studies</button></div><div class="ip-row"><button data-archive aria-pressed="false">Show archived</button></div><div data-comparison><div class="ip-row"><select data-compare-a aria-label="First saved plan"></select><select data-compare-b aria-label="Second saved plan"></select><button data-compare>Compare pictures</button><button data-compare-3d>Live 3D wipe</button></div><small>Pictures show saved camera angles. Live 3D wipe shares one neutral-body camera and requires matching body shape and skin.</small></div><div class="ip-visual" hidden></div><p class="ip-status" role="status" aria-live="polite"></p><div class="ip-list"></div></section>`;
    (document.querySelector("#viewport") || document.body).append(root);const $=s=>root.querySelector(s), list=$('.ip-list'), status=$('.ip-status');
    let tab='layouts', archived=false,busy=false,closed=false;
    $('[data-compare-3d]').hidden=typeof onCompare3D!=='function';
    const close=()=>{if(busy||closed)return;closed=true;document.removeEventListener('keydown',onKey,true);root.remove();focusBefore?.focus?.();resolve();};
    const run=async fn=>{if(busy||closed)return;busy=true;status.textContent='';root.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){status.textContent=e.message||'That change could not be saved.';}finally{busy=false;if(!closed){root.querySelectorAll('button').forEach(b=>b.disabled=false);if(tab==='views'&&(typeof getView!=='function'||typeof setView!=='function'))$('[data-save]').disabled=true;}}};
    const apply=async next=>{await applyState(next);};
    const mutate=async fn=>{const next=clone(getState());fn(next);await apply(next);await render();};
    const action=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>run(fn);return b;};
    async function render(){
      const state=getState(),rows=(Array.isArray(state[tab])?state[tab]:[]).filter(x=>!!x.archived===archived);
      $('[data-explain]').textContent=tab==='layouts'?'Try different plans. Opening a layout uses its body and planned tattoos while keeping your current existing ink.':tab==='checkpoints'?'Deliberate saved versions of the body and planned tattoos. Restoring keeps your current existing ink; Undo can bring back the previous plan.':'Named camera positions. Opening a view changes only where you are looking.';
      $('[data-save]').textContent=tab==='layouts'?'Save layout':tab==='checkpoints'?'Save checkpoint':'Save view';
      $('[data-studies]').hidden=tab!=='layouts';
      $('[data-piece]').replaceChildren();
      for(const t of state.tattoos||[])if(t.status!=='existing'&&!t.locked){const o=document.createElement('option');o.value=t.id;o.textContent=t.name||'Tattoo';$('[data-piece]').append(o);}
      $('[data-size-study]').hidden=!$('[data-piece]').options.length;
      $('[data-comparison]').hidden=tab==='views';
      $('.ip-visual').hidden=true;$('.ip-visual').replaceChildren();
      for(const selector of ['[data-compare-a]','[data-compare-b]']){const control=$(selector),previous=control.value;control.replaceChildren();for(const row of rows.filter(r=>r.state)){control.add(new Option(row.name||'Untitled',row.id));}if([...control.options].some(o=>o.value===previous))control.value=previous;}
      if($('[data-compare-b]').options.length>1&&$('[data-compare-a]').value===$('[data-compare-b]').value)$('[data-compare-b]').selectedIndex=1;
      list.replaceChildren();
      if(!rows.length){const p=document.createElement('p');p.textContent=archived?'Nothing archived here.':'No saved '+tab+' yet.';list.append(p);}
      for(const row of rows){
        const article=document.createElement('article'),heading=document.createElement('strong'),detail=document.createElement('small'),buttons=document.createElement('div');buttons.className='ip-row';heading.textContent=row.name;detail.textContent=new Date(row.at).toLocaleString()+(row.state?' · '+row.state.tattoos.length+' tattoos':'');
        if(archived)buttons.append(action('Restore to list',()=>mutate(s=>{s[tab].find(x=>x.id===row.id).archived=false;})));
        else buttons.append(action(tab==='checkpoints'?'Restore checkpoint':tab==='views'?'Go to view':'Open layout',async()=>{
          const latest=getState(),record=latest[tab]?.find(x=>x.id===row.id);if(!record)throw new Error('That saved item is no longer available.');
          if(tab==='views'){if(typeof setView!=='function')throw new Error('Camera views are unavailable.');await setView(clone(record.view));}
          else await apply(restorePlanningState(latest,record.state,tab==='layouts'?'layout':'checkpoint'));
          await render();status.textContent=tab==='views'?'Camera view restored.':'Restored. Use Undo to return to the previous arrangement.';
        }));
        if(row.state)buttons.append(action('Compare summary',async()=>{let summary=article.querySelector('.ip-summary');if(summary){summary.remove();return;}const d=summarizePlanningDifference(getState(),row.state);summary=document.createElement('p');summary.className='ip-summary';summary.textContent=`Saved: ${d.saved} tattoos; current: ${d.current}. ${d.changed} changed, ${d.added} only in saved, ${d.removed} only in current. This is a count comparison, not a visual preview.`;article.append(summary);}));
        buttons.append(action('Rename',async()=>{if(article.querySelector('input'))return;const wrap=document.createElement('div');wrap.className='ip-row';const input=document.createElement('input');input.value=row.name;input.maxLength=80;input.setAttribute('aria-label','Saved item name');wrap.append(input,action('Save name',()=>mutate(s=>{s[tab].find(x=>x.id===row.id).name=title(input.value);})),action('Cancel',async()=>wrap.remove()));article.append(wrap);input.focus();}));
        if(!archived)buttons.append(action('Archive',()=>mutate(s=>{s[tab].find(x=>x.id===row.id).archived=true;})));
        article.append(heading,detail,buttons);list.append(article);
      }
    }
    root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>run(async()=>{tab=b.dataset.tab;archived=false;root.querySelectorAll('[data-tab]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));$('[data-archive]').setAttribute('aria-pressed','false');$('[data-archive]').textContent='Show archived';await render();}));
    $('[data-close]').onclick=close;
    $('[data-archive]').onclick=()=>run(async()=>{archived=!archived;$('[data-archive]').setAttribute('aria-pressed',String(archived));$('[data-archive]').textContent=archived?'Show active':'Show archived';await render();});
    $('[data-save]').onclick=()=>run(async()=>{
      const base=getState();assertPlanningRoom(base,tab);const record={id:uid(),name:title($('[data-name]').value||new Date().toLocaleString()),at:Date.now(),archived:false};
      if(tab==='views'){if(typeof getView!=='function')throw new Error('Camera views are unavailable.');record.view=clone(await getView());if(!record.view||typeof record.view!=='object')throw new Error('Camera view could not be captured.');}
      else {record.state=capturePlanningState(base);if(typeof getPreview==='function'){try{const preview=validPlanningPreview(await getPreview());if(preview)record.preview=preview;}catch(_){/* A snapshot failure must not discard the saved plan. */}}}
      await mutate(s=>{assertPlanningRoom(s,tab);s[tab]=[...(Array.isArray(s[tab])?s[tab]:[]),record];});status.textContent='Saved '+(tab==='layouts'?'layout':tab==='checkpoints'?'checkpoint':'view')+'.'+(tab!=='views'&&!record.preview?' No preview saved; restore and save again to capture one.':'');
    });
    $('[data-size-study]').onclick=()=>run(async()=>{const base=getState();assertPlanningRoom(base,'layouts',3);const id=$('[data-piece]').value,t=base.tattoos.find(x=>x.id===id);const records=[2,3,4].map(inches=>({id:uid(),name:title((t?.name||'Tattoo')+' · '+inches+' inch'),at:Date.now(),archived:false,state:makeSizeStudy(base,inches,id)}));await mutate(s=>{assertPlanningRoom(s,'layouts',3);s.layouts=[...(Array.isArray(s.layouts)?s.layouts:[]),...records];});status.textContent='Three size-study layouts saved. Your current tattoo size is unchanged.';});
    $('[data-compare-3d]').onclick=()=>run(async()=>{
      const rows=getState()[tab]||[],a=rows.find(r=>r.id===$('[data-compare-a]').value),b=rows.find(r=>r.id===$('[data-compare-b]').value);
      if(!a?.state||!b?.state||a.id===b.id)throw new Error('Choose two different saved layouts or checkpoints.');
      if(typeof onCompare3D!=='function')throw new Error('Live comparison is unavailable.');
      await onCompare3D({a:clone(a),b:clone(b)});
      status.textContent='Live comparison closed. Your project is unchanged.';
    });
    $('[data-compare]').onclick=()=>run(async()=>{
      const all=getState()[tab]||[],a=all.find(r=>r.id===$('[data-compare-a]').value),b=all.find(r=>r.id===$('[data-compare-b]').value);
      if(!a||!b)throw new Error('Save two layouts or checkpoints to compare their pictures.');
      if(a.id===b.id)throw new Error('Choose two different saved plans.');
      const area=$('.ip-visual');area.replaceChildren();const pair=document.createElement('div');pair.className='ip-visual-pair';
      for(const row of [a,b]){const fig=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=row.name||'Untitled';fig.append(caption);const preview=validPlanningPreview(row.preview);if(preview){const image=document.createElement('img');image.src=preview;image.alt=`Saved camera snapshot: ${row.name||'Untitled'}`;fig.append(image);}else{const note=document.createElement('p');note.className='ip-missing-preview';note.textContent='No preview saved; restore and save again.';fig.append(note);}pair.append(fig);}
      area.append(pair);area.hidden=false;status.textContent='Comparing saved camera snapshots. This does not change your project.';
    });
    const onKey=e=>{if(!root.contains(e.target))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){const all=[...root.querySelectorAll('button:not(:disabled),input,select')].filter(el=>el.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}else e.stopPropagation();};
    document.addEventListener('keydown',onKey,true);run(render);$('[data-close]').focus();
  });
}
