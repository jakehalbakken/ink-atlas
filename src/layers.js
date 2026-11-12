// Layer/group controls. The caller owns history, persistence and decal regeneration.
export function reorderTattoo(state, id, direction) {
  const index = state.tattoos.findIndex(t => t.id === id), target = index + Math.sign(direction);
  if(index < 0 || target < 0 || target >= state.tattoos.length) return false;
  [state.tattoos[index],state.tattoos[target]]=[state.tattoos[target],state.tattoos[index]];return true;
}
export function assignGroup(state, ids, name, groupId) {
  const label = String(name || '').trim().slice(0,60);if(!label)return null;
  state.groups=Array.isArray(state.groups)?state.groups:[];
  const id=groupId||`group-${globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`;
  const existing=state.groups.find(g=>g.id===id);if(existing)existing.name=label;else state.groups.push({id,name:label});
  const selected=new Set(ids);state.tattoos.forEach(t=>{if(selected.has(t.id))t.group=id;});return id;
}
export function changeSelected(state, ids, values) {
  const selected=new Set(ids);for(const t of state.tattoos)if(selected.has(t.id)) {
    if(typeof values.locked==='boolean')t.locked=values.locked;
    if(typeof values.hidden==='boolean')t.hidden=values.hidden;
    if(!t.locked && Number.isFinite(values.opacity))t.opacity=Math.max(.1,Math.min(1,values.opacity));
  }
}
// Options: getState, change(fn(state)), select(id), getImages() optional.
// Optional onTransform({ids,scale}) provides true group transforms externally.
// onSolo(ids|null) is a view-only filter: it must not mutate project state; omit to disable solo.
// Solo is temporary and its view filter clears on closing or ending solo.
export function openLayers({getState,change,select,getImages=()=>({}),onTransform,onSolo}) {
  const old=document.querySelector('#ink-layers');if(old)return;
  const previous=document.activeElement;const selected=new Set();let soloActive=false,closed=false;
  const host=document.createElement('section');host.id='ink-layers';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-labelledby','il-title');
  host.innerHTML=`<style>
#ink-layers{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:#0007;padding:12px;font:16px system-ui;color:#242725;box-sizing:border-box}#ink-layers *{box-sizing:border-box}#ink-layers .il-panel{width:min(720px,100%);max-height:95%;display:flex;flex-direction:column;background:#f4f1eb;border-radius:18px;padding:16px}#ink-layers header,#ink-layers .il-actions,#ink-layers .il-item{display:flex;align-items:center;gap:8px;flex-wrap:wrap}#ink-layers header{justify-content:space-between}#ink-layers h2{font-size:20px;margin:0}#ink-layers button,#ink-layers select,#ink-layers input:not([type=checkbox]){font:inherit;min-height:44px;border:1px solid #aaa69e;border-radius:9px;background:white;color:inherit;padding:8px}#ink-layers button:disabled{opacity:.4}#ink-layers input[type=checkbox]{width:24px;height:24px}#ink-layers label.il-check{min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center}#ink-layers .il-list{overflow:auto;min-height:80px;touch-action:pan-y;overscroll-behavior:contain;margin:10px 0}#ink-layers .il-item{padding:8px 0;border-bottom:1px solid #d3cfc6}#ink-layers .il-name{flex:1;min-width:120px;text-align:left}#ink-layers .il-item img{width:42px;height:42px;object-fit:contain;background:#fff;border-radius:6px}#ink-layers .il-tip{font-size:13px;color:#555;margin:8px 0}#ink-layers .il-actions{margin:6px 0}#ink-layers #il-group-name{width:150px}#ink-layers #il-opacity{width:80px}#ink-layers button[aria-pressed=true]{background:#d5e8df;border-color:#34725d}
</style><div class="il-panel"><header><h2 id="il-title">Layers & groups</h2><button data-act="close">Done</button></header><p class="il-tip">Choose pieces to organize together. Use arrows to change their layer order. Tap a name to place that tattoo.</p><div class="il-actions"><button data-act="all">Select all</button><button data-act="none">Clear selection</button><span id="il-count"></span></div><div class="il-list"></div><div class="il-actions"><select id="il-groups" aria-label="Group"><option value="">Choose group</option></select><button data-act="chooseGroup">Select group</button><button data-act="ungroup">Ungroup selected</button></div><div class="il-actions"><input id="il-group-name" maxlength="60" placeholder="Group name" aria-label="Group name"><button data-act="group">Group selected</button><button data-act="rename">Rename group</button></div><div class="il-actions"><button data-act="show">Show</button><button data-act="hide">Hide</button><button data-act="solo" aria-pressed="false">Solo selected</button><button data-act="lock">Lock</button><button data-act="unlock">Unlock</button></div><div class="il-actions"><label>Ink % <input id="il-opacity" type="number" min="10" max="100" value="92"></label><button data-act="opacity">Apply ink strength</button><span id="il-transform"></span></div><p class="il-tip" id="il-status" role="status">Changes save as you work. Solo is temporary.</p></div>`;
  (document.querySelector('#viewport') || document.body).append(host);
  const $=s=>host.querySelector(s), btn=(text,action)=>{const b=document.createElement('button');b.textContent=text;b.type='button';b.addEventListener('click',action);return b;};
  const note=text=>{$('#il-status').textContent=text;};
  const mutate=fn=>{endSolo();change(fn);render();};
  const endSolo=()=>{if(!soloActive)return;soloActive=false;onSolo(null);};
  const close=()=>{if(closed)return;closed=true;endSolo();document.removeEventListener('keydown',key,true);host.remove();previous?.focus?.();};
  function render(){const state=getState();for(const id of selected)if(!state.tattoos.some(t=>t.id===id))selected.delete(id);const images=getImages()||{},list=$('.il-list');list.replaceChildren();
    state.tattoos.forEach((t,index)=>{const row=document.createElement('div');row.className='il-item';const label=document.createElement('label');label.className='il-check';const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(t.id);check.setAttribute('aria-label',`Select ${t.name}`);check.addEventListener('change',()=>{if(check.checked)selected.add(t.id);else selected.delete(t.id);render();});label.append(check);row.append(label);if(typeof images[t.img]==='string'&&images[t.img].startsWith('data:image/')){const im=document.createElement('img');im.src=images[t.img];im.alt='';row.append(im);}
      const group=(state.groups||[]).find(g=>g.id===t.group);const name=btn(`${t.name}${t.locked?' · locked':''}${t.hidden?' · hidden':''}${group?' · '+group.name:''}`,()=>{close();select(t.id);});name.className='il-name';row.append(name);
      const up=btn('↑',()=>mutate(s=>reorderTattoo(s,t.id,-1)));up.disabled=index===0;up.setAttribute('aria-label',`Move ${t.name} earlier`);const down=btn('↓',()=>mutate(s=>reorderTattoo(s,t.id,1)));down.disabled=index===state.tattoos.length-1;down.setAttribute('aria-label',`Move ${t.name} later`);row.append(up,down,btn(t.hidden?'Show':'Hide',()=>{endSolo();mutate(s=>changeSelected(s,[t.id],{hidden:!t.hidden}));}));list.append(row);});
    if(!state.tattoos.length){const p=document.createElement('p');p.textContent='Upload a tattoo to start organizing layers.';list.append(p);}$('#il-count').textContent=`${selected.size} selected`;
    const groups=$('#il-groups'),value=groups.value;groups.replaceChildren(new Option('Choose group',''));for(const group of state.groups||[])if(group&&typeof group.name==='string'&&typeof group.id==='string')groups.add(new Option(group.name,group.id));groups.value=value;
    for(const action of ['group','ungroup','show','hide','lock','unlock','opacity'])$(`[data-act=${action}]`).disabled=!selected.size;
    $('[data-act=solo]').disabled=typeof onSolo!=='function'||(!selected.size&&!soloActive);$('[data-act=solo]').textContent=soloActive?'End solo':'Solo selected';$('[data-act=solo]').setAttribute('aria-pressed',String(!!soloActive));
  }
  function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const nodes=[...host.querySelectorAll('button:not(:disabled),input,select')];const a=nodes[0],b=nodes.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}}
  document.addEventListener('keydown',key,true);
  if(onTransform){const box=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Move / resize selection';summary.style.cssText='min-height:44px;display:flex;align-items:center;cursor:pointer';box.append(summary);const row=document.createElement('div');row.className='il-actions';
    for(const [label,values] of [['Smaller',{scale:.9}],['Larger',{scale:1.1}],['Turn left',{rotation:-Math.PI/36}],['Turn right',{rotation:Math.PI/36}],['←',{dx:-.002}],['→',{dx:.002}],['↑',{dy:.002}],['↓',{dy:-.002}]]){const b=btn(label,async()=>{if(!selected.size)return note('Choose pieces first.');try{endSolo();const r=await onTransform({ids:[...selected],...values});note(r?.message||'Selection updated. Locked and existing ink stay in place.');render();}catch(e){note(e.message);}});b.dataset.transform=label;row.append(b);}box.append(row);$('#il-transform').append(box);}
  host.addEventListener('click',e=>{const action=e.target.closest('[data-act]')?.dataset.act;if(!action)return;if(action==='close')return close();const ids=[...selected];
    if(action==='all')getState().tattoos.forEach(t=>selected.add(t.id));if(action==='none')selected.clear();
    if(action==='chooseGroup'){selected.clear();getState().tattoos.filter(t=>$('#il-groups').value && t.group===$('#il-groups').value).forEach(t=>selected.add(t.id));}
    if(action==='group'){const name=$('#il-group-name').value.trim();if(!name)return note('Enter a group name first.');mutate(s=>assignGroup(s,ids,name));note('Selected tattoos grouped.');}
    if(action==='rename'){const id=$('#il-groups').value,name=$('#il-group-name').value.trim();if(!id||!name)return note('Choose a group and enter its new name.');mutate(s=>assignGroup(s,[],name,id));}
    if(action==='ungroup')mutate(s=>s.tattoos.forEach(t=>{if(selected.has(t.id))delete t.group;}));
    if(action==='show'||action==='hide'){endSolo();mutate(s=>changeSelected(s,ids,{hidden:action==='hide'}));}
    if(action==='lock'||action==='unlock')mutate(s=>changeSelected(s,ids,{locked:action==='lock'}));
    if(action==='opacity'){const n=Number($('#il-opacity').value);if(!Number.isFinite(n))return note('Enter ink strength between 10 and 100.');mutate(s=>changeSelected(s,ids,{opacity:n/100}));}
    if(action==='solo'&&typeof onSolo==='function'){if(soloActive)endSolo();else{soloActive=true;onSolo([...selected]);}}
    render();
  });render();$('[data-act=close]').focus();return {close};
}
