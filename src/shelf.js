// Independent, recoverable project shelf. Never writes the active-project database.
const DB = 'ink-atlas-project-shelf', STORE = 'projects';
const copy = (v) => JSON.parse(JSON.stringify(v));
const nameOf = (v) => String(v || 'Untitled project').trim().slice(0, 80) || 'Untitled project';
const idOf = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
function snapshotOf(value) {
  if (!value || !value.state || !Array.isArray(value.state.tattoos) || !value.images || typeof value.images !== 'object') throw new Error('This project cannot be copied safely.');
  return copy({state: value.state, images: value.images});
}
export async function openProjectShelf() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, {keyPath: 'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Project storage is unavailable.'));
    request.onblocked = () => reject(new Error('Close other Ink Atlas tabs, then try again.'));
  });
  db.onversionchange = () => db.close();
  function transaction(mode, operation) {
    return new Promise((resolve, reject) => {
      let tx, value;
      try { tx = db.transaction(STORE, mode); } catch (e) { reject(e); return; }
      tx.oncomplete = () => resolve(value);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not save the project. Your current project is unchanged.'));
      try { operation(tx.objectStore(STORE), (v) => { value = v; }, () => tx.abort()); }
      catch (e) { try { tx.abort(); } catch (_) {} reject(e); }
    });
  }
  const get = (id) => transaction('readonly', (store, done) => { const r = store.get(id); r.onsuccess = () => done(r.result ? copy(r.result) : null); });
  const create = async (name, snapshot) => {
    const payload = snapshotOf(snapshot), now = Date.now();
    const row = {id: idOf(), name: nameOf(name), createdAt: now, updatedAt: now, archived: false, ...payload};
    await transaction('readwrite', (s) => s.add(row)); return copy(row);
  };
  const modify = (id, fn) => transaction('readwrite', (store, done, abort) => {
    const r = store.get(id);
    r.onsuccess = () => {
      if (!r.result) { abort(); return; }
      try { const row = fn(r.result); row.updatedAt = Date.now(); store.put(row); done(copy(row)); }
      catch (_) { abort(); }
    };
  });
  return {
    async list({archived = false} = {}) {
      const rows = await transaction('readonly', (s, done) => { const r = s.getAll(); r.onsuccess = () => done(r.result); });
      return rows.filter((r) => !!r.archived === archived).sort((a,b) => b.updatedAt - a.updatedAt).map(({state,images,...meta}) => ({...meta,tattoos: state.tattoos.length}));
    },
    get, create,
    async save(id, snapshot) { const payload = snapshotOf(snapshot); return modify(id, (r) => ({...r, ...payload})); },
    rename: (id, name) => modify(id, (r) => ({...r, name: nameOf(name)})),
    archive: (id) => modify(id, (r) => ({...r, archived: true})),
    restore: (id) => modify(id, (r) => ({...r, archived: false})),
    async duplicate(id) { const row = await get(id); if (!row) throw new Error('That project is no longer available.'); return create(row.name + ' copy', row); },
    close: () => db.close(),
  };
}

