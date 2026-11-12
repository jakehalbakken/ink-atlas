// Offline static OBJ/MTL archive. Separate decals, never UV-baked skin or a rig.
import {whiteToAlphaPixels} from './three-export.js';
const LIMIT=128*1024*1024;
const encoder=new TextEncoder();
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
export function zipStored(files){
 if(!Array.isArray(files)||!files.length||files.length>128)throw new Error('Invalid archive file count');let size=0,offset=0;const locals=[],central=[],names=new Set();
 for(const {name,data}of files){if(typeof name!=='string'||! /^[a-zA-Z0-9_.-]+$/.test(name)||names.has(name)||!(data instanceof Uint8Array))throw new Error('Unsafe archive entry');names.add(name);size+=data.length;if(size>LIMIT)throw new Error('Archive exceeds 128 MiB');const n=encoder.encode(name),crc=crc32(data),head=new Uint8Array(30+n.length),v=new DataView(head.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);head.set(n,30);locals.push(head,data);
 const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);c.set(n,46);central.push(c);offset+=head.length+data.length;}
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,central.reduce((n,c)=>n+c.length,0),true);v.setUint32(16,offset,true);return new Blob([...locals,...central,end],{type:'application/zip'});
}
export async function exportSceneObj({THREE,bodyGeometry,bodyMaterial,decals=[],state={}}){
 const height=state.heightCm??175;if(!Number.isFinite(height)||height<50||height>300)throw new Error('Invalid body height');if(!Array.isArray(decals)||decals.length>100)throw new Error('Too many tattoo meshes');
 const skin=Array.isArray(bodyMaterial)?bodyMaterial[0]:bodyMaterial;if(!skin?.color)throw new Error('Missing body material');
 const files=[],obj=['# Ink Atlas static model; units meters','mtllib materials.mtl'],mtl=[],textures=new Map();let vertexOffset=1,triangles=0,vertices=0,texturePixels=0,textBytes=0;
 const number=n=>{if(!Number.isFinite(n))throw new Error('Non-finite mesh data');return String(Math.round(n*1e8)/1e8);};
 const texture=async(map,multiply,bounds)=>{const key=JSON.stringify([multiply,bounds]);let cache=textures.get(map);if(cache?.has(key))return cache.get(key);const image=map.image,w=image?.naturalWidth||image?.width,h=image?.naturalHeight||image?.height;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>4096||h>4096)throw new Error('Texture unavailable or oversized');
 const left=Math.floor(bounds[0]*w),right=Math.ceil(bounds[1]*w),bottom=Math.floor(bounds[2]*h),top=Math.ceil(bounds[3]*h),pw=right-left,ph=top-bottom;
 if(pw<1||ph<1||pw>4096||ph>4096||(texturePixels+=pw*ph)>32e6)throw new Error('Padded texture budget exceeded');
 const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);let pixels=ctx.getImageData(0,0,w,h).data;if(multiply)pixels=whiteToAlphaPixels(pixels);
 // Pixel-exact edge extension. UVs receive one affine remap, never per-vertex clamping.
 const padded=new Uint8ClampedArray(pw*ph*4);for(let y=0;y<ph;y++){const sy=Math.max(0,Math.min(h-1,y+h-top));for(let x=0;x<pw;x++){const sx=Math.max(0,Math.min(w-1,x+left)),src=(sy*w+sx)*4,dst=(y*pw+x)*4;padded[dst]=pixels[src];padded[dst+1]=pixels[src+1];padded[dst+2]=pixels[src+2];padded[dst+3]=pixels[src+3];}}
 c.width=pw;c.height=ph;ctx.putImageData(new ImageData(padded,pw,ph),0,0);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');const name=`tattoo-${files.length+1}.png`;files.push({name,data:new Uint8Array(await blob.arrayBuffer())});const result={name,bounds:[left/w,right/w,bottom/h,top/h]};if(!cache){cache=new Map();textures.set(map,cache);}cache.set(key,result);return result;};
 const mesh=async(g,mat,name)=>{
 if(!g?.getAttribute('position')||!mat||Array.isArray(mat))throw new Error('Missing geometry or unsupported material');const p=g.getAttribute('position'),uv=g.getAttribute('uv'),idx=g.index,n=g.getAttribute('normal');if(p.itemSize!==3||uv&&uv.count!==p.count||n&&n.count!==p.count)throw new Error('Invalid attribute lengths');vertices+=p.count;const count=idx?idx.count:p.count;if(count%3||vertices>750000||(triangles+=count/3)>500000)throw new Error('Geometry budget exceeded or non-triangle mesh');if(g.drawRange?.start||Number.isFinite(g.drawRange?.count)&&g.drawRange.count<count)throw new Error('Partial draw ranges need explicit preparation');
 let owned=null,normal=n;if(!normal){owned=g.clone();owned.computeVertexNormals();normal=owned.getAttribute('normal');}let tx=null;try{
 const map=mat.map;if(map&&!uv)throw new Error('Textured mesh missing UVs');if(map){if(map.wrapS!==THREE.ClampToEdgeWrapping||map.wrapT!==THREE.ClampToEdgeWrapping)throw new Error('Repeating textures need explicit export preparation');tx=map.clone();if(tx.matrixAutoUpdate)tx.updateMatrix();}
 const coords=[],bounds=[0,1,0,1];for(let i=0;i<p.count;i++){let u=uv?uv.getX(i):0,v=uv?uv.getY(i):0;if(tx){const pt=new THREE.Vector2(u,v).applyMatrix3(tx.matrix);u=pt.x;v=tx.flipY?pt.y:1-pt.y;}if(!Number.isFinite(u)||!Number.isFinite(v))throw new Error('Invalid UV coordinates');coords.push([u,v]);bounds[0]=Math.min(bounds[0],u);bounds[1]=Math.max(bounds[1],u);bounds[2]=Math.min(bounds[2],v);bounds[3]=Math.max(bounds[3],v);}let padded=null;
 const color=mat.color||new THREE.Color(0xffffff),opacity=mat.opacity??1;if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw new Error('Invalid material opacity');mtl.push(`newmtl ${name}`,`Kd ${number(color.r)} ${number(color.g)} ${number(color.b)}`,`d ${number(opacity)}`,'illum 1');if(map){padded=await texture(map,mat.blending===THREE.MultiplyBlending,bounds);mtl.push(`map_Kd ${padded.name}`);}mtl.push('');obj.push(`o ${name}`,`usemtl ${name}`);
 for(let i=0;i<p.count;i++)obj.push(`v ${number(p.getX(i)*height/175)} ${number(p.getY(i)*height/175)} ${number(p.getZ(i)*height/175)}`);
 for(let i=0;i<p.count;i++){let [u,v]=coords[i];if(padded){const [l,r,b,t]=padded.bounds;u=(u-l)/(r-l);v=(v-b)/(t-b);}obj.push(`vt ${number(u)} ${number(v)}`);}
 for(let i=0;i<p.count;i++)obj.push(`vn ${number(normal.getX(i))} ${number(normal.getY(i))} ${number(normal.getZ(i))}`);
 for(let i=0;i<count;i+=3){const face=[];for(let j=0;j<3;j++){const k=idx?idx.getX(i+j):i+j;if(!Number.isInteger(k)||k<0||k>=p.count)throw new Error('Invalid geometry index');const a=k+vertexOffset;face.push(`${a}/${a}/${a}`);}obj.push('f '+face.join(' '));}vertexOffset+=p.count;
 }finally{owned?.dispose();tx?.dispose();}
 };
 await mesh(bodyGeometry,{color:skin.color,opacity:1},'body');let tattooMeshes=0;for(const d of decals){if(d.visible===false)continue;await mesh(d.geometry,d.material,`tattoo_${++tattooMeshes}`);}
 const manifest={format:'obj-mtl-zip',units:'meters',heightCm:height,bodyMeshes:1,tattooMeshes,textureCount:files.length,triangles,uvBaked:false,includesNotes:false,includesSourceArtwork:false,limitations:['Static separate body and decal surfaces, not a rig or UV-baked skin.','Procedural skin landmarks are approximated by a plain material.','PNG alpha is included in map_Kd; some OBJ viewers ignore it. Configure alpha blending manually if needed.','Multiply ink is converted to normal alpha; color and surface depth sorting may differ by viewer.','Mesh coordinates assume the current neutral preview geometry, with no scene transforms.']};
 for(const [name,value]of [['model.obj',obj.join('\n')+'\n'],['materials.mtl',mtl.join('\n')],['README.txt','Ink Atlas static OBJ package\nExtract all files together. Coordinates are meters.\n'+manifest.limitations.join('\n')],['manifest.json',JSON.stringify(manifest,null,2)]]){const data=encoder.encode(value);textBytes+=data.length;if(textBytes>LIMIT)throw new Error('Model text exceeds archive budget');files.push({name,data});}
 return{blob:zipStored(files),manifest};
}
// Public integration name; accepts the same current neutral preview input as GLB.
export const exportSceneObjPackage=exportSceneObj;
