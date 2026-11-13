// Rasterize only existing ink supported by this exact patch, never the far side.
export function makePatchReference(patchGeometry, entries, margin, size=768, asCanvas=false){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');
 const supports=patchGeometry.userData.supports,uv=patchGeometry.attributes.uv.array,coords=new Map();
 for(let i=0;i<supports.length;i++)coords.set(supports[i],[(uv[i*2]-margin)/(1-2*margin)*size,(uv[i*2+1]-margin)/(1-2*margin)*size]);
 let drawn=0;
 for(const {geometry,texture} of entries){
  const src=texture.image;if(!src)continue;const ink=document.createElement('canvas');ink.width=src.width;ink.height=src.height;const g=ink.getContext('2d');g.drawImage(src,0,0);const data=g.getImageData(0,0,ink.width,ink.height);
  // The preview texture represents multiplicative ink on white. Remove white for
  // a transparent reference layer; keep the source texture itself untouched.
  for(let k=0;k<data.data.length;k+=4){const min=Math.min(data.data[k],data.data[k+1],data.data[k+2]),a=255-min;for(let j=0;j<3;j++)data.data[k+j]=a?Math.round((data.data[k+j]-min)*255/a):0;data.data[k+3]=a;}
  g.putImageData(data,0,0);const ids=geometry.userData.supports,U=geometry.attributes.uv.array;if(!ids)continue;
  for(let i=0;i<ids.length;i+=3){const dest=[coords.get(ids[i]),coords.get(ids[i+1]),coords.get(ids[i+2])];if(dest.some(x=>!x))continue;
   const source=[0,1,2].map(k=>[U[(i+k)*2]*ink.width,(texture.flipY?1-U[(i+k)*2+1]:U[(i+k)*2+1])*ink.height]);
   const [s0,s1,s2]=source,[d0,d1,d2]=dest,sx1=s1[0]-s0[0],sy1=s1[1]-s0[1],sx2=s2[0]-s0[0],sy2=s2[1]-s0[1],det=sx1*sy2-sx2*sy1;if(Math.abs(det)<1e-8)continue;
   const dx1=d1[0]-d0[0],dy1=d1[1]-d0[1],dx2=d2[0]-d0[0],dy2=d2[1]-d0[1],a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,c=(dx2*sx1-dx1*sx2)/det,d=(dy2*sx1-dy1*sx2)/det;
   ctx.save();ctx.beginPath();ctx.moveTo(...d0);ctx.lineTo(...d1);ctx.lineTo(...d2);ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,d0[0]-a*s0[0]-c*s0[1],d0[1]-b*s0[0]-d*s0[1]);ctx.drawImage(ink,0,0);ctx.restore();drawn++;
  }
 }
 return drawn?(asCanvas?canvas:canvas.toDataURL("image/png")):null;
}
