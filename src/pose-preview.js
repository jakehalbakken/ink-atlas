// Read-only modal. All geometry/materials are owned clones; texture assets are
// borrowed without mutation/disposal. No project persistence or scene integration.
import {createRestRig,skinPose,axisAngle} from './pose.js';
import {createSkin,updateSkin} from './skin.js';
export const PREVIEW_PRESETS=Object.freeze({
 neutral:{label:'Neutral',rotations:{}},
 elbow:{label:'Elbow bend',rotations:{'lowerarm01.L':axisAngle([1,0,0],-.55)}},
 raised:{label:'Arm raised',rotations:{'upperarm01.L':axisAngle([0,0,1],.48),'lowerarm01.L':axisAngle([1,0,0],-.22)}},
 twist:{label:'Gentle twist',rotations:{spine03:axisAngle([0,1,0],.15),spine02:axisAngle([0,1,0],.12)}}
});
/** Fixed vertex support preserves original UVs, with refreshed surface normals. */
export function supportedDecalPositions(positions,normals,supports,offset=.0004){
 if(!supports||positions.length!==normals.length||positions.length%3||!Number.isFinite(offset))throw new Error('Invalid decal support data');
 const out=new Float32Array(supports.length*3);
 for(let i=0;i<supports.length;i++){
  const v=supports[i];if(!Number.isInteger(v)||v<0||v>=positions.length/3)throw new Error('Decal support outside body');
  for(let a=0;a<3;a++){const x=positions[v*3+a]+offset*normals[v*3+a];if(!Number.isFinite(x))throw new Error('Invalid posed surface');out[i*3+a]=x;}
 }return out;
}
export const MOTION_STUDIES=Object.freeze({elbow:'Elbow bend',reach:'Arm reach',turn:'Gentle torso turn'});
export function motionStudyRotations(kind,phase){
 if(!Object.hasOwn(MOTION_STUDIES,kind)||!Number.isFinite(phase))throw new Error('Invalid motion study');
 const amount=(1-Math.cos(((phase%1)+1)%1*Math.PI*2))/2;
 if(kind==='elbow')return {'lowerarm01.L':axisAngle([1,0,0],-.55*amount)};
 if(kind==='reach')return {'upperarm01.L':axisAngle([0,0,1],.48*amount),'lowerarm01.L':axisAngle([1,0,0],-.22*amount)};
 return {spine03:axisAngle([0,1,0],.15*amount),spine02:axisAngle([0,1,0],.12*amount)};
}
export function openPosePreview({THREE,state,bodyGeometry,bodyMaterial,decals=[]}){
 return new Promise((resolve,reject)=>{
 let renderer,observer,root,closed=false,frame=0,motionTimer=0,motionRunning=false,motionFrames=0,motionKind='elbow',motionSpeed=1,motionPhase=0,showingMotionFrame=false;const ownedGeo=[],ownedMat=[],listeners=[];
 const previous=document.activeElement;
 const listen=(el,type,fn,opts)=>{el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts));};
 const close=(error)=>{if(closed)return;closed=true;motionRunning=false;clearTimeout(motionTimer);cancelAnimationFrame(frame);observer?.disconnect();listeners.forEach(f=>f());ownedGeo.forEach(g=>g.dispose());ownedMat.forEach(m=>m.dispose());renderer?.dispose();renderer?.forceContextLoss();root?.remove();previous?.focus?.();error?reject(error):resolve();};
 try{
 const rest=createRestRig(state),original=bodyGeometry.getAttribute('position');
 if(!original||original.count*3!==rest.positions.length)throw new Error('Preview requires the current body mesh');
 for(let i=0;i<rest.positions.length;i++)if(Math.abs(original.array[i]-rest.positions[i])>1e-6)throw new Error('Body shape changed. Close and reopen pose preview.');
 const cloneMat=mat=>{if(Array.isArray(mat))return mat.map(cloneMat);const m=mat.clone();ownedMat.push(m);return m;};
 const body=bodyGeometry.clone();ownedGeo.push(body);
 const {mat:previewSkin,uniforms:skinUniforms}=createSkin(body,bodyMaterial.color.clone());ownedMat.push(previewSkin);
 const fem=state.figure==='female'?1:state.figure==='male'?0:.5;
 const areola=(.0155+.006*fem)*(1+.35*((state.fit&&state.fit.nippleSize)||0));
 const originalPositions=new Float32Array(original.array);
 const ink=decals.map(d=>{
  const supports=d.geometry.userData.supports;
  if(!supports||supports.length!==d.geometry.getAttribute('position')?.count)throw new Error('Tattoo surface mapping is not ready for pose preview');
  supportedDecalPositions(rest.positions,body.getAttribute('normal').array,supports);
  const geometry=d.geometry.clone();ownedGeo.push(geometry);
  return {geometry,material:cloneMat(d.material),supports:new Uint32Array(supports),uvBefore:d.geometry.getAttribute('uv')?.array.slice(),sourceGeometry:d.geometry,sourcePositions:d.geometry.getAttribute('position').array.slice()};
 });
 root=document.createElement('div');root.className='pose-preview';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Pose preview');
 root.innerHTML=`<style>
 .pose-preview{position:absolute;inset:0;z-index:9500;background:#171920;color:#f4f3f1;display:flex;flex-direction:column;font:14px system-ui;min-height:0;box-sizing:border-box;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
 .pose-preview *{box-sizing:border-box}.pose-preview header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid #444}.pose-preview h2{font-size:17px;margin:0}.pose-preview p{margin:4px 0;color:#c5c5ce;font-size:12px}.pose-preview button,.pose-preview select{min-height:44px;min-width:44px;padding:9px 14px;background:#303440;color:inherit;border:1px solid #555b69;border-radius:9px;font:inherit;cursor:pointer;touch-action:manipulation}.pose-preview button[aria-pressed=true]{background:#e8cf9e;color:#222;border-color:#e8cf9e}.pose-preview button:focus-visible{outline:3px solid #a6c9ff;outline-offset:2px}.pose-preview .pose-motion-panel{padding:0 14px 6px}.pose-preview .pose-motion-panel summary{min-height:44px;padding:12px 0;cursor:pointer}.pose-preview .pose-motion-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.pose-preview .pose-motion-controls input{min-height:44px;min-width:140px;touch-action:pan-y}.pose-preview .pose-stage{flex:1;min-height:90px;position:relative;overflow:hidden;touch-action:none}.pose-preview canvas{width:100%;height:100%;display:block;touch-action:none}.pose-preview .pose-toolbar{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;border-top:1px solid #444}.pose-preview .pose-note{padding:0 14px 8px;margin:0;font-size:12px}.pose-preview .pose-status{position:absolute;left:12px;bottom:8px;pointer-events:none;font-size:12px;color:#e6e6ec;background:#171920a0;padding:5px 8px;border-radius:6px}.pose-preview .pose-tools{display:flex;gap:8px;margin-left:auto}@media(max-height:480px){.pose-preview p,.pose-preview .pose-note{display:none}.pose-preview header,.pose-preview .pose-toolbar{padding:5px 10px}}
 </style><header><div><h2>Pose preview</h2><p>Preview only · Close to edit. Your project is unchanged.</p></div><button data-close>Close</button></header><div class="pose-stage"><div class="pose-status" aria-live="polite">Neutral · Drag to orbit · Pinch to zoom</div></div><div class="pose-toolbar"><div class="pose-tools"><button data-motion aria-pressed="false">Play elbow cycle</button><button data-reset>Reset view</button><button data-full>Full body</button></div></div><details class="pose-motion-panel"><summary>Motion controls</summary><div class="pose-motion-controls"><label>Study <select data-motion-kind><option value="elbow">Elbow bend</option><option value="reach">Arm reach</option><option value="turn">Gentle torso turn</option></select></label><label>Speed <select data-motion-speed><option value="0.5">½ speed</option><option value="1" selected>Normal</option><option value="1.5">1½ speed</option></select></label><label>Inspect cycle <input data-motion-phase type="range" min="0" max="100" step="1" value="0" aria-label="Motion cycle position"><output data-phase-value>0%</output></label><button data-motion-return>Return to static pose</button></div></details><p class="pose-note">Restrained pose studies, not an anatomical simulation. Lighting is simplified.</p>`;
 (document.getElementById('viewport')||document.body).append(root);
 const stage=root.querySelector('.pose-stage'),status=root.querySelector('.pose-status'),toolbar=root.querySelector('.pose-toolbar');
 const scene=new THREE.Scene();scene.background=new THREE.Color('#20232c');
 const camera=new THREE.PerspectiveCamera(38,1,.02,40);
 scene.add(new THREE.HemisphereLight(0xffffff,0x4a4652,1.6));
 const light=new THREE.DirectionalLight(0xfff4ea,2.4);light.position.set(-2,3,4);scene.add(light);
 const rim=new THREE.DirectionalLight(0xb9c4ff,1.2);rim.position.set(2,2,-3);scene.add(rim);
 scene.add(new THREE.Mesh(body,previewSkin));ink.forEach(d=>scene.add(new THREE.Mesh(d.geometry,d.material)));
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.setAttribute('aria-label','Read-only posed body. Use drag to orbit and pinch to zoom.');stage.prepend(renderer.domElement);
 let yaw=0,pitch=.03,distance=3.1,selection='neutral';const target=new THREE.Vector3(0,.875,0);
 const draw=()=>{if(closed)return;camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);renderer.render(scene,camera);};
 const requestDraw=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);};
 const full=()=>{body.computeBoundingBox();const box=body.boundingBox;box.getCenter(target);const size=new THREE.Vector3();box.getSize(size);const vf=camera.fov*Math.PI/360,hf=Math.atan(Math.tan(vf)*camera.aspect);distance=Math.max(size.y/(2*Math.tan(vf)),size.x/(2*Math.tan(hf))) * 1.18+size.z*.5;distance=Math.max(1.2,distance);requestDraw();};
 const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();full();};
 const applyPose=(rotations)=>{const posed=skinPose(rest,rotations).positions;
 body.getAttribute('position').array.set(posed);body.getAttribute('position').needsUpdate=true;body.computeVertexNormals();body.computeBoundingSphere();body.computeBoundingBox();updateSkin(body,skinUniforms,areola);
 for(const d of ink){d.geometry.getAttribute('position').array.set(supportedDecalPositions(posed,body.getAttribute('normal').array,d.supports));d.geometry.getAttribute('position').needsUpdate=true;d.geometry.computeVertexNormals();d.geometry.computeBoundingSphere();}
 requestDraw();};
 const select=(key)=>{showingMotionFrame=false;const preset=PREVIEW_PRESETS[key];applyPose(preset.rotations);selection=key;toolbar.querySelectorAll('[data-pose]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pose===key)));status.textContent=`${preset.label} · Drag to orbit · Pinch to zoom`;requestDraw();};
 for(const [key,preset]of Object.entries(PREVIEW_PRESETS)){const button=document.createElement('button');button.dataset.pose=key;button.textContent=preset.label;button.setAttribute('aria-pressed',String(key==='neutral'));toolbar.insertBefore(button,toolbar.querySelector('.pose-tools'));listen(button,'click',()=>{try{stopMotion(false);select(key);}catch(e){status.textContent=e.message;}});}
 const motionButton=root.querySelector('[data-motion]'),phaseInput=root.querySelector('[data-motion-phase]');
 const syncPhase=()=>{phaseInput.value=Math.round(motionPhase*100);root.querySelector('[data-phase-value]').textContent=Math.round(motionPhase*100)+'%';};
 const showMotionFrame=()=>{applyPose(motionStudyRotations(motionKind,motionPhase));showingMotionFrame=true;syncPhase();};
 function stopMotion(restore=true){motionRunning=false;clearTimeout(motionTimer);motionButton.textContent='Play cycle';motionButton.setAttribute('aria-pressed','false');if(restore&&!closed){motionPhase=0;syncPhase();select(selection);}}
 function startMotion(){if(closed||document.hidden)return;motionRunning=true;motionButton.textContent='Pause cycle';motionButton.setAttribute('aria-pressed','true');status.textContent=MOTION_STUDIES[motionKind]+' preview · Pause returns to the chosen static pose';let last=performance.now();
 const tick=()=>{if(closed||!motionRunning)return;if(document.hidden){stopMotion();return;}try{const now=performance.now();motionPhase=(motionPhase+(now-last)/4000*motionSpeed)%1;last=now;showMotionFrame();motionFrames++;}catch(e){stopMotion();status.textContent='Motion stopped: '+e.message;return;}
 // Schedule after work completes: never more than 20 skin updates/second.
 motionTimer=setTimeout(tick,50);};tick();}
 listen(motionButton,'click',()=>motionRunning?stopMotion():startMotion());listen(document,'visibilitychange',()=>{if(document.hidden)stopMotion();});
 listen(root.querySelector('[data-motion-kind]'),'change',e=>{const resume=motionRunning;stopMotion(false);motionKind=e.target.value;motionPhase=0;showMotionFrame();status.textContent=MOTION_STUDIES[motionKind]+' · Drag the cycle slider to inspect';if(resume)startMotion();});
 listen(root.querySelector('[data-motion-speed]'),'change',e=>{motionSpeed=Number(e.target.value);});
 listen(phaseInput,'input',()=>{stopMotion(false);motionPhase=Number(phaseInput.value)/100;showMotionFrame();status.textContent=MOTION_STUDIES[motionKind]+' · Inspection frame '+Math.round(motionPhase*100)+'% · Not saved to project';});
 listen(root.querySelector('[data-motion-return]'),'click',()=>stopMotion());
 listen(root.querySelector('[data-close]'),'click',()=>close());listen(root.querySelector('[data-reset]'),'click',()=>{yaw=0;pitch=.03;full();});listen(root.querySelector('[data-full]'),'click',full);
 const points=new Map();let last=null;
 const metric=()=>{const p=[...points.values()];return p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,gap:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}:p[0];};
 listen(stage,'pointerdown',e=>{e.preventDefault();stage.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});last=metric();});
 listen(stage,'pointermove',e=>{if(!points.has(e.pointerId))return;e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=metric();if(last){if(next.gap&&last.gap)distance=Math.max(.5,Math.min(8,distance*last.gap/Math.max(1,next.gap)));else if(points.size===1){yaw-=(next.x-last.x)*.008;pitch=Math.max(-1.2,Math.min(1.2,pitch+(next.y-last.y)*.006));}}last=next;requestDraw();});
 const end=e=>{points.delete(e.pointerId);last=metric()||null;};for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(stage,type,end);
 listen(stage,'wheel',e=>{e.preventDefault();distance=Math.max(.5,Math.min(8,distance*Math.exp(e.deltaY*.001)));requestDraw();},{passive:false});
 listen(root,'keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const b=[...root.querySelectorAll('button,select,input,summary')].filter(el=>el.getClientRects().length),first=b[0],last=b.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 root.__poseTest=()=>{
 let maxSupportError=0,uvUnchanged=true,inputsUnchanged=original.array.every((x,i)=>x===originalPositions[i]);
 for(const d of ink){const expected=supportedDecalPositions(body.attributes.position.array,body.attributes.normal.array,d.supports),actual=d.geometry.attributes.position.array;for(let i=0;i<actual.length;i++)maxSupportError=Math.max(maxSupportError,Math.abs(actual[i]-expected[i]));const uv=d.geometry.getAttribute('uv')?.array;if(d.uvBefore)uvUnchanged=uvUnchanged&&!!uv&&uv.every((x,i)=>x===d.uvBefore[i]);inputsUnchanged=inputsUnchanged&&d.sourceGeometry.attributes.position.array.every((x,i)=>x===d.sourcePositions[i]);}
 return {preset:selection,motionRunning,motionFrames,motionKind,motionSpeed,motionPhase,showingMotionFrame,decals:ink.length,maxSupportError,uvUnchanged,inputsUnchanged,neutralExact:!motionRunning&&!showingMotionFrame&&selection==='neutral'?body.attributes.position.array.every((x,i)=>x===rest.positions[i]):null};
 };
 observer=new ResizeObserver(resize);observer.observe(stage);select(selection);resize();root.querySelector('[data-close]').focus();
 }catch(e){close(e);}
 });
}
