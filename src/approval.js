// Ask for approval: a page you send your artist or client, and their answers back into the
// app, with no server. The page is one self-contained HTML file: each planned tattoo with a
// picture of it on the body, its artwork and real size, Yes or Change and a note. Send my
// answers shares a short plain text, which also works as a typed reply ("1 yes, 2 change:
// smaller") when the page is only previewed. Bring in answers reads that text back.

export const VERDICTS = ['approved', 'changes'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isImg = (u) => typeof u === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u);

// A short reference that ties the answers to this ask.
export function makeRef(rand = Math.random) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}

// Reference pictures and open comments that go with a tattoo, or with the whole plan.
// refs: [{ src, note? }] (JPEG or PNG data URLs); comments: [{ text, by?, replies?: [{ text, by? }] }].
function extras(refs, comments, plan) {
  const r = (Array.isArray(refs) ? refs : []).filter((x) => x && isImg(x.src)).slice(0, 8);
  const c = (Array.isArray(comments) ? comments : []).filter((x) => x && typeof x.text === 'string' && x.text.trim()).slice(0, 12);
  let out = '';
  if (r.length) out += `<div class="refs"><h3>${plan ? 'Reference pictures for the whole plan' : 'Reference pictures'}</h3><div class="refgrid">${r.map((x) => `<figure><img src="${x.src}" alt="${esc(x.note || 'Reference picture')}">${x.note ? `<figcaption>${esc(String(x.note).slice(0, 300))}</figcaption>` : ''}</figure>`).join('')}</div></div>`;
  if (c.length) out += `<div class="notes"><h3>${plan ? 'Comments on the whole plan' : 'Comments so far'}</h3><ul>${c.map((x) => `<li><b>${esc(x.by || 'Someone')}:</b> ${esc(String(x.text).slice(0, 500))}${(Array.isArray(x.replies) ? x.replies : []).slice(0, 12).map((y) => y && y.text ? `<div class="re"><b>${esc(y.by || 'Someone')}:</b> ${esc(String(y.text).slice(0, 500))}</div>` : '').join('')}</li>`).join('')}</ul></div>`;
  return out;
}

// The page. items: [{ n, name, size, status, closeUp, art, refs?, comments? }] (pictures as data
// URLs); refs and comments: the ones for the whole plan, shown before the end.
export function approvalHtml({ title, ref, items, date, refs, comments }) {
  const cards = items.map((it) => `
<section class="card" data-n="${it.n}">
  <h2><span class="n">${it.n}</span>${esc(it.name)}</h2>
  <p class="meta">${esc(it.size)}${it.status ? ' · ' + esc(it.status) : ''}</p>
  <div class="pics">${isImg(it.closeUp) ? `<img src="${it.closeUp}" alt="${esc(it.name)} on the body">` : ''}${isImg(it.art) ? `<img class="art" src="${it.art}" alt="${esc(it.name)} artwork">` : ''}</div>
  <div class="choice" role="radiogroup" aria-label="Your answer for ${esc(it.name)}">
    <label><input type="radio" name="v${it.n}" value="yes"><span>Yes, go ahead</span></label>
    <label><input type="radio" name="v${it.n}" value="change"><span>Change it</span></label>
  </div>
  ${extras(it.refs, it.comments)}
  <textarea name="t${it.n}" rows="2" placeholder="What would you change? (optional)"></textarea>
</section>`).join('');
  const general = extras(refs, comments, true);
  const names = JSON.stringify(items.map((it) => String(it.name))).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}: what do you think?</title>