// Returns null, {action:'new'}, or {action:'open', project:{id,name,state,images,...}}.
// Before leaving, it keeps an independent copy of current(). Caller still owns
// validation, migration and replacing its active state, and must await that work.
export async function openShelf({current, currentName = 'Current project'} = {}) {
  if (typeof current !== 'function') throw new Error('A current-project snapshot is required.');
  const shelf = await openProjectShelf();
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const root = document.createElement('div'); root.className = 'ink-shelf';
    root.innerHTML = `<style>
.ink-shelf{position:fixed;inset:0;z-index:10000;background:rgba(8,9,12,.42);display:grid;place-items:center;padding:16px;box-sizing:border-box;font:500 15px/1.35 var(--body);color:var(--text);overscroll-behavior:contain}.ink-shelf *{box-sizing:border-box}
.ink-shelf .is-panel{width:min(600px,100%);max-height:min(100%,860px);gap:14px}
.ink-shelf .is-explain{margin:-2px 4px 0;color:var(--muted);font-size:13px}
.ink-shelf .is-group{background:var(--fill-soft);border-radius:var(--r-md,14px);overflow:hidden;flex:none}
.ink-shelf .is-save{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;border-bottom:1px solid var(--line)}
.ink-shelf input{flex:1;min-width:0;min-height:44px;font:inherit;font-size:16px;color:var(--text);background:transparent;border:0;padding:0;outline:none;touch-action:auto}
.ink-shelf .is-new{display:flex;width:100%;min-height:52px;align-items:center;padding:0 14px;background:none;border:0;color:var(--stencil);font:600 15px/1.2 var(--body);cursor:pointer;text-align:left}
.ink-shelf .is-message{margin:-6px 4px 0;font-size:13px;color:var(--muted)}.ink-shelf .is-message:empty{display:none}.ink-shelf .is-message.bad{color:var(--danger)}
.ink-shelf article+article{border-top:1px solid var(--line)}
.ink-shelf .is-line{display:grid;grid-template-columns:44px minmax(0,1fr) auto 44px;align-items:center;gap:12px;padding:8px 6px 8px 10px;min-height:64px}
.ink-shelf .is-icon{width:44px;height:44px;border-radius:10px;background:var(--fill);display:grid;place-items:center;color:var(--muted)}
.ink-shelf .is-text{min-width:0}.ink-shelf .is-text strong{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ink-shelf .is-text small{display:block;color:var(--muted);font-size:13px;margin-top:2px}
.ink-shelf .is-more{min-width:44px;padding:0;background:transparent;border-color:transparent;color:var(--muted)}.ink-shelf .is-more[aria-expanded=true]{color:var(--text);background:var(--fill)}
.ink-shelf .is-actions{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 10px 66px}.ink-shelf .is-actions .btn{min-height:40px;font-size:14px;flex:none}.ink-shelf .is-actions input{min-width:120px;background:var(--fill);border:1px solid var(--line);border-radius:10px;padding:0 10px}.ink-shelf .is-actions .danger{color:var(--danger)}
.ink-shelf .is-empty{margin:0;padding:16px;color:var(--muted);font-size:14px}
.ink-shelf .is-link{align-self:flex-start;min-height:44px;padding:0 4px;background:none;border:0;color:var(--stencil);font:600 15px/1 var(--body);cursor:pointer}
.ink-shelf [hidden]{display:none!important}
@media (max-width:520px){.ink-shelf{padding:0;place-items:end stretch}.ink-shelf .is-panel{width:100%;border-radius:var(--r-lg,22px) var(--r-lg,22px) 0 0}.ink-shelf .is-actions{padding-left:10px}}
</style><section class="modal glass is-panel" role="dialog" aria-modal="true" aria-labelledby="ink-shelf-title"><header><h2 id="ink-shelf-title">Projects</h2><button class="btn" type="button" data-close>Done</button></header>
<p class="is-explain">Each project keeps its own tattoos, here on this device.</p>
<div class="is-group"><div class="is-save"><input aria-label="Name for a copy of this project" maxlength="80" data-name enterkeyhint="done"><button class="btn primary" type="button" data-save>Save a copy</button></div><button class="is-new" type="button" data-new>Start a new blank project</button></div>
<p class="is-message" role="status" aria-live="polite"></p>
<h3 class="shHead" data-head>Saved</h3><div class="is-group is-list"></div>
<button class="is-link" type="button" data-archive aria-pressed="false">Show archived</button></section>`;
    (document.querySelector('#viewport') || document.body).append(root);
    const $ = (s) => root.querySelector(s), list = $('.is-list'), message = $('.is-message');
    $('[data-name]').value = currentName;
    let busy = false, archived = false, ended = false;
    const say = (t, bad = false) => { message.textContent = t; message.classList.toggle('bad', !!bad); };
    const finish = (result) => { if (ended || busy) return; ended = true; document.removeEventListener('keydown', key); root.remove(); shelf.close(); previousFocus?.focus?.(); resolve(result); };
    const run = async (fn) => { if (busy || ended) return; busy = true; root.querySelectorAll('button').forEach(b=>b.disabled=true); say(''); try { await fn(); } catch(e) { say(e.message || 'Could not save. Your current project is unchanged.', true); } finally { busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false); } };
    const keepCurrent = async () => shelf.create('Before switching · '+new Date().toLocaleString(), await current());
    const FOLDER='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>';
    const DOTS='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';
    const button = (text, handler, cls = '') => { const b=document.createElement('button');b.textContent=text;b.type='button';b.className='btn '+cls;b.onclick=()=>run(handler);return b; };
    let openMore = null;
    async function render() {
      const rows = await shelf.list({archived}); list.replaceChildren();
      $('[data-head]').textContent = archived ? 'Archived' : 'Saved';
      $('.is-group').hidden = archived;
      const archivedCount = archived ? 0 : (await shelf.list({archived:true})).length;
      $('[data-archive]').hidden = !archived && !archivedCount; $('[data-archive]').textContent = archived ? 'Back to saved' : `Show archived (${archivedCount})`;
      if (!rows.length) { const p=document.createElement('p');p.className='is-empty';p.textContent=archived?'No archived projects.':'Nothing saved yet. Save a copy of this project to start.';list.append(p); }
      for(const row of rows) {
        const article=document.createElement('article'), line=document.createElement('div'), icon=document.createElement('span'), text=document.createElement('span'), title=document.createElement('strong'), detail=document.createElement('small'), actions=document.createElement('div');
        line.className='is-line';icon.className='is-icon';icon.innerHTML=FOLDER;text.className='is-text';
        const d=new Date(row.updatedAt);title.textContent=row.name;detail.textContent=`${row.tattoos} tattoo${row.tattoos===1?'':'s'} · ${d.toLocaleDateString([],{day:'numeric',month:'short'})}, ${d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;text.append(title,detail);
        const primary = archived ? button('Put back',async()=>{await shelf.restore(row.id);await render();}) : button('Open',async()=>{const project=await shelf.get(row.id);if(!project)throw new Error('Project not found.');await keepCurrent();busy=false;finish({action:'open',project});});
        const more=document.createElement('button');more.type='button';more.className='btn is-more';more.innerHTML=DOTS;more.setAttribute('aria-label','More for '+row.name);more.setAttribute('aria-expanded',String(openMore===row.id));
        line.append(icon,text,primary,more);
        actions.className='is-actions';actions.hidden=openMore!==row.id;
        const fill=()=>{actions.replaceChildren();
          actions.append(button('Duplicate',async()=>{await shelf.duplicate(row.id);await render();say('Saved a separate copy.');}));
          actions.append(button('Rename',async()=>{actions.replaceChildren();const input=document.createElement('input');input.value=row.name;input.maxLength=80;input.setAttribute('aria-label','Project name');const save=button('Save name',async()=>{await shelf.rename(row.id,input.value);await render();},'primary');input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save.click();}};actions.append(input,save,button('Cancel',async()=>fill()));input.focus();}));
          if(!archived) actions.append(button('Archive',async()=>{await shelf.archive(row.id);openMore=null;await render();},'danger'));
        };fill();
        more.onclick=()=>{const on=actions.hidden;root.querySelectorAll('.is-actions').forEach(a=>{a.hidden=true;});root.querySelectorAll('.is-more').forEach(m=>m.setAttribute('aria-expanded','false'));actions.hidden=!on;more.setAttribute('aria-expanded',String(on));openMore=on?row.id:null;};
        article.append(line,actions);list.append(article);
      }
    }
    $('[data-close]').onclick=()=>finish(null);
    $('[data-save]').onclick=()=>run(async()=>{await shelf.create($('[data-name]').value,await current());archived=false;$('[data-archive]').setAttribute('aria-pressed','false');await render();say('Saved a copy on this device.');});
    $('[data-name]').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('[data-save]').click();}});
    $('[data-new]').onclick=()=>run(async()=>{await keepCurrent();busy=false;finish({action:'new'});});
    $('[data-archive]').onclick=()=>run(async()=>{archived=!archived;openMore=null;$('[data-archive]').setAttribute('aria-pressed',String(archived));await render();});
    const key = (e) => { if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(null);} if(e.key==='Tab'){const els=[...root.querySelectorAll('button:not(:disabled),input')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}} };
    document.addEventListener('keydown',key);
    run(render);$('[data-close]').focus();
  });
}
