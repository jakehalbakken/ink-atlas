// Isolated neutral-body tools. Only an explicit Save notes calls the owner.
import {createSkin,updateSkin} from './skin.js';
import {createSurfaceRuler} from './surface-measure.js';
import {buildAdjacency} from './decal.js';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);
function tri(positions,index,t){if(!Number.isInteger(t)||t<0||t*3+2>=index.length)throw new Error('Invalid anchor triangle');return [0,1,2].map(k=>{const v=index[t*3+k];if(!Number.isInteger(v)||v<0||v*3+2>=positions.length)throw new Error('Invalid triangle vertex');return Array.from(positions.slice(v*3,v*3+3));});}
export function makeBodyAnchor(positions,index,triangle,point){
 if(!point||point.length!==3||!Array.from(point).every(Number.isFinite))throw new Error('Invalid body point');
 const [a,b,c]=tri(positions,index,triangle),v0=sub(b,a),v1=sub(c,a),v2=sub(point,a),d00=dot(v0,v0),d01=dot(v0,v1),d11=dot(v1,v1),d20=dot(v2,v0),d21=dot(v2,v1),den=d00*d11-d01*d01;
 if(!Number.isFinite(den)||Math.abs(den)<1e-18)throw new Error('Degenerate anchor triangle');
 const v=(d11*d20-d01*d21)/den,w=(d00*d21-d01*d20)/den,raw=[1-v-w,v,w];
 if(raw.some(x=>!Number.isFinite(x)||x< -1e-5||x>1+1e-5))throw new Error('Point lies outside anchor triangle');
 const barycentric=raw.map(x=>Math.max(0,Math.min(1,x))),sum=barycentric.reduce((a,b)=>a+b,0);return {triangle,barycentric:barycentric.map(x=>x/sum)};
}
export function bodyAnchorPoint(positions,index,anchor){
 const p=tri(positions,index,anchor?.triangle),b=anchor?.barycentric;
 if(!b||b.length!==3||!Array.from(b).every(x=>Number.isFinite(x)&&x>=-1e-6&&x<=1+1e-6)||Math.abs(b.reduce((a,x)=>a+x,0)-1)>1e-5)throw new Error('Invalid barycentric anchor');
 const point=[0,1,2].map(k=>p.reduce((sum,v,i)=>sum+v[k]*b[i],0));if(!point.every(Number.isFinite))throw new Error('Invalid body geometry');return point;
}
export function bodyChord(a,b,heightCm=175){if(!Number.isFinite(heightCm)||heightCm<=0)throw new Error('Invalid body height');for(const v of [a,b])if(!v||v.length!==3||!Array.from(v).every(Number.isFinite))throw new Error('Invalid measure point');const cm=Math.hypot(...sub(a,b))*heightCm/1.75;return {cm,inches:cm/2.54};}
export function bodyDrawingPoint(positions,normals,index,anchor,offset=.001){
 const p=bodyAnchorPoint(positions,index,anchor),n=bodyAnchorPoint(normals,index,anchor),len=Math.hypot(...n);if(!Number.isFinite(offset)||len<1e-8)throw new Error('Invalid drawing normal');return p.map((v,i)=>v+n[i]/len*offset);
}
export function drawingSegmentSafe(positions,index,adjacency,a,b){
 const pa=bodyAnchorPoint(positions,index,a),pb=bodyAnchorPoint(positions,index,b);if(Math.hypot(...sub(pa,pb))>.035)return false;
 if(a.triangle===b.triangle)return true;
 const seen=new Set([a.triangle]),queue=[[a.triangle,0]];
 for(let q=0;q<queue.length&&q<256;q++){const [t,depth]=queue[q];if(depth>=12)continue;for(let e=0;e<3;e++){const next=adjacency[t*3+e];if(next<0||seen.has(next))continue;if(next===b.triangle)return true;const c=bodyAnchorPoint(positions,index,{triangle:next,barycentric:[1/3,1/3,1/3]});if(Math.hypot(...sub(pa,c))>.055)continue;seen.add(next);queue.push([next,depth+1]);}}return false;
}
export function openBodyTools({THREE,state,bodyGeometry,bodyMaterial,decals=[],onSaveNotes,onSaveState}){
 return new Promise((resolve,reject)=>{
 let host,renderer,observer,raf=0,closed=false,busy=false;const listeners=[],geometries=[],materials=[],drawingResources=new Set(),prior=document.activeElement;
 const listen=(el,type,fn,options)=>{el.addEventListener(type,fn,options);listeners.push(()=>el.removeEventListener(type,fn,options));};
 const close=(saved=false,error)=>{if(closed||busy)return;closed=true;cancelAnimationFrame(raf);observer?.disconnect();listeners.forEach(f=>f());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());drawingResources.forEach(r=>r.dispose());renderer?.dispose();renderer?.forceContextLoss();host?.remove();prior?.focus?.();error?reject(error):resolve({saved});};
 try{
 const originalNotes=Array.isArray(state.notes)?structuredClone(state.notes):typeof state.notes==='string'&&state.notes?[state.notes]:[];
 const originalDrawings=Array.isArray(state.drawings)?structuredClone(state.drawings):[];
 let notes=structuredClone(originalNotes),drawings=structuredClone(originalDrawings),selected=-1,mode='orbit',measure=[],measureAnchors=[],surfaceRuler=null,activeStroke=null,drawingsVisible=true,clearDrawPending=false;
 const drawColor='#e9bf6c',drawWidth=.002;
 const heightCm=Number.isFinite(state.heightCm)&&state.heightCm>0?state.heightCm:175;
 const geo=bodyGeometry.clone();geometries.push(geo);geo.computeVertexNormals();geo.computeBoundingBox();
 const skin=createSkin(geo,bodyMaterial.color.clone());materials.push(skin.mat);const fem=state.figure==='female'?1:state.figure==='male'?0:.5;updateSkin(geo,skin.uniforms,(.0155+.006*fem)*(1+.35*(state.fit?.nippleSize||0)),state);
 const positions=geo.attributes.position.array,index=geo.index?.array;if(!index)throw new Error('Body tools require indexed geometry');const adjacency=buildAdjacency(index),normals=geo.attributes.normal.array;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#20232c');const body=new THREE.Mesh(geo,skin.mat);scene.add(body);
 for(const d of decals){const g=d.geometry.clone();geometries.push(g);const clone=m=>{const out=m.clone();materials.push(out);return out;};scene.add(new THREE.Mesh(g,Array.isArray(d.material)?d.material.map(clone):clone(d.material)));}
 const markerGeo=new THREE.SphereGeometry(.009,12,8),markerMat=new THREE.MeshBasicMaterial({color:0xf1c874}),selectedMat=new THREE.MeshBasicMaterial({color:0xffffff});geometries.push(markerGeo);materials.push(markerMat,selectedMat);
 const markers=new THREE.Group();scene.add(markers);const lineGeo=new THREE.BufferGeometry(),lineMat=new THREE.LineBasicMaterial({color:0x9be7e4,depthTest:false,transparent:true,opacity:.9});geometries.push(lineGeo);materials.push(lineMat);const line=new THREE.Line(lineGeo,lineMat);line.visible=false;line.renderOrder=1000;scene.add(line);const measureMarks=new THREE.Group();scene.add(measureMarks);const measureMat=new THREE.MeshBasicMaterial({color:0x9be7e4,depthTest:false});materials.push(measureMat);
 const drawingGroup=new THREE.Group();scene.add(drawingGroup);
 const camera=new THREE.PerspectiveCamera(38,1,.02,40),target=new THREE.Vector3(0,.875,0);let yaw=0,pitch=.03,distance=3.1;
 scene.add(new THREE.HemisphereLight(0xffffff,0x4a4652,1.6));const light=new THREE.DirectionalLight(0xfff4ea,2.4);light.position.set(-2,3,4);scene.add(light);
 host=document.createElement('section');host.id='ink-body-tools';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Body pins and measurements');
 host.innerHTML=`<style>
 #ink-body-tools{position:absolute;inset:0;z-index:9600;display:flex;flex-direction:column;background:#20232c;color:#f5f3ed;font:14px system-ui;box-sizing:border-box;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}#ink-body-tools *{box-sizing:border-box}#ink-body-tools header,#ink-body-tools nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 12px}#ink-body-tools h2{font-size:17px;margin:0 auto 0 0}#ink-body-tools button{min-height:44px;min-width:44px;padding:8px 12px;border:1px solid #606675;border-radius:8px;background:#303440;color:inherit;font:inherit;touch-action:manipulation}#ink-body-tools button[aria-pressed=true]{background:#e8cf9e;color:#222}#ink-body-tools button:disabled{opacity:.45}#ink-body-tools button:focus-visible,#ink-body-tools textarea:focus-visible{outline:3px solid #a6c9ff}#ink-body-tools .bt-main{display:flex;flex:1;min-height:0}#ink-body-tools .bt-stage{flex:1;min-width:0;min-height:120px;touch-action:none;position:relative;overflow:hidden}#ink-body-tools canvas{display:block;width:100%;height:100%;touch-action:none}#ink-body-tools aside{width:285px;padding:12px;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;background:#292d37}#ink-body-tools textarea{width:100%;min-height:100px;padding:10px;border:1px solid #777;border-radius:8px;background:#faf8f3;color:#222;font:16px system-ui;touch-action:auto;resize:vertical}#ink-body-tools .bt-list button{display:block;width:100%;text-align:left;margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}#ink-body-tools p{font-size:12px;color:#d0d1d7;margin:6px 0}#ink-body-tools .bt-status{padding:7px 12px;min-height:32px;background:#171920}#ink-body-tools .bt-edit-actions{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}@media(max-width:650px){#ink-body-tools .bt-main{flex-direction:column}#ink-body-tools aside{width:100%;max-height:36%;min-height:120px}#ink-body-tools textarea{min-height:65px}#ink-body-tools .bt-list{display:flex;gap:6px;overflow-x:auto}#ink-body-tools .bt-list button{min-width:150px;max-width:240px}#ink-body-tools h2{font-size:15px}}@media(max-height:500px){#ink-body-tools header,#ink-body-tools nav{padding:4px 8px}#ink-body-tools aside{width:240px}#ink-body-tools .bt-main{flex-direction:row}#ink-body-tools aside{max-height:none}}
 </style><header><h2>Body pins, drawing & measurements</h2><button data-save>Save notes & drawing</button><button data-close>Cancel / close</button></header><nav><button data-mode="orbit" aria-pressed="true">Orbit</button><button data-mode="pin" aria-pressed="false">Pin note</button><button data-mode="drawing" aria-pressed="false">Draw</button><button data-mode="measure" aria-pressed="false">Measure</button><button data-reset>Reset view</button><button data-clear>Clear measurement</button></nav><div class="bt-main"><div class="bt-stage"></div><aside><strong>Body pins</strong><div class="bt-edit-actions"><button data-drawing-visible aria-pressed="true">Hide drawings</button><button data-clear-drawings>Clear drawings</button></div><p class="bt-drawing-count"></p><p>Tap the body in Pin note mode, then write a note. Whole-plan and piece notes are kept unchanged.</p><label for="bt-text">Selected pin note</label><textarea id="bt-text" maxlength="240" placeholder="Tap the body to place a pin" disabled></textarea><div class="bt-edit-actions"><button data-delete disabled>Delete selected pin</button></div><div class="bt-list"></div><p class="bt-measure">Measure: select two points.</p><p>Shows chord and approximate mesh-edge surface route. The route can overestimate; neither replaces a real tape measurement. Neutral body only. Drag to orbit, pinch to zoom.</p></aside></div><div class="bt-status" aria-live="polite">Marks stay local until Save notes & drawing.</div>`;
 (document.getElementById('viewport')||document.body).append(host);const $=s=>host.querySelector(s),stage=$('.bt-stage'),text=$('#bt-text'),status=$('.bt-status');
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;stage.append(renderer.domElement);
 const draw=()=>{if(closed)return;camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);renderer.render(scene,camera);};
 const redraw=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);};
 const reset=()=>{yaw=0;pitch=.03;geo.boundingBox.getCenter(target);const size=new THREE.Vector3();geo.boundingBox.getSize(size);const vf=camera.fov*Math.PI/360,hf=Math.atan(Math.tan(vf)*camera.aspect);distance=Math.max(size.y/(2*Math.tan(vf)),size.x/(2*Math.tan(hf)))*1.18+size.z*.5;redraw();};
 const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();reset();};
 function renderDrawings(){
 drawingGroup.clear();drawingResources.forEach(r=>r.dispose());drawingResources.clear();let invalid=0;
 for(const mark of drawings){try{if(!Array.isArray(mark?.anchors)||mark.anchors.length<2){invalid++;continue;}const points=mark.anchors.map(a=>new THREE.Vector3(...bodyDrawingPoint(positions,normals,index,a)));
 const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(points[i-1],points[i]));
 const width=Number.isFinite(mark.width)&&mark.width>0?Math.min(.012,Math.max(.0005,mark.width)):.002;
 const g=new THREE.TubeGeometry(path,Math.max(2,points.length*2),width/2,5,false),m=new THREE.MeshBasicMaterial({color:/^#[0-9a-f]{6}$/i.test(mark.color)?mark.color:drawColor});drawingResources.add(g);drawingResources.add(m);drawingGroup.add(new THREE.Mesh(g,m));
 }catch{invalid++;}}
 drawingGroup.visible=drawingsVisible;$('.bt-drawing-count').textContent=`${drawings.length} / 180 drawing marks${invalid?` · ${invalid} legacy mark(s) unavailable on this mesh; retained`:''}. Single-finger/Pencil drag draws; two fingers zoom. Switch to Orbit to turn the body.`;redraw();
 }
 function finishStroke(){activeStroke=null;}
 function renderPins(){markers.clear();const list=$('.bt-list');list.replaceChildren();let invalid=0;
  notes.forEach((note,i)=>{if(!note?.anchor)return;let p;try{p=bodyAnchorPoint(positions,index,note.anchor);}catch{invalid++;return;}const marker=new THREE.Mesh(markerGeo,i===selected?selectedMat:markerMat);marker.position.fromArray(p);markers.add(marker);const button=document.createElement('button');button.type='button';button.textContent=note.text||'New pin';button.setAttribute('aria-pressed',String(i===selected));button.addEventListener('click',()=>{selected=i;text.value=notes[i].text||'';text.maxLength=Math.max(240,text.value.length);text.disabled=false;$('[data-delete]').disabled=false;renderPins();});list.append(button);});
  if(invalid){const p=document.createElement('p');p.textContent=`${invalid} saved pin(s) cannot be shown on this mesh. They are retained unchanged.`;list.append(p);}redraw();
 }
 function setMode(m){finishStroke();clearDrawPending=false;$('[data-clear-drawings]').textContent='Clear drawings';mode=m;host.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));status.textContent=m==='drawing'?'Drag on the body to draw. Lift and start again across gaps.':m==='pin'?'Tap the body to add a note pin.':m==='measure'?'Tap two body points to compare chord and approximate surface route.':'Drag to orbit. Pinch to zoom.';}
 listen(text,'input',()=>{if(selected>=0){notes[selected]={...notes[selected],text:text.value};renderPins();}});
 listen($('[data-delete]'),'click',()=>{if(selected<0)return;notes.splice(selected,1);selected=-1;text.value='';text.disabled=true;$('[data-delete]').disabled=true;renderPins();status.textContent='Pin removed locally. Save notes to keep this change.';});
 for(const button of host.querySelectorAll('[data-mode]'))listen(button,'click',()=>setMode(button.dataset.mode));
 const clearMeasure=()=>{measure=[];measureAnchors=[];measureMarks.clear();line.visible=false;lineGeo.setAttribute('position',new THREE.Float32BufferAttribute([],3));$('.bt-measure').textContent='Measure: select two points.';redraw();};
 listen($('[data-clear]'),'click',clearMeasure);listen($('[data-reset]'),'click',reset);listen($('[data-close]'),'click',()=>close());
 listen($('[data-drawing-visible]'),'click',()=>{drawingsVisible=!drawingsVisible;drawingGroup.visible=drawingsVisible;$('[data-drawing-visible]').textContent=drawingsVisible?'Hide drawings':'Show drawings';$('[data-drawing-visible]').setAttribute('aria-pressed',String(drawingsVisible));redraw();});
 listen($('[data-clear-drawings]'),'click',()=>{finishStroke();if(!clearDrawPending){clearDrawPending=true;$('[data-clear-drawings]').textContent='Confirm clear drawings';status.textContent='Tap again to clear drawings locally. Notes are not removed; Cancel still restores everything.';return;}drawings=[];clearDrawPending=false;$('[data-clear-drawings]').textContent='Clear drawings';renderDrawings();status.textContent='Drawings cleared locally. Save to keep this change, or Cancel to discard.';});
 listen($('[data-save]'),'click',async()=>{
  finishStroke();
  if(busy)return;if(notes.some(n=>n?.anchor&&!String(n.text||'').trim()&&!originalNotes.some(old=>JSON.stringify(old)===JSON.stringify(n)))){status.textContent='Write text for each new pin, or delete the empty pin, before saving.';return;}
  if(notes.some(n=>n?.anchor&&String(n.text||'').length>240&&!originalNotes.some(old=>old?.id===n.id&&String(old.text||'').length>=String(n.text||'').length))){status.textContent='New pin notes are limited to 240 characters. Existing longer notes are retained.';return;}
  if(typeof onSaveState!=='function'&&(typeof onSaveNotes!=='function'||JSON.stringify(drawings)!==JSON.stringify(originalDrawings))){status.textContent='Saving drawings is unavailable. Your original project is unchanged.';return;}
  busy=true;host.querySelectorAll('button,textarea').forEach(b=>b.disabled=true);status.textContent='Saving notes…';
  try{if(typeof onSaveState==='function')await onSaveState({notes:structuredClone(notes),drawings:structuredClone(drawings)});else await onSaveNotes(structuredClone(notes));busy=false;close(true);}catch(e){busy=false;host.querySelectorAll('button').forEach(b=>b.disabled=false);text.disabled=selected<0;$('[data-delete]').disabled=selected<0;status.textContent='Could not save notes: '+e.message;}
 });
 const ray=new THREE.Raycaster();
 const hitAnchor=(x,y)=>{draw();const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObject(body,false)[0];return hit?makeBodyAnchor(positions,index,hit.faceIndex,hit.point.toArray()):null;};
 const drawPoint=(x,y,begin=false)=>{if(mode!=='drawing'||busy)return;if(begin&&drawings.length>=180){status.textContent='This project already has 180 drawing marks. Clear drawings before adding more.';return;}
 try{const a=hitAnchor(x,y);if(!a){finishStroke();status.textContent='Stroke stopped at the body edge. Lift and start a new stroke.';return;}
 if(begin){activeStroke={id:'drawing-'+crypto.randomUUID(),color:drawColor,width:drawWidth,anchors:[a]};return;}
 if(!activeStroke)return;const previous=activeStroke.anchors.at(-1),pa=bodyAnchorPoint(positions,index,previous),pb=bodyAnchorPoint(positions,index,a);
 if(Math.hypot(...sub(pa,pb))<.0008)return;
 if(!drawingSegmentSafe(positions,index,adjacency,previous,a)){finishStroke();status.textContent='Stroke stopped across a surface gap. Lift and start again.';return;}
 if(activeStroke.anchors.length>=220){finishStroke();status.textContent='Stroke reached 220 points. Lift to begin another mark.';return;}
 activeStroke.anchors.push(a);if(activeStroke.anchors.length===2)drawings.push(activeStroke);renderDrawings();
 }catch(e){finishStroke();status.textContent=e.message;}};
 const tap=(x,y)=>{if(mode==='drawing')return;if(mode==='orbit'||busy)return;draw();const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObject(body,false)[0];if(!hit){status.textContent='Tap directly on the body.';return;}
  try{const anchor=makeBodyAnchor(positions,index,hit.faceIndex,hit.point.toArray());if(mode==='pin'){
   if(notes.filter(n=>n?.anchor).length>=180){status.textContent='This project already has 180 body pins. Remove a pin before adding another.';return;}
   notes.push({id:'pin-'+crypto.randomUUID(),text:'',anchor});selected=notes.length-1;text.value='';text.maxLength=240;text.disabled=false;$('[data-delete]').disabled=false;renderPins();status.textContent='Pin placed. Write its note, then Save notes.';text.focus();
  }else{if(measure.length===2){measure=[];measureAnchors=[];}measureAnchors.push(anchor);measure.push(bodyAnchorPoint(positions,index,anchor));measureMarks.clear();for(const point of measure){const mark=new THREE.Mesh(markerGeo,measureMat);mark.position.fromArray(point);mark.renderOrder=1001;measureMarks.add(mark);}lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(measure.flat(),3));lineGeo.computeBoundingSphere();line.visible=measure.length===2;if(measure.length===2){const d=bodyChord(measure[0],measure[1],heightCm);$('.bt-measure').textContent=`Straight-line distance: ${d.cm.toFixed(1)} cm / ${d.inches.toFixed(2)} in (body height ${heightCm} cm).`;try{surfaceRuler ||= createSurfaceRuler(positions,index);const surface=surfaceRuler(measureAnchors[0],measureAnchors[1],heightCm);lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(surface.points.flat(),3));lineGeo.computeBoundingSphere();$('.bt-measure').textContent+=` Approximate mesh-edge surface route: ${surface.cm.toFixed(1)} cm / ${surface.inches.toFixed(2)} in.`;status.textContent='Cyan line follows mesh edges; approximate and may overestimate. Verify with a real tape.';}catch(e){status.textContent=`Surface route unavailable: ${e.message}. Chord shown only.`;}}else $('.bt-measure').textContent='First point set. Tap the second point.';redraw();}
  }catch(e){status.textContent=e.message;}
 };
 const pointers=new Map();let last=null,start=null,moved=false,multi=false;
 const metric=()=>{const p=[...pointers.values()];return p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,gap:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}:p[0];};
 listen(stage,'pointerdown',e=>{if(busy)return;e.preventDefault();stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){start={x:e.clientX,y:e.clientY};moved=false;multi=false;}else multi=true;last=metric();if(mode==='drawing'){if(pointers.size===1)drawPoint(e.clientX,e.clientY,true);else finishStroke();}});
 listen(stage,'pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=metric();if(mode==='drawing'&&pointers.size===1&&!multi){drawPoint(e.clientX,e.clientY);last=next;return;}if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)moved=true;if(last){if(next.gap&&last.gap)distance=Math.max(.5,Math.min(8,distance*last.gap/Math.max(1,next.gap)));else if(pointers.size===1&&moved&&mode!=='drawing'){yaw-=(next.x-last.x)*.008;pitch=Math.max(-1.2,Math.min(1.2,pitch+(next.y-last.y)*.006));}}last=next;redraw();});
 listen(stage,'pointerup',e=>{if(mode==='drawing'){drawPoint(e.clientX,e.clientY);finishStroke();}const shouldTap=pointers.has(e.pointerId)&&!moved&&!multi;pointers.delete(e.pointerId);last=metric()||null;if(shouldTap)tap(e.clientX,e.clientY);});for(const event of ['pointercancel','lostpointercapture'])listen(stage,event,e=>{finishStroke();pointers.delete(e.pointerId);last=metric()||null;});
 listen(stage,'wheel',e=>{e.preventDefault();distance=Math.max(.5,Math.min(8,distance*Math.exp(e.deltaY*.001)));redraw();},{passive:false});
 listen(host,'keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const nodes=[...host.querySelectorAll('button:not(:disabled),textarea:not(:disabled)')];if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}});
 host.__bodyToolsTest=()=>({notes:structuredClone(notes),drawings:structuredClone(drawings),drawingsVisible,mode,measure:structuredClone(measure),heightCm});observer=new ResizeObserver(resize);observer.observe(stage);renderPins();renderDrawings();resize();$('[data-close]').focus();
 }catch(e){close(false,e);}
 });
}
