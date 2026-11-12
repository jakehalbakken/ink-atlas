// Pure document conversion. Never merges with a currently open project.
import * as THREE from 'three';
import {legacyPositions,shapePositions,INDEX} from './mesh.js';
import {fitFromV47} from './fit.js';
const K=1.75/1.8,copy=x=>JSON.parse(JSON.stringify(x));
const imageOK=s=>typeof s==='string'&&s.length<=12000000&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(s);
const id=s=>{if(typeof s!=='string'||!s.trim()||s.length>120)throw Error('Invalid v47 identity');return s;};
const vec=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<10);
function list(a,max,label){if(a==null)return [];if(!Array.isArray(a)||a.length>max)throw Error(`Invalid v47 ${label} count`);const ids=new Set();for(const r of a){if(!r||typeof r!=='object'||ids.has(id(r.id)))throw Error(`Duplicate v47 ${label} identity`);ids.add(r.id);}return a;}
function geo(p){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setIndex(new THREE.BufferAttribute(INDEX.slice(),1));g.computeVertexNormals();g.computeBoundingSphere();return g;}
export function importV47Project({project,assets=[]}={}){
 if(!project||project.version!==1||!Array.isArray(project.tattoos))throw Error('Not a v47 project');
 if(!Array.isArray(assets)||assets.length>2400||!assets.every(imageOK))throw Error('Invalid v47 image assets');
 const raw=copy(project),rawAssets=assets.slice();if(new TextEncoder().encode(JSON.stringify({project:raw,assets:rawAssets})).length>256*1024*1024)throw Error('v47 source exceeds 256 MiB');
 // Validate all stored references, including source-only boards, masks and portraits.
 const resolve=s=>{if(typeof s!=='string'||!s.startsWith('ink-atlas-image:'))return s;if(!/^ink-atlas-image:(0|[1-9][0-9]*)$/.test(s))throw Error('Invalid v47 image reference');const n=Number(s.slice(16));if(!Number.isSafeInteger(n)||n>=rawAssets.length)throw Error('Missing v47 image asset');return rawAssets[n];};
 const scan=(v,depth=0)=>{if(depth>64)throw Error('v47 document nesting is too deep');if(typeof v==='string'){resolve(v);if(v.startsWith('data:image')&&!imageOK(v))throw Error('Unsupported v47 image');}else if(v&&typeof v==='object')Object.values(v).forEach(x=>scan(x,depth+1));};scan(raw);
 if(!/^#[0-9a-f]{6}$/i.test(raw.skin||''))throw Error('Invalid v47 skin color');if(raw.figure!=null&&!['male','standard'].includes(raw.figure))throw Error('Invalid v47 figure');
 const height=raw.measurements?.heightInches??180/2.54;if(!Number.isFinite(height)||height<36||height>96)throw Error('Invalid v47 height');
 const studio=raw.studio||{},tattoosRaw=list(raw.tattoos,30,'tattoos'),layoutsRaw=list(studio.layouts,20,'layouts'),versionsRaw=list(studio.versions,12,'versions'),groupsRaw=list(studio.groups,50,'groups'),libraryRaw=list(studio.artworks,120,'artworks');list(studio.views,24,'views');list(studio.marks,180,'marks');
 if(studio.activeLayout!=null&&!layoutsRaw.some(r=>r.id===studio.activeLayout))throw Error('v47 active layout is missing');
 for(const rows of [layoutsRaw,versionsRaw,groupsRaw,libraryRaw])for(const row of rows)if(typeof row.name!=='string'||!row.name.trim()||row.name.length>120)throw Error('Invalid v47 saved-item name');
 if(studio.name!=null&&(typeof studio.name!=='string'||!studio.name.trim()||studio.name.length>120))throw Error('Invalid v47 project name');
 if(studio.boards!=null){if(typeof studio.boards!=='object'||Array.isArray(studio.boards)||Object.keys(studio.boards).length>120)throw Error('Invalid v47 boards');for(const board of Object.values(studio.boards)){if(!board||typeof board.notes!=='string'||board.notes.length>3000||!Array.isArray(board.images)||board.images.length>8||board.images.some(s=>!imageOK(resolve(s))||resolve(s).length>2500000))throw Error('Invalid v47 board');}}
 for(const mark of studio.marks||[]){if(!Array.isArray(mark.points)||mark.points.length>220||mark.points.some(p=>!p||!vec(p.position)||!vec(p.normal))||mark.text!=null&&(typeof mark.text!=='string'||mark.text.length>240))throw Error('Invalid v47 mark');}

 const base={app:'ink-atlas-proto',v:2,id:studio.id?id(studio.id):'v47-import',name:typeof studio.name==='string'?studio.name.slice(0,120):'Imported Ink Atlas project',figure:raw.figure==='male'?'male':'neutral',heightCm:Math.max(150,Math.min(205,Math.round(height*2.54))),skin:1,skinHex:raw.skin,muscle:.5,weight:.5,fit:fitFromV47(studio.bodyFit),genitals:true,tattoos:[],unplacedTattoos:[],artworks:{},groups:groupsRaw.map(g=>({id:g.id,name:typeof g.name==='string'?g.name:'Group'})),notes:[],layouts:[],checkpoints:[],views:[]};
 const images={},keys=new Map(),artworks=base.artworks;let serial=0;
 function image(s){const value=resolve(s);if(!imageOK(value))throw Error('Missing or invalid tattoo image');if(!keys.has(value)){const key='v47-image-'+serial++;keys.set(value,key);images[key]=value;}return keys.get(value);}
 // Archive every provided asset, including currently unreferenced library content.
 rawAssets.forEach(image);
 const canonical=geo(legacyPositions()),target=geo(shapePositions(base)),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(canonical,material),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);
 const report={sourceArchived:true,limitations:['Source project and assets are retained verbatim under v47Source.','Body fitting is approximate; face fitting and portrait texture are source-only.','Boards, notes/marks, camera views and original cleanup metadata are archived, not represented as editable rebuild equivalents.','Layouts/checkpoints share the converted current body. Review all placements after import.'],counts:{tattoos:0,layouts:0,checkpoints:0,images:0}};
 if(base.heightCm!==Math.round(height*2.54))report.limitations.push('Height exceeds rebuild bounds and is clamped to 150–205 cm; original measurement remains archived.');
 function register(t){const artId=id(t.artworkId||t.id),output=image(t.image),source=t.cleanup?.originalPhoto?image(t.cleanup.originalPhoto):t.cleanup?.source?image(t.cleanup.source):output;const previous=artworks[artId];if(previous&&previous.output!==output)throw Error(`Conflicting outputs for linked artwork ${artId}`);if(!previous)artworks[artId]={id:artId,source,output,...(t.cleanup?{v47Cleanup:copy(t.cleanup)}:{})};return {artId,output};}
 function convert(t){
  id(t.id);if(typeof t.name!=='string'||t.name.length>120)throw Error('Invalid v47 tattoo name');
  const unplaced=t.position===null&&t.normal===null;
  if(!unplaced&&(!vec(t.position)||!vec(t.normal)||Math.hypot(...t.normal)<.5))throw Error(`Invalid tattoo anchor ${t.name||t.id}`);
  for(const [key,min,max]of [['width',.025,.35],['aspect',.05,20],['rotation',-180,180],['opacity',.1,1]])if(!Number.isFinite(t[key])||t[key]<min||t[key]>max)throw Error(`Invalid v47 ${key}`);
  if(!['planned','existing'].includes(t.status))throw Error('Invalid v47 tattoo status');
  const {artId,output}=register(t);let position=null,outNormal=null;
  if(!unplaced){const p=new THREE.Vector3(...t.position).multiplyScalar(K),n=new THREE.Vector3(...t.normal).normalize();ray.set(p.clone().addScaledVector(n,.05),n.clone().negate());ray.far=.12;const hit=ray.intersectObject(mesh,false).find(h=>h.point.distanceTo(p)<.012);if(!hit?.face||!hit.barycoord)throw Error(`Cannot safely map v47 tattoo ${t.name||t.id}`);
   const pos=new THREE.Vector3(),normal=new THREE.Vector3(),weights=hit.barycoord.toArray();[hit.face.a,hit.face.b,hit.face.c].forEach((v,i)=>{pos.addScaledVector(new THREE.Vector3().fromBufferAttribute(target.attributes.position,v),weights[i]);normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(target.attributes.normal,v),weights[i]);});normal.normalize();position=pos.toArray();outNormal=normal.toArray();}
  const out={id:t.id,name:t.name,img:output,artworkId:artId,aspect:t.aspect,width:t.width*K,rot:t.rotation*Math.PI/180,opacity:t.opacity,status:t.status,pos:position,normal:outNormal,flip:!!t.flipX,hidden:!!t.hidden,locked:!!t.layerLocked||(typeof t.placementLocked==='boolean'?t.placementLocked:t.status==='existing')};
  if(t.groupId){out.group=id(t.groupId);if(!base.groups.some(g=>g.id===out.group))throw Error('Tattoo references a missing group');}
  for(const [key,min,max]of [['wrap',0,1],['bend',-1,1],['taper',-.75,.75]])if(t[key]!=null){if(!Number.isFinite(t[key])||t[key]<min||t[key]>max)throw Error(`Invalid v47 ${key}`);out[key]=t[key];}return out;
 }
 try{
  // Artwork-library records are allowed to be unplaced; canvas entries are not.
  for(const t of libraryRaw)register(t);
  const active=tattoosRaw.map(convert);base.tattoos=active.filter(t=>t.pos!==null);base.unplacedTattoos=active.filter(t=>t.pos===null);const existing=active.filter(t=>t.status==='existing');
  const snapshot=(row)=>{const plannedRaw=list(row.planned,30,'planned tattoos');if(plannedRaw.some(t=>t.status!=='planned'))throw Error('Non-planned ink in v47 layout');const planned=plannedRaw.map(convert),all=[...copy(existing),...planned],ids=new Set(all.map(t=>t.id));if(ids.size!==all.length||all.length>30)throw Error('Layout duplicates existing ink or exceeds 30 entries');let ordered=all;if(row.order!=null){if(!Array.isArray(row.order)||row.order.length>30||new Set(row.order).size!==row.order.length||row.order.some(x=>!ids.has(x)))throw Error('Invalid v47 layout order');const byId=new Map(all.map(t=>[t.id,t]));ordered=[...row.order.map(x=>byId.get(x)),...all.filter(t=>!row.order.includes(t.id))];}return {...base,tattoos:ordered.filter(t=>t.pos!==null),unplacedTattoos:ordered.filter(t=>t.pos===null),artworks:null,layouts:undefined,checkpoints:undefined,views:undefined};};
  const layouts=layoutsRaw.map(row=>({id:row.id,name:row.name||'Layout',at:0,archived:false,state:snapshot(row)}));
  const checkpoints=versionsRaw.map(row=>{const at=Date.parse(row.date);if(!Number.isFinite(at)||!layoutsRaw.some(l=>l.id===row.layoutId))throw Error('Invalid v47 checkpoint date or layout');return {id:row.id,name:row.name||'Checkpoint',at,archived:false,state:snapshot(row)};});
  for(const row of [...layouts,...checkpoints]){row.state.artworks=copy(artworks);row.state.groups=copy(base.groups);row.state=copy(row.state);}
  base.layouts=layouts;base.checkpoints=checkpoints;base.v47Source={project:raw,assets:rawAssets};report.unplaced=base.unplacedTattoos.length;report.limitations.push('Unplaced artwork is preserved separately and must be placed deliberately; no location is invented.');report.counts={tattoos:base.tattoos.length,unplaced:base.unplacedTattoos.length,layouts:layouts.length,checkpoints:checkpoints.length,images:Object.keys(images).length};return {state:base,images,report};
 }finally{canonical.dispose();target.dispose();material.dispose();}
}
