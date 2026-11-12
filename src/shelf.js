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
.ink-shelf{position:fixed;inset:0;z-index:10000;background:#1119;display:grid;place-items:center;padding:16px;box-sizing:border-box;font:16px system-ui;color:#263735;overscroll-behavior:contain}
.ink-shelf *{box-sizing:border-box}.ink-shelf .is-panel{background:#f6f6ef;border:1px solid #fff7;border-radius:20px;width:min(680px,100%);max-height:90dvh;display:flex;flex-direction:column;box-shadow:0 12px 70px #0004;padding:20px;gap:12px}
.ink-shelf header,.ink-shelf .is-tools,.ink-shelf .is-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ink-shelf header{justify-content:space-between}.ink-shelf h2{margin:0;font-size:23px}.ink-shelf p{margin:0;line-height:1.4}.ink-shelf button{min-height:44px;min-width:44px;border:1px solid #a7bab3;background:#fff;border-radius:10px;padding:8px 13px;color:#263735;font:inherit;cursor:pointer;touch-action:manipulation}.ink-shelf button.primary{background:#234d42;color:white}.ink-shelf button:disabled{opacity:.5;cursor:wait}.ink-shelf input{font:inherit;font-size:16px;min-height:44px;padding:8px 10px;border-radius:9px;border:1px solid #a7bab3;flex:1;min-width:100px}.ink-shelf .is-list{overflow:auto;overscroll-behavior:contain;min-height:0;touch-action:pan-y}.ink-shelf article{padding:12px 0;border-top:1px solid #cbd4cc;display:grid;gap:8px}.ink-shelf small{display:block;color:#52645e}.ink-shelf .is-message{min-height:24px;color:#8a302e}.ink-shelf .is-edit{display:flex;gap:8px;flex-wrap:wrap}
</style><section class="is-panel" role="dialog" aria-modal="true" aria-labelledby="ink-shelf-title"><header><h2 id="ink-shelf-title">Projects</h2><button data-close>Close</button></header><p>Named copies on this device. Saving a copy keeps its artwork and placements. Archive is reversible.</p><div class="is-tools"><input aria-label="Name for current project copy" maxlength="80" data-name><button class="primary" data-save>Save current as a copy</button><button data-new>New blank project</button></div><div class="is-tools"><button data-archive aria-pressed="false">Show archived</button></div><p class="is-message" role="status" aria-live="polite"></p><div class="is-list"></div></section>`;
    (document.querySelector('#viewport') || document.body).append(root);
    const $ = (s) => root.querySelector(s), list = $('.is-list'), message = $('.is-message');
    $('[data-name]').value = currentName;
    let busy = false, archived = false, ended = false;
    const finish = (result) => { if (ended || busy) return; ended = true; document.removeEventListener('keydown', key); root.remove(); shelf.close(); previousFocus?.focus?.(); resolve(result); };
    const run = async (fn) => { if (busy || ended) return; busy = true; root.querySelectorAll('button').forEach(b=>b.disabled=true); message.textContent=''; try { await fn(); } catch(e) { message.textContent = e.message || 'Could not save. Your current project is unchanged.'; } finally { busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false); } };
    const keepCurrent = async () => shelf.create('Before switching · '+new Date().toLocaleString(), await current());
    const button = (text, handler) => { const b=document.createElement('button');b.textContent=text;b.type='button';b.onclick=()=>run(handler);return b; };
    async function render() {
      const rows = await shelf.list({archived}); list.replaceChildren();
      if (!rows.length) { const p=document.createElement('p');p.textContent=archived?'No archived projects.':'Save your current project as a copy to start your shelf.';list.append(p); }
      for(const row of rows) {
        const article=document.createElement('article'), title=document.createElement('strong'), detail=document.createElement('small'), actions=document.createElement('div');
        title.textContent=row.name;detail.textContent=`${row.tattoos} tattoo${row.tattoos===1?'':'s'} · ${new Date(row.updatedAt).toLocaleString()}`;actions.className='is-actions';
        if(archived) actions.append(button('Restore to shelf',async()=>{await shelf.restore(row.id);await render();}));
        else actions.append(button('Open',async()=>{const project=await shelf.get(row.id);if(!project)throw new Error('Project not found.');await keepCurrent();busy=false;finish({action:'open',project});}));
        actions.append(button('Duplicate',async()=>{await shelf.duplicate(row.id);await render();message.textContent='Independent copy saved to Projects.';}));
        actions.append(button('Rename',async()=>{ if(article.querySelector('.is-edit')) return; const wrap=document.createElement('div');wrap.className='is-edit';const input=document.createElement('input');input.value=row.name;input.maxLength=80;input.setAttribute('aria-label','Project name');wrap.append(input,button('Save name',async()=>{await shelf.rename(row.id,input.value);await render();}),button('Cancel',async()=>wrap.remove()));article.append(wrap);input.focus(); }));
        if(!archived) actions.append(button('Archive',async()=>{await shelf.archive(row.id);await render();}));
        article.append(title,detail,actions);list.append(article);
      }
    }
    $('[data-close]').onclick=()=>finish(null);
    $('[data-save]').onclick=()=>run(async()=>{await shelf.create($('[data-name]').value,await current());archived=false;$('[data-archive]').textContent='Show archived';$('[data-archive]').setAttribute('aria-pressed','false');await render();message.textContent='Project copy saved on this device.';});
    $('[data-new]').onclick=()=>run(async()=>{await keepCurrent();busy=false;finish({action:'new'});});
    $('[data-archive]').onclick=()=>run(async()=>{archived=!archived;$('[data-archive]').textContent=archived?'Show projects':'Show archived';$('[data-archive]').setAttribute('aria-pressed',String(archived));await render();});
    const key = (e) => { if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(null);} if(e.key==='Tab'){const els=[...root.querySelectorAll('button:not(:disabled),input')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}} };
    document.addEventListener('keydown',key);
    run(render);$('[data-close]').focus();
  });
}
