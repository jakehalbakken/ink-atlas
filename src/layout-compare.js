// Read-only, synchronized neutral-body wipe. Caller retains ownership of inputs.
import {createSkin,updateSkin} from './skin.js';
const stable=x=>JSON.stringify(x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(stable(x[k]))])):x??null);
export function compareBodyIdentity(s={}){
 return stable({v:s.v??2,modelVersion:s.modelVersion??null,figure:s.figure??'male',muscle:s.muscle??.6,weight:s.weight??.5,heightCm:s.heightCm??175,fit:s.fit??{},genitals:s.genitals??true,skin:s.skin??1,skinHex:s.skinHex??null});
}
export function assertComparableBodies(a,b){
 if(compareBodyIdentity(a)!==compareBodyIdentity(b))throw new Error('Live comparison currently requires the same body shape, fit, skin and height. Use Compare pictures for different bodies.');
 return true;
}
export function openLayoutCompare({THREE,a,b}){
 assertComparableBodies(a.state,b.state);
 return new Promise((resolve,reject)=>{
 let host,renderer,observer,frame,closed=false;const geos=[],mats=[],listeners=[];const prior=document.activeElement;
 const listen=(el,type,fn,opts)=>{el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts));};
 const close=error=>{if(closed)return;closed=true;cancelAnimationFrame(frame);observer?.disconnect();listeners.forEach(f=>f());geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());renderer?.dispose();renderer?.forceContextLoss();host?.remove();prior?.focus?.();error?reject(error):resolve();};
 try{
  const pa=a.bodyGeometry.attributes.position.array,pb=b.bodyGeometry.attributes.position.array;
  if(pa.length!==pb.length||pa.some((v,i)=>!Number.isFinite(v)||!Number.isFinite(pb[i])||Math.abs(v-pb[i])>1e-6))throw new Error('Live comparison requires identical neutral body geometry.');
  const material=m=>{if(Array.isArray(m))return m.map(material);const c=m.clone();mats.push(c);return c;};
  const scenes=[a,b].map(bundle=>{
   const scene=new THREE.Scene();scene.background=new THREE.Color('#20232c');const geometry=bundle.bodyGeometry.clone();geos.push(geometry);
   const {mat,uniforms}=createSkin(geometry,bundle.bodyMaterial.color.clone());mats.push(mat);const fem=bundle.state.figure==='female'?1:bundle.state.figure==='male'?0:.5;updateSkin(geometry,uniforms,(.0155+.006*fem)*(1+.35*(bundle.state.fit?.nippleSize||0)),bundle.state);scene.add(new THREE.Mesh(geometry,mat));
   for(const d of bundle.decals||[]){const g=d.geometry.clone();geos.push(g);const mesh=new THREE.Mesh(g,material(d.material));mesh.renderOrder=d.renderOrder||0;scene.add(mesh);}
   scene.add(new THREE.HemisphereLight(0xffffff,0x4a4652,1.6));const light=new THREE.DirectionalLight(0xfff4ea,2.4);light.position.set(-2,3,4);scene.add(light);const rim=new THREE.DirectionalLight(0xb9c4ff,1.2);rim.position.set(2,2,-3);scene.add(rim);return scene;
  });
  host=document.createElement('div');host.className='layout-compare';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Live layout comparison');
  host.innerHTML=`<style>.layout-compare{position:absolute;inset:0;z-index:10010;display:flex;flex-direction:column;background:#20232c;color:#fff;font:14px system-ui}.layout-compare header,.layout-compare footer{padding:10px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}.layout-compare button,.layout-compare input{min-height:44px;min-width:44px}.layout-compare button{color:inherit;background:#343845;border:1px solid #666;border-radius:9px;padding:8px 14px}.layout-compare h2{font-size:17px;margin:0}.layout-compare p{margin:3px 0;font-size:12px}.layout-compare [data-stage]{flex:1;position:relative;min-height:120px;touch-action:none;overflow:hidden}.layout-compare canvas{display:block;width:100%;height:100%;touch-action:none}.layout-compare [data-line]{position:absolute;top:0;bottom:0;width:2px;background:#fff9;pointer-events:none}.layout-compare [data-labels]{position:absolute;top:10px;left:12px;right:12px;display:flex;justify-content:space-between;gap:20px;pointer-events:none}.layout-compare [data-labels] span{padding:5px 8px;background:#111b;max-width:45%;overflow-wrap:anywhere}.layout-compare label{display:flex;align-items:center;gap:10px;flex:1}.layout-compare input{flex:1;min-width:100px}</style><header><div><h2>Live layout comparison</h2><p>Neutral shared body · One synchronized camera · Drag to orbit, pinch to zoom · No project changes</p></div><button data-close style="margin-left:auto">Close</button></header><div data-stage><div data-line></div><div data-labels><span></span><span></span></div></div><footer><label>Wipe <input data-wipe type="range" min="0" max="100" value="50" aria-label="Layout comparison wipe"></label><button data-reset>Reset view</button></footer>`;
  (document.querySelector('#viewport')||document.body).append(host);const stage=host.querySelector('[data-stage]');host.querySelectorAll('[data-labels] span').forEach((el,i)=>el.textContent=[a,b][i].name||`Layout ${i+1}`);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;stage.prepend(renderer.domElement);const camera=new THREE.PerspectiveCamera(38,1,.02,40),target=new THREE.Vector3();geos[0].computeBoundingBox();geos[0].boundingBox.getCenter(target);const size=new THREE.Vector3();geos[0].boundingBox.getSize(size);
  let yaw=0,pitch=.03,distance=3,wipe=.5,draws=0;
  const draw=()=>{if(closed)return;const w=stage.clientWidth,h=stage.clientHeight;camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);renderer.setViewport(0,0,w,h);renderer.setScissorTest(true);const cut=Math.round(w*wipe);renderer.setScissor(0,0,cut,h);renderer.render(scenes[0],camera);renderer.setScissor(cut,0,w-cut,h);renderer.render(scenes[1],camera);renderer.setScissorTest(false);host.querySelector('[data-line]').style.left=`${wipe*100}%`;draws++;};
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);};
  const reset=()=>{yaw=0;pitch=.03;distance=Math.max(size.y/(2*Math.tan(camera.fov*Math.PI/360)),size.x/(2*Math.tan(camera.fov*Math.PI/360)*camera.aspect))*1.18+size.z*.5;schedule();};
  const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();reset();};observer=new ResizeObserver(resize);observer.observe(stage);resize();
  listen(host.querySelector('[data-close]'),'click',()=>close());listen(host.querySelector('[data-reset]'),'click',reset);listen(host.querySelector('[data-wipe]'),'input',e=>{wipe=Number(e.target.value)/100;schedule();});
  const pointers=new Map();let last=null;const metrics=()=>{const p=[...pointers.values()];return p.length>=2?{span:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)}:p[0];};
  listen(stage,'pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});stage.setPointerCapture(e.pointerId);last=metrics();});listen(stage,'pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const m=metrics();if(pointers.size===1&&last?.x!=null){yaw-=(m.x-last.x)*.007;pitch=Math.max(-1.2,Math.min(1.2,pitch+(m.y-last.y)*.007));}else if(m?.span>12&&last?.span>12)distance=Math.max(.4,Math.min(8,distance*last.span/m.span));last=m;schedule();});for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(stage,event,e=>{pointers.delete(e.pointerId);last=metrics();});listen(stage,'wheel',e=>{e.preventDefault();distance=Math.max(.4,Math.min(8,distance*Math.exp(e.deltaY*.001)));schedule();},{passive:false});
  listen(host,'keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const els=[...host.querySelectorAll('button,input')];if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus();}}});
  host.__compareTest=()=>({yaw,pitch,distance,wipe,draws,synchronized:true,cameraCount:1,closed,ownedGeometries:geos.length,ownedMaterials:mats.length});host.querySelector('[data-close]').focus();
 }catch(e){close(e);}
 });
}
