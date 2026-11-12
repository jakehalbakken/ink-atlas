// Local GLB handoff only. Separate tattoo meshes, NOT UV-baked skin or a rig.
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
export function whiteToAlphaPixels(data){
 const out=new Uint8ClampedArray(data);if(out.length%4)throw new Error('Invalid RGBA image');
 for(let i=0;i<out.length;i+=4){const min=Math.min(out[i],out[i+1],out[i+2]),ink=255-min,alpha=out[i+3];for(let c=0;c<3;c++)out[i+c]=ink?Math.round((out[i+c]-min)*255/ink):0;out[i+3]=Math.round(ink*alpha/255);}return out;
}
export async function exportSceneGlb({THREE,bodyGeometry,bodyMaterial,decals=[],state={}}){
 const height=state.heightCm??175;if(!Number.isFinite(height)||height<50||height>300)throw new Error('A valid body height is required for meter-scale export');
 const owned=[],own=o=>(owned.push(o),o),limitations=[
 'Static current neutral body only; no skeleton, animation, controls or editable project data.',
 'Tattoo artwork is embedded on separate surface meshes, not baked into body UVs.',
 'Procedural eyes, lips, skin landmarks and cavity shading are approximated by a plain skin material.',
 'Multiplicative ink is converted to normal alpha blending. Colored ink can look different on skin; transparency sorting and surface offsets vary by viewer.'
 ];
 try{
 const scene=new THREE.Scene(),group=new THREE.Group();group.name='Ink Atlas neutral model';group.scale.setScalar(height/175);scene.add(group);
 const geometry=g=>{if(!g?.getAttribute('position'))throw new Error('Missing mesh positions');const c=own(g.clone());c.userData={};c.name='';for(const key of Object.keys(c.attributes))if(!['position','normal','uv','uv1'].includes(key))c.deleteAttribute(key);for(const attr of Object.values(c.attributes))for(const v of attr.array)if(!Number.isFinite(v))throw new Error('Non-finite geometry cannot be exported');if(!c.getAttribute('normal'))c.computeVertexNormals();return c;};
 const skinSource=Array.isArray(bodyMaterial)?bodyMaterial[0]:bodyMaterial;if(!skinSource?.color)throw new Error('Missing body material');
 const skin=own(new THREE.MeshStandardMaterial({color:skinSource.color.clone(),roughness:Number.isFinite(skinSource.roughness)?skinSource.roughness:.8,metalness:0,side:skinSource.side??THREE.FrontSide}));skin.name='Approximate skin';
 const body=new THREE.Mesh(geometry(bodyGeometry),skin);body.name='Body';group.add(body);
 let textureCount=0,convertedCount=0;
 const converted=new Map();
 const copyTexture=source=>{
  if(converted.has(source))return converted.get(source);
  const image=source?.image,w=image?.naturalWidth||image?.videoWidth||image?.width,h=image?.naturalHeight||image?.videoHeight||image?.height;
  if(!w||!h||w*h>24e6)throw new Error('Tattoo texture must be available and no larger than 24 megapixels');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);const pixels=context.getImageData(0,0,w,h);pixels.data.set(whiteToAlphaPixels(pixels.data));context.putImageData(pixels,0,0);
  const tex=own(source.clone());tex.image=canvas;tex.userData={};tex.name='Tattoo alpha texture';tex.needsUpdate=true;converted.set(source,tex);textureCount++;convertedCount++;return tex;
 };
 let decalCount=0;
 for(const entry of decals){
  if(entry.visible===false)continue;
  const source=entry.material;if(Array.isArray(source))throw new Error('Multi-material tattoo meshes need explicit export preparation');
  if(!source)throw new Error('Missing tattoo material');
  // Ink previews use MultiplyBlending and already contain tattoo opacity in their
  // white-backed bitmap. Keep material opacity too, without applying it twice.
  let map=null;if(source.map){if(source.blending===THREE.MultiplyBlending)map=copyTexture(source.map);else{map=own(source.map.clone());map.userData={};map.name='Tattoo texture';textureCount++;}}
  const mat=own(new THREE.MeshBasicMaterial({color:source.color?.clone()||new THREE.Color(0xffffff),map,transparent:true,opacity:source.opacity??1,side:source.side??THREE.FrontSide,depthWrite:false}));mat.name=`Tattoo ${decalCount+1}`;
  const mesh=new THREE.Mesh(geometry(entry.geometry),mat);mesh.name=`Tattoo ${++decalCount}`;group.add(mesh);
 }
 const modelVersion=typeof state.modelVersion==='string'||Number.isFinite(state.modelVersion)?state.modelVersion:'ink-atlas-neutral-v1';
 const name=typeof state.projectName==='string'?state.projectName.slice(0,160):'Ink Atlas model';
 const manifest={format:'glb',units:'meters',projectName:name,modelVersion,heightCm:height,bodyMeshes:1,tattooMeshes:decalCount,textureCount,convertedMultiplyTextures:convertedCount,approximate:true,uvBaked:false,includesReferencePhotos:false,includesNotes:false,limitations};
 // Only this explicit whitelist enters extras. Input object names/userData,
 // references, notes, source image URLs and other project fields are not copied.
 scene.userData={inkAtlas:structuredClone(manifest)};
 const binary=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true,trs:false,maxTextureSize:4096});
 if(!(binary instanceof ArrayBuffer))throw new Error('GLB exporter did not return binary data');
 return {blob:new Blob([binary],{type:'model/gltf-binary'}),manifest};
 }finally{for(const object of owned)object.dispose();}
}
