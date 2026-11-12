// Export the documented shared v47 schema. The companion rebuild backup is required
// for lossless preservation: unknown extensions are not assumed to survive v47.
import * as THREE from 'three';
import {legacyPositions,shapePositions,shapePositionsV1,INDEX} from './mesh.js';
const SCALE=1.8/1.75,SKINS=['#f1d3bd','#e0b394','#c6916c','#9a6644','#6a422a'];
const copy=x=>JSON.parse(JSON.stringify(x));
const valid3=x=>Array.isArray(x)&&x.length===3&&x.every(v=>Number.isFinite(v)&&Math.abs(v)<10);
function name(value,fallback){const s=typeof value==='string'&&value.trim()?value.trim():fallback;if(s.length>120)throw new Error('v47 names must be at most 120 characters');return s;}
function id(value){if(typeof value!=='string'||!value.trim()||value.length>120)throw new Error('v47 identities must be nonblank strings of at most 120 characters');return value;}
function geometry(positions){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(new THREE.BufferAttribute(INDEX.slice(),1));g.computeVertexNormals();g.computeBoundingSphere();return g;}
function positionsFor(s){return !s.figure?legacyPositions():(s.v||1)<2?shapePositionsV1(s.figure,s.muscle,s.weight):shapePositions(s);}
/** Use matching triangle indices to inverse-map current anchors, never nearest-vertex guesses. */
export function createV47AnchorMapper(state){
 const current=geometry(positionsFor(state)),canonical=geometry(legacyPositions()),mat=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),mesh=new THREE.Mesh(current,mat),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);
 return {map(t){
  if(t.pos==null&&t.normal==null)return {position:null,normal:null};
  if(!valid3(t.pos)||!valid3(t.normal)||Math.hypot(...t.normal)<.5)throw new Error(`Invalid anchor for ${t.name||t.id}`);
  const p=new THREE.Vector3(...t.pos),n=new THREE.Vector3(...t.normal).normalize();ray.set(p.clone().addScaledVector(n,.06),n.clone().negate());ray.far=.12;
  const hit=ray.intersectObject(mesh,false).find(h=>h.point.distanceTo(p)<.012);
  if(!hit?.face||!hit.barycoord)throw new Error(`Cannot safely map ${t.name||t.id} to the v47 body; keep the rebuild backup`);
  const vertices=[hit.face.a,hit.face.b,hit.face.c],weights=hit.barycoord.toArray(),position=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let i=0;i<3;i++){position.addScaledVector(new THREE.Vector3().fromBufferAttribute(canonical.attributes.position,vertices[i]),weights[i]);normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(canonical.attributes.normal,vertices[i]),weights[i]);}
  if(normal.length()<.5)throw new Error('Canonical anchor has an invalid normal');return {position:position.multiplyScalar(SCALE).toArray(),normal:normal.normalize().toArray()};
 },dispose(){current.dispose();canonical.dispose();mat.dispose();}};
}
export function exportV47Project({state,images,savedAt=new Date().toISOString()}={}){
 if(!state||!Array.isArray(state.tattoos))throw new Error('A rebuild project is required');
 const source=copy(state),imageMap=images instanceof Map?Object.fromEntries(images):copy(images||{}),assets=[],assetIndex=new Map(),artworks=new Map(),groups=new Map();
 const report={format:'v47 shared-data export',originalRuntimeVerified:false,anchorMapping:'Shared canonical triangle indices and barycentric interpolation; 1.75 to 1.8 model-unit scale.',limitations:[
 'Not a visually identical round trip: v47 has different body fitting and decal rendering. Review placements after import.',
 'Female figure, muscle/weight and detailed body fitting are not mapped; v47 uses standard or male figure.',
 'Cleanup history, original source photos, notes, visual previews, archived flags, body-specific layout shapes, pending sketch patch and other rebuild-only metadata remain in the companion rebuild backup only.',
 'Saved camera views are not converted. The companion rebuild backup preserves them.',
 'v47 may ignore or discard unknown extensions, so keep the separate rebuild backup.'],counts:{tattoos:0,layouts:0,checkpoints:0,assets:0}};
 const image=key=>{const value=imageMap[key];if(typeof value!=='string'||value.length>12000000||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(value))throw new Error(`Missing or unsupported v47 artwork: ${key}`);if(!assetIndex.has(value)){if(assets.length>=2400)throw new Error('Too many v47 image assets');assetIndex.set(value,assets.length);assets.push(value);}return 'ink-atlas-image:'+assetIndex.get(value);};
 function addGroups(s){for(const group of s.groups||[]){const key=id(group.id);if(!groups.has(key))groups.set(key,{id:key,name:name(group.name,'Group')});}if(groups.size>50)throw new Error('v47 supports at most 50 groups');}
 function convert(s,list){
  if(!Array.isArray(list)||list.length>30)throw new Error('v47 supports at most 30 tattoos per canvas or planned list; nothing was truncated');
  addGroups(s);const mapper=createV47AnchorMapper(s),seen=new Set();
  try{return list.map(t=>{
   const key=id(t.id);if(seen.has(key))throw new Error('Duplicate tattoo identity in v47 list');seen.add(key);
   const width=t.width*SCALE;if(!Number.isFinite(width)||width<.025||width>.35)throw new Error(`${t.name||key}: width is outside v47’s .025–.35 model-unit range; nothing was resized`);
   if(!Number.isFinite(t.aspect)||t.aspect<.05||t.aspect>20||!Number.isFinite(t.rot)||!Number.isFinite(t.opacity)||t.opacity<.1||t.opacity>1)throw new Error(`Invalid v47 tattoo transform: ${key}`);
   const artId=id(t.artworkId||key),output=image(t.img),record={id:key,name:name(t.name,'Tattoo'),image:output,aspect:t.aspect,width,rotation:((t.rot*180/Math.PI+180)%360+360)%360-180,opacity:t.opacity,status:t.status==='existing'?'existing':'planned',...mapper.map(t),artworkId:artId,hidden:!!t.hidden,layerLocked:!!t.locked,placementLocked:!!t.locked,flipX:!!t.flip};
   for(const [field,min,max]of [['wrap',0,1],['bend',-1,1],['taper',-.75,.75]])if(t[field]!=null){if(!Number.isFinite(t[field])||t[field]<min||t[field]>max)throw new Error(`Invalid ${field}`);record[field]=t[field];}
   if(t.group){record.groupId=id(t.group);if(!groups.has(t.group))groups.set(t.group,{id:t.group,name:'Group'});}
   const prior=artworks.get(artId);if(prior&&prior.image!==output)throw new Error(`Artwork ${artId} has different historical outputs. Keep the rebuild backup; v47 export needs distinct artwork identities`);
   if(!prior)artworks.set(artId,{...record,id:artId,position:null,normal:null});return record;
  });}finally{mapper.dispose();}
 }
 const tattoos=convert(source,[...source.tattoos,...(source.unplacedTattoos||[])]),usedLayoutIds=new Set((source.layouts||[]).map(r=>r.id));let active='rebuild-current';while(usedLayoutIds.has(active))active+='-copy';
 const layouts=[{id:active,name:'Current canvas',planned:tattoos.filter(t=>t.status==='planned'),order:tattoos.map(t=>t.id)}];
 for(const row of source.layouts||[]){if(!row.state)throw new Error('Saved layout is missing its state');const planned=convert(row.state,[...row.state.tattoos,...(row.state.unplacedTattoos||[])].filter(t=>t.status!=='existing'));layouts.push({id:id(row.id),name:name(row.name,'Layout'),planned,order:[...tattoos.filter(t=>t.status==='existing').map(t=>t.id),...planned.map(t=>t.id)]});}
 if(layouts.length>20)throw new Error('v47 permits 20 layouts including the current canvas; nothing was omitted');
 const versions=[];for(const row of source.checkpoints||[]){if(!row.state)throw new Error('Checkpoint is missing its state');const planned=convert(row.state,[...row.state.tattoos,...(row.state.unplacedTattoos||[])].filter(t=>t.status!=='existing')),date=new Date(row.at);if(!Number.isFinite(date.getTime()))throw new Error('Checkpoint has an invalid date');versions.push({id:id(row.id),name:name(row.name,'Checkpoint'),date:date.toISOString(),layoutId:active,planned,order:[...tattoos.filter(t=>t.status==='existing').map(t=>t.id),...planned.map(t=>t.id)]});}
 if(versions.length>12||artworks.size>120||groups.size>50)throw new Error('v47 metadata limits exceeded; nothing was omitted');
 for(const list of [layouts,versions]){const ids=list.map(r=>r.id);if(new Set(ids).size!==ids.length)throw new Error('Duplicate saved-item identity');for(const row of list)if(row.order.length>30||new Set(row.order).size!==row.order.length)throw new Error('Saved layout ordering exceeds v47 limits or duplicates existing ink');}
 const skin=/^#[0-9a-f]{6}$/i.test(source.skinHex||'')?source.skinHex:SKINS[source.skin]||SKINS[1],height=source.heightCm/2.54;
 if(!Number.isFinite(height)||height<36||height>96)throw new Error('Height is outside v47 bounds');
 const project={version:1,skin,figure:source.figure==='male'?'male':'standard',measurements:{heightInches:height},tattoos,studio:{id:id(source.id||'rebuild-export'),name:name(source.projectName||source.name,'Ink Atlas project'),activeLayout:active,layouts,artworks:[...artworks.values()],groups:[...groups.values()],views:[],versions,boards:{},marks:[]}};
 const portable={format:'ink-atlas-portable',project,assets};if(new TextEncoder().encode(JSON.stringify(portable)).length>256*1024*1024)throw new Error('v47 backup exceeds 256 MiB');
 report.counts={tattoos:tattoos.length,layouts:layouts.length,checkpoints:versions.length,assets:assets.length};
 return {portable,rebuildBackup:{app:'ink-atlas-proto',v:2,savedAt,state:source,images:imageMap},report};
}