<style>
:root{color-scheme:light;--ink:#1b1b1f;--muted:#5d6070;--line:#d9d9e0;--accent:#6c5ce7}
*{box-sizing:border-box}body{margin:0;font:16px/1.45 -apple-system,system-ui,sans-serif;color:var(--ink);background:#f4f3ef}
main{max-width:720px;margin:0 auto;padding:20px 16px 48px}h1{font-size:24px;margin:8px 0 4px}.sub{color:var(--muted);margin:0 0 18px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;margin:0 0 16px}
.card h2{font-size:19px;margin:0;display:flex;align-items:center;gap:10px}.n{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;border-radius:15px;background:var(--ink);color:#fff;font-size:15px}
.meta{color:var(--muted);margin:4px 0 10px}.pics{display:flex;gap:10px;align-items:flex-start}.pics img{display:block;width:68%;border-radius:12px;background:#ddd}.pics img.art{width:30%;background:#fff;border:1px solid var(--line);padding:6px}
.choice{display:flex;gap:8px;margin:12px 0 8px}.choice label{flex:1}.choice input{position:absolute;opacity:0}.choice span{display:flex;align-items:center;justify-content:center;min-height:48px;border:1.5px solid var(--line);border-radius:12px;font-weight:600;cursor:pointer}
.choice input:checked+span{background:var(--ink);color:#fff;border-color:var(--ink)}.choice input:focus-visible+span{outline:3px solid var(--accent)}
textarea,input[type=text]{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#fff}
.end{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px}.end label{display:block;font-weight:600;margin:0 0 6px}.end textarea{margin:0 0 12px}
button{font:inherit;font-weight:700;min-height:52px;width:100%;border:0;border-radius:14px;background:var(--accent);color:#fff;margin-top:12px;cursor:pointer}
#out{display:none;white-space:pre-wrap;background:#f4f3ef;border-radius:12px;padding:12px;margin-top:12px;font-size:15px}#done{color:var(--muted);margin:10px 0 0}
.plain{color:var(--muted);font-size:15px;margin:20px 4px 0}
h3{font-size:15px;margin:12px 0 6px;color:var(--muted)}.refgrid{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}.refgrid figure{margin:0;flex:0 0 auto;width:150px}.refgrid img{display:block;width:150px;height:150px;object-fit:cover;border-radius:10px;background:#eee}.refgrid figcaption{font-size:13px;color:var(--muted);margin-top:4px}.notes ul{list-style:none;margin:0;padding:0}.notes li{background:#f4f3ef;border-radius:10px;padding:8px 10px;margin:0 0 6px}.notes .re{margin:4px 0 0 14px;color:var(--muted)}.general{background:#fff;border:1px solid var(--line);border-radius:16px;padding:4px 16px 12px;margin:0 0 16px}
</style></head><body><main>
<h1>${esc(title)}: what do you think?</h1>
<p class="sub">Tap Yes or Change for each tattoo, then Send my answers.${date ? ' Sent ' + esc(date) + '.' : ''}</p>
${cards}
${general ? `<section class="general">${general}</section>` : ''}
<section class="end">
  <label for="by">Your name</label><input type="text" id="by" autocomplete="name">
  <label for="also" style="margin-top:12px">Anything else?</label><textarea id="also" rows="3"></textarea>
  <button type="button" id="send">Send my answers</button>
  <div id="out"></div><p id="done"></p>
</section>
<p class="plain">If the buttons do nothing here, just reply to whoever sent you this with the number of each tattoo and yes, or what to change. For example: 1 yes, 2 change: a little smaller. Reference ${esc(ref)}.</p>
</main>
<script>
(function(){
  var names=${names}, ref=${JSON.stringify(String(ref))};
  function text(){
    var lines=['Tattoo plan answers (ref '+ref+')'];
    for(var i=0;i<names.length;i++){
      var n=i+1, v=document.querySelector('input[name="v'+n+'"]:checked'), t=(document.querySelector('textarea[name="t'+n+'"]').value||'').replace(/\\s+/g,' ').trim();
      var a=v?(v.value==='yes'?'yes':'change'):(t?'change':'no answer');
      lines.push(n+' '+names[i]+': '+a+(t?': '+t:''));
    }
    var also=(document.getElementById('also').value||'').replace(/\\s+/g,' ').trim(), by=(document.getElementById('by').value||'').trim();
    if(also)lines.push('Also: '+also); if(by)lines.push('From: '+by);
    return lines.join('\\n');
  }
  document.getElementById('send').addEventListener('click',function(){
    var t=text(), out=document.getElementById('out'), done=document.getElementById('done');
    out.style.display='block'; out.textContent=t;
    if(navigator.share){navigator.share({text:t}).then(function(){done.textContent='Sent. Thank you!';},function(){done.textContent='Copy the text above and send it back.';});return;}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){done.textContent='Copied. Paste it in a message back to whoever sent you this.';},function(){done.textContent='Copy the text above and send it back.';});return;}
    done.textContent='Copy the text above and send it back.';
  });
})();
</script></body></html>`;
}

const YES = /^(yes|yep|yeah|yup|ok|okay|approve|approved|good|great|fine|sure|perfect|love it|looks good|go ahead|go|do it|\u{1F44D}|\u2705|\u{1F44C})(?=$|[\s:,.!\-\u2013\u2014])/iu;
const NO = /^(no|nope|change it|changes|change|not yet|needs changes|needs work|\u{1F44E}|\u274C)(?=$|[\s:,.!\-\u2013\u2014])/iu;
const tidy = (s) => s.replace(/^[\s:,.!\-\u2013\u2014]+/, '').trim().slice(0, 300);

// Read answers back. asks: the asks this project sent ([{ ref, ids }], newest last); tattoos:
// [{ id, name }]. Returns which ask it answers, who from, and each answer by tattoo id.
export function parseAnswers(text, asks = [], tattoos = []) {
  const src = String(text || '').slice(0, 20000).replace(/\r/g, '');
  const refM = src.match(/\bref(?:erence)?[\s:#]*([A-Z2-9]{5})\b/i);
  const ref = refM ? refM[1].toUpperCase() : null;
  const ask = (ref && asks.find((a) => a.ref === ref)) || (asks.length ? asks[asks.length - 1] : null);
  const out = { ref, ask: ask ? ask.ref : null, refMatched: !!(ref && ask && ask.ref === ref), by: '', note: '', answers: [], unread: [] };
  const byM = src.match(/^\s*from\s*:\s*(.+)$/im); if (byM) out.by = byM[1].trim().slice(0, 60);
  const alsoM = src.match(/^\s*(?:also|note|anything else)\s*:\s*(.+)$/im); if (alsoM) out.note = alsoM[1].trim().slice(0, 500);
  const byName = new Map(tattoos.map((t) => [String(t.name).trim().toLowerCase(), t.id]));
  const seen = new Set();
  // one answer per line; "1 yes, 2 change: smaller" on one line is split at the numbers
  const parts = [];
  for (const line of src.split('\n')) {
    if (/^\s*(from|also|note|anything else)\s*:/i.test(line) || /tattoo plan answers/i.test(line) || /^\s*ref(erence)?[\s:#]*[A-Z2-9]{5}\s*$/i.test(line)) continue;
    const bits = line.split(/[,;]\s*(?=#?\d{1,2}\b\s*[.):\-]?\s*\S)/);
    parts.push(...bits);
  }
  for (const raw of parts) {
    const line = raw.trim(); if (!line) continue;
    let id = null, rest = '';
    const m = line.match(/^#?(\d{1,2})\s*[.):\-]?\s+(.*)$/) || line.match(/^#?(\d{1,2})\s*[.):\-]\s*(.*)$/);
    if (m && ask && ask.ids[+m[1] - 1]) { id = ask.ids[+m[1] - 1]; rest = m[2]; }
    if (!id) {
      for (const [name, tid] of byName) if (name && line.toLowerCase().startsWith(name) && /^[\s:\-\u2013\u2014]/.test(line.slice(name.length))) { id = tid; rest = line.slice(name.length); break; }
    }
    if (!id) { if (/\S/.test(line) && out.unread.length < 20) out.unread.push(line.slice(0, 120)); continue; }
    if (seen.has(id)) continue;
    // drop the tattoo's own name in front ("1 Sunburst: yes")
    const t = tattoos.find((x) => x.id === id);
    if (t) { const nm = String(t.name).trim().toLowerCase(); if (nm && rest.toLowerCase().startsWith(nm) && /^($|[\s:\-\u2013\u2014])/.test(rest.slice(nm.length))) rest = rest.slice(nm.length); }
    rest = tidy(rest);
    if (/^no answer$/i.test(rest) || !rest) continue;
    let verdict, note;
    const y = rest.match(YES), n = rest.match(NO);
    if (y) { verdict = 'approved'; note = tidy(rest.slice(y[0].length)); }
    else if (n) { verdict = 'changes'; note = tidy(rest.slice(n[0].length)); }
    else { verdict = 'changes'; note = rest; }
    if (verdict === 'changes' && /^(it|them)\b/i.test(note)) note = tidy(note.replace(/^(it|them)\b/i, ''));
    seen.add(id); out.answers.push({ id, verdict, note });
  }
  return out;
}

// Keep only well-formed answers and asks when a project is opened.
export function cleanReview(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r) || !VERDICTS.includes(r.verdict)) return null;
  const at = typeof r.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.at) ? r.at : null;
  return { verdict: r.verdict, note: typeof r.note === 'string' ? r.note.slice(0, 300) : '', by: typeof r.by === 'string' ? r.by.slice(0, 60) : '', ...(at ? { at } : {}) };
}
export function cleanAsks(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const a of list.slice(-10)) {
    if (!a || typeof a !== 'object' || typeof a.ref !== 'string' || !/^[A-Z2-9]{5}$/.test(a.ref) || !Array.isArray(a.ids)) continue;
    const ask = { ref: a.ref, ids: a.ids.filter((x) => typeof x === 'string').slice(0, 50), at: typeof a.at === 'number' && Number.isFinite(a.at) ? a.at : 0 };
    if (a.reply && typeof a.reply === 'object') ask.reply = { by: typeof a.reply.by === 'string' ? a.reply.by.slice(0, 60) : '', note: typeof a.reply.note === 'string' ? a.reply.note.slice(0, 500) : '', at: typeof a.reply.at === 'string' ? a.reply.at.slice(0, 10) : '' };
    out.push(ask);
  }
  return out.length ? out : null;
}
