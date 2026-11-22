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
const DOTS='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';
const EYE='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.3 7.6C3.9 9.3 2.5 12 2.5 12S6 18.5 12 18.5c1.4 0 2.6-.3 3.7-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
const CSS=`#ink-layers{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;padding:16px;background:rgba(8,9,12,.42);color:var(--text);font:500 15px/1.35 var(--body);overscroll-behavior:contain;box-sizing:border-box}#ink-layers *{box-sizing:border-box}
#ink-layers .il-panel{width:min(600px,100%);max-height:min(100%,860px);gap:14px}
#ink-layers .il-explain{margin:-2px 4px 0;color:var(--muted);font-size:13px}
#ink-layers .il-bar{display:flex;align-items:center;gap:4px;margin:-6px 0 -8px 4px}#ink-layers #il-count{flex:1;color:var(--muted);font-size:13px}
#ink-layers .il-link{min-height:44px;padding:0 8px;background:none;border:0;color:var(--stencil);font:600 15px/1 var(--body);cursor:pointer}
#ink-layers .il-group{background:var(--fill-soft);border-radius:var(--r-md,14px);overflow:hidden;flex:none}
#ink-layers .il-item+.il-item{border-top:1px solid var(--line)}
#ink-layers .il-line{display:grid;grid-template-columns:44px 44px minmax(0,1fr) 44px 44px;align-items:center;gap:8px;padding:6px 6px 6px 4px;min-height:60px}
#ink-layers .il-item.on{background:var(--stencil-soft)}
#ink-layers .il-check{width:44px;height:44px;display:grid;place-items:center;cursor:pointer;position:relative}
#ink-layers .il-check input{position:absolute;opacity:0;width:44px;height:44px;margin:0;cursor:pointer}
#ink-layers .il-box{width:24px;height:24px;border-radius:50%;border:2px solid var(--line-strong);display:grid;place-items:center}
#ink-layers .il-check input:checked+.il-box{background:var(--stencil);border-color:var(--stencil)}
#ink-layers .il-check input:checked+.il-box::after{content:"";width:6px;height:11px;border:solid var(--on-accent);border-width:0 2.4px 2.4px 0;transform:translate(0,-1px) rotate(45deg)}
#ink-layers .il-check input:focus-visible+.il-box{outline:2px solid var(--stencil);outline-offset:2px}
#ink-layers .il-thumb{width:44px;height:44px;border-radius:9px;background:var(--fill);overflow:hidden;display:grid;place-items:center}#ink-layers .il-thumb img{width:100%;height:100%;object-fit:contain}
#ink-layers .il-name{min-width:0;min-height:44px;padding:0;background:none;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer}#ink-layers .il-name b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#ink-layers .il-name small{display:block;color:var(--muted);font-size:13px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ink-layers .il-icon{min-width:44px;width:44px;padding:0;background:transparent;border-color:transparent;color:var(--muted)}#ink-layers .il-icon[aria-expanded=true]{color:var(--text);background:var(--fill)}#ink-layers .il-eye.off{color:var(--faint,var(--muted))}
#ink-layers .il-item.hidden .il-thumb,#ink-layers .il-item.hidden .il-name b{opacity:.45}
#ink-layers .il-acts{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 10px 100px}#ink-layers .il-acts .btn{min-height:44px;font-size:14px;flex:none}
#ink-layers .il-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px;padding:8px}#ink-layers .il-grid .btn{min-width:0}
#ink-layers .btn[aria-pressed=true]{background:var(--stencil-soft);border-color:var(--stencil);color:var(--text)}
#ink-layers .il-row{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;min-height:56px}#ink-layers .il-row+.il-row{border-top:1px solid var(--line)}#ink-layers .il-row>span{flex:1;min-width:0}
#ink-layers .il-row input{flex:1;min-width:0;min-height:44px;font:inherit;font-size:16px;color:var(--text);background:transparent;border:0;padding:0;outline:none;touch-action:auto}#ink-layers .il-row input::placeholder{color:var(--faint,var(--muted))}
#ink-layers #il-opacity{flex:none;width:72px;text-align:right}#ink-layers .il-unit{color:var(--muted);margin-left:-4px}
#ink-layers details summary{min-height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 16px 0 14px;cursor:pointer;font-weight:600;list-style:none}#ink-layers details summary::-webkit-details-marker{display:none}#ink-layers details summary::after{content:"";width:9px;height:9px;border-right:2.2px solid var(--faint,var(--muted));border-bottom:2.2px solid var(--faint,var(--muted));transform:rotate(45deg) translate(-2px,-2px)}#ink-layers details[open] summary::after{transform:rotate(-135deg) translate(-2px,-2px)}
#ink-layers .il-gline{display:grid;grid-template-columns:minmax(0,1fr) auto 44px;align-items:center;gap:8px;padding:6px 6px 6px 14px;min-height:60px}#ink-layers .il-gline b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#ink-layers .il-gline small{display:block;color:var(--muted);font-size:13px}
#ink-layers .il-gacts{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 10px 14px}#ink-layers .il-gacts input{flex:1;min-width:140px;min-height:44px;font:inherit;font-size:16px;color:var(--text);background:var(--fill);border:1px solid var(--line);border-radius:10px;padding:0 10px;touch-action:auto}#ink-layers .il-gacts .btn{min-height:44px;flex:none}
#ink-layers .il-empty{margin:0;padding:16px;color:var(--muted);font-size:14px}
#ink-layers .il-foot{margin:-6px 4px 0;color:var(--muted);font-size:13px}
#ink-layers .il-list{flex:none}
#ink-layers [hidden]{display:none!important}
@media (max-width:520px){#ink-layers{padding:0;place-items:end stretch}#ink-layers .il-panel{width:100%;border-radius:var(--r-lg,22px) var(--r-lg,22px) 0 0}#ink-layers .il-acts{padding-left:10px}}`;
// Options: getState, change(fn(state)), select(id), getImages() optional.
// Optional onTransform({ids,scale}) provides true group transforms externally.
// onSolo(ids|null) is a view-only filter: it must not mutate project state; omit to disable solo.
// Solo is temporary and its view filter clears on closing or ending solo.
export function openLayers({getState,change,select,getImages=()=>({}),onTransform,onSolo,ticked=[]}) {
  const old=document.querySelector('#ink-layers');if(old)return;
  const previous=document.activeElement;const selected=new Set((ticked||[]).filter(id=>getState().tattoos.some(t=>t.id===id)));let soloActive=false,closed=false,openMore=null,openGroup=null;
  const host=document.createElement('div');host.id='ink-layers';
  host.innerHTML=`<style>${CSS}</style><section class="modal glass il-panel" role="dialog" aria-modal="true" aria-labelledby="il-title"><header><h2 id="il-title">Layers and groups</h2><button class="btn" type="button" data-act="close">Done</button></header>
<p class="il-explain">Same order as the Layers panel. Tap a name to edit that tattoo, or tick several to change them together.</p>
<div class="il-bar"><span id="il-count"></span><button class="il-link" type="button" data-act="all">Select all</button><button class="il-link" type="button" data-act="none">Clear</button></div>
<div class="il-group il-list"></div>
<div data-sel><h3 class="shHead" data-sel-head>The ticked ones</h3>
<div class="il-group il-grid"><button class="btn" type="button" data-act="show">Show</button><button class="btn" type="button" data-act="hide">Hide</button><button class="btn" type="button" data-act="solo" aria-pressed="false">Solo</button><button class="btn" type="button" data-act="lock">Lock</button><button class="btn" type="button" data-act="unlock">Unlock</button></div>
<div class="il-group" style="margin-top:8px"><div class="il-row"><span>Ink strength</span><input id="il-opacity" type="number" inputmode="numeric" min="10" max="100" value="92" aria-label="Ink strength in percent" enterkeyhint="done"><span class="il-unit" style="flex:none">%</span><button class="btn" type="button" data-act="opacity">Set</button></div>
<div class="il-row"><input id="il-group-name" maxlength="60" placeholder="Name a group for them" aria-label="Group name" enterkeyhint="done"><button class="btn primary" type="button" data-act="group">Group</button></div>
<div class="il-row" data-ungroup-row><span>In a group</span><button class="btn" type="button" data-act="ungroup">Take out of group</button></div></div>
<div class="il-group" id="il-transform" style="margin-top:8px" hidden></div></div>
<div data-groups><h3 class="shHead">Groups</h3><div class="il-group il-glist"></div></div>
<p class="il-foot" id="il-status" role="status">Changes save as you go, and Undo takes them back. Solo lasts until you close this.</p></section>`;
  (document.querySelector('#viewport') || document.body).append(host);
  const $=s=>host.querySelector(s);
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
  const btn=(text,action,cls='btn')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',action);return b;};
  const note=text=>{$('#il-status').textContent=text;};
  const mutate=fn=>{endSolo();change(fn);render();};
  const endSolo=()=>{if(!soloActive)return;soloActive=false;onSolo(null);};
  const close=()=>{if(closed)return;closed=true;endSolo();document.removeEventListener('keydown',key,true);host.remove();previous?.focus?.();};
  const groupOf=(state,t)=>(state.groups||[]).find(g=>g&&g.id===t.group);
  function render(){
    const state=getState(),images=getImages()||{},list=$('.il-list');
    for(const id of selected)if(!state.tattoos.some(t=>t.id===id))selected.delete(id);
    list.replaceChildren();
    state.tattoos.forEach((t,index)=>{
      const item=el('div','il-item'+(selected.has(t.id)?' on':'')+(t.hidden?' hidden':'')),line=el('div','il-line');
      const label=el('label','il-check'),check=el('input');check.type='checkbox';check.checked=selected.has(t.id);check.setAttribute('aria-label',`Tick ${t.name}`);
      check.addEventListener('change',()=>{if(check.checked)selected.add(t.id);else selected.delete(t.id);render();});label.append(check,el('span','il-box'));
      const thumb=el('span','il-thumb');if(typeof images[t.img]==='string'&&images[t.img].startsWith('data:image/')){const im=el('img');im.src=images[t.img];im.alt='';thumb.append(im);}
      const group=groupOf(state,t),bits=[t.status==='existing'?'On my skin':'Planned'];if(group)bits.push(group.name);if(t.locked&&t.status!=='existing')bits.push('Locked');if(t.hidden)bits.push('Hidden');
      const name=btn('',()=>{close();select(t.id);},'il-name');name.append(el('b','',t.name||'Tattoo'),el('small','',bits.join(' · ')));name.setAttribute('aria-label',`Edit ${t.name}`);
      const eye=btn('',()=>{endSolo();mutate(s=>changeSelected(s,[t.id],{hidden:!t.hidden}));note(t.hidden?`${t.name} hidden.`:`${t.name} showing.`);},'btn il-icon il-eye'+(t.hidden?' off':''));
      eye.innerHTML=t.hidden?EYE_OFF:EYE;eye.setAttribute('aria-label',`${t.hidden?'Show':'Hide'} ${t.name}`);
      const more=btn('',()=>{openMore=openMore===t.id?null:t.id;render();},'btn il-icon il-more');more.innerHTML=DOTS;more.setAttribute('aria-label',`More for ${t.name}`);more.setAttribute('aria-expanded',String(openMore===t.id));
      line.append(label,thumb,name,eye,more);item.append(line);
      if(openMore===t.id){const acts=el('div','il-acts');
        const up=btn('Move earlier',()=>{mutate(s=>reorderTattoo(s,t.id,-1));note(`${t.name} moved earlier.`);});up.disabled=index===0;up.setAttribute('aria-label',`Move ${t.name} earlier`);
        const down=btn('Move later',()=>{mutate(s=>reorderTattoo(s,t.id,1));note(`${t.name} moved later.`);});down.disabled=index===state.tattoos.length-1;down.setAttribute('aria-label',`Move ${t.name} later`);
        const lock=btn(t.locked?'Unlock':'Lock',()=>mutate(s=>changeSelected(s,[t.id],{locked:!t.locked})));
        acts.append(up,down,lock);if(group)acts.append(btn('Take out of group',()=>mutate(s=>{const x=s.tattoos.find(v=>v.id===t.id);if(x)delete x.group;})));
        item.append(acts);}
      list.append(item);
    });
    if(!state.tattoos.length)list.append(el('p','il-empty','Add a tattoo with the + at the top of Layers to see it here.'));
    $('#il-count').textContent=selected.size?`${selected.size} ticked`:(state.tattoos.length?'Tick to change several at once':'');
    $('[data-act=all]').hidden=!state.tattoos.length||selected.size===state.tattoos.length;$('[data-act=none]').hidden=!selected.size;
    const any=selected.size>0||soloActive;$('[data-sel]').hidden=!any;
    $('[data-sel-head]').textContent=selected.size?`The ${selected.size} ticked`:'Solo';
    for(const action of ['group','show','hide','lock','unlock','opacity','ungroup'])$(`[data-act=${action}]`).disabled=!selected.size;
    $('[data-ungroup-row]').hidden=!state.tattoos.some(t=>selected.has(t.id)&&t.group);
    const solo=$('[data-act=solo]');solo.hidden=typeof onSolo!=='function';solo.disabled=!selected.size&&!soloActive;solo.textContent=soloActive?'End solo':'Solo';solo.setAttribute('aria-pressed',String(!!soloActive));
    const groups=(state.groups||[]).filter(g=>g&&typeof g.id==='string'&&typeof g.name==='string'),glist=$('.il-glist');$('[data-groups]').hidden=!groups.length;glist.replaceChildren();
    for(const g of groups){const members=state.tattoos.filter(t=>t.group===g.id),item=el('div','il-item'),line=el('div','il-gline'),text=el('span');
      text.append(el('b','',g.name),el('small','',members.length?`${members.length} ${members.length===1?'tattoo':'tattoos'}`:'Empty'));
      const pick=btn('Tick these',()=>{selected.clear();members.forEach(t=>selected.add(t.id));render();note(`Ticked ${g.name}.`);});pick.disabled=!members.length;pick.dataset.groupPick=g.id;
      const more=btn('',()=>{openGroup=openGroup===g.id?null:g.id;render();},'btn il-icon il-more');more.innerHTML=DOTS;more.setAttribute('aria-label',`More for ${g.name}`);more.setAttribute('aria-expanded',String(openGroup===g.id));
      line.append(text,pick,more);item.append(line);
      if(openGroup===g.id){const acts=el('div','il-gacts'),input=el('input');input.value=g.name;input.maxLength=60;input.setAttribute('aria-label',`New name for ${g.name}`);input.enterKeyHint='done';
        const rename=()=>{const n=input.value.trim();if(!n)return note('Type the new name first.');mutate(s=>assignGroup(s,[],n,g.id));note(`Renamed to ${n}.`);};
        input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();rename();}});
        acts.append(input,btn('Rename',rename),btn('Ungroup',()=>{openGroup=null;mutate(s=>{s.tattoos.forEach(t=>{if(t.group===g.id)delete t.group;});s.groups=(s.groups||[]).filter(x=>x&&x.id!==g.id);});note(`${g.name} ungrouped. The tattoos stay.`);}));
        item.append(acts);}
      glist.append(item);}
  }
  function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const nodes=[...host.querySelectorAll('button:not(:disabled),input,select,summary')].filter(n=>n.offsetParent!==null);const a=nodes[0],b=nodes.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}}
  document.addEventListener('keydown',key,true);
  if(onTransform){const box=el('details'),summary=el('summary','','Move or resize them together');box.append(summary);const row=el('div','il-grid');
    for(const [label,values,aria] of [['Smaller',{scale:.9}],['Larger',{scale:1.1}],['Turn left',{rotation:-Math.PI/36}],['Turn right',{rotation:Math.PI/36}],['←',{dx:-.002},'Move left'],['→',{dx:.002},'Move right'],['↑',{dy:.002},'Move up'],['↓',{dy:-.002},'Move down']]){
      const b=btn(label,async()=>{if(!selected.size)return note('Tick some tattoos first.');try{endSolo();const r=await onTransform({ids:[...selected],...values});note(r?.message||'Moved. Locked tattoos and ink already on you stay put.');render();}catch(err){note(err.message);}});b.dataset.transform=label;if(aria)b.setAttribute('aria-label',aria);row.append(b);}
    box.append(row);$('#il-transform').append(box);$('#il-transform').hidden=false;}
  $('#il-group-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('[data-act=group]').click();}});
  host.addEventListener('click',e=>{if(e.target===host)return close();const action=e.target.closest('[data-act]')?.dataset.act;if(!action)return;if(action==='close')return close();const ids=[...selected];
    if(action==='all')getState().tattoos.forEach(t=>selected.add(t.id));if(action==='none')selected.clear();
    if(action==='group'){const name=$('#il-group-name').value.trim();if(!name)return note('Type a name for the group first.');mutate(s=>assignGroup(s,ids,name));$('#il-group-name').value='';note(`Grouped as ${name}.`);}
    if(action==='ungroup'){mutate(s=>s.tattoos.forEach(t=>{if(selected.has(t.id))delete t.group;}));note('Taken out of their group.');}
    if(action==='show'||action==='hide'){endSolo();mutate(s=>changeSelected(s,ids,{hidden:action==='hide'}));}
    if(action==='lock'||action==='unlock')mutate(s=>changeSelected(s,ids,{locked:action==='lock'}));
    if(action==='opacity'){const n=Number($('#il-opacity').value);if(!Number.isFinite(n)||n<10||n>100)return note('Ink strength goes from 10 to 100.');mutate(s=>changeSelected(s,ids,{opacity:n/100}));note(`Ink strength set to ${Math.round(n)}%. Locked ones stay as they are.`);}
    if(action==='solo'&&typeof onSolo==='function'){if(soloActive){endSolo();note('Showing everything again.');}else{soloActive=true;onSolo([...selected]);note('Only the ticked ones show until you end solo or close this.');}}
    render();
  });render();$('[data-act=close]').focus();return {close};
}
