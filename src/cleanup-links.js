// Pure state revision for a newly cleaned artwork image. Caller owns image storage,
// undo, validation at import boundaries and persistence. Historical snapshots stay
// unchanged and all previous artwork records remain available for undo/restore.
const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
function freshId(records) {
  let id;
  do { id = `art-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`; } while(Object.prototype.hasOwnProperty.call(records,id));
  return id;
}
export function applyArtworkRevision(state, tattooId, newImageKey, aspect, {linked=false}={}) {
  if(!state || typeof state!=='object' || !Array.isArray(state.tattoos))throw new TypeError('A project with tattoos is required');
  if(typeof newImageKey!=='string'||!newImageKey.trim()||newImageKey.length>512)throw new TypeError('A nonempty image key is required');
  if(!Number.isFinite(aspect)||aspect<=0)throw new TypeError('Artwork aspect must be finite and positive');
  const target=state.tattoos.find(t=>t?.id===tattooId);
  if(!target)throw new Error('Tattoo not found');
  const nextState=clone(state),changedIds=[],skippedIds=[];
  const records=nextState.artworks && typeof nextState.artworks==='object' && !Array.isArray(nextState.artworks)?nextState.artworks:{};
  const hasIdentity=typeof target.artworkId==='string'&&target.artworkId.length>0;
  const candidates=nextState.tattoos.filter(t=>t && (t.id===tattooId || (linked&&hasIdentity&&t.artworkId===target.artworkId)));
  const editable=candidates.filter(t=>{if(t.locked){skippedIds.push(t.id);return false;}return true;});
  if(!editable.length)return {nextState,changedIds,skippedIds,artworkId:null};
  const previous=hasIdentity && records[target.artworkId] && typeof records[target.artworkId]==='object' && !Array.isArray(records[target.artworkId])?records[target.artworkId]:{};
  const source=typeof previous.source==='string'&&previous.source?previous.source:target.img;
  if(typeof source!=='string'||!source)throw new TypeError('The original artwork source is unavailable');
  const artworkId=freshId(records);
  const revision={...previous,source,output:newImageKey};
  // Some import formats also store the identity inside each record.
  if(Object.prototype.hasOwnProperty.call(revision,'id'))revision.id=artworkId;
  if(!revision.name)revision.name=target.name||'Tattoo';
  records[artworkId]=revision;nextState.artworks=records;
  for(const tattoo of editable){tattoo.artworkId=artworkId;tattoo.img=newImageKey;tattoo.aspect=aspect;changedIds.push(tattoo.id);}
  return {nextState,changedIds,skippedIds,artworkId};
}
