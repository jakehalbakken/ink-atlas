// Foundation only. A hit on a posed triangle identifies the same canonical
// triangle and barycentric coordinates. No inverse bone matrices are required.
// Do not enable posed editing until downstream tangent/orientation logic is tested.
const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
export function posedHitToRest({posedPositions,restPositions,restNormals,index,triangle,point,tolerance=1e-5}){
 if(!Number.isInteger(triangle)||triangle<0||triangle*3+2>=index.length||posedPositions.length!==restPositions.length||restPositions.length!==restNormals.length||!Number.isFinite(tolerance)||tolerance<=0)throw new Error('Invalid posed surface data');
 if(!point||point.length!==3||!Array.from(point).every(Number.isFinite))throw new Error('Invalid posed hit');
 const ids=Array.from(index.slice(triangle*3,triangle*3+3));
 if(ids.some(v=>!Number.isInteger(v)||v<0||v*3+2>=restPositions.length))throw new Error('Invalid triangle vertex');
 const vertices=ids.map(v=>Array.from(posedPositions.slice(v*3,v*3+3)));
 if(!vertices.flat().every(Number.isFinite))throw new Error('Invalid posed vertices');
 const [a,b,c]=vertices,v0=sub(b,a),v1=sub(c,a),v2=sub(point,a),d00=dot(v0,v0),d01=dot(v0,v1),d11=dot(v1,v1),den=d00*d11-d01*d01;
 if(!Number.isFinite(den)||Math.abs(den)<1e-18)throw new Error('Degenerate posed triangle');
 const v=(d11*dot(v2,v0)-d01*dot(v2,v1))/den,w=(d00*dot(v2,v1)-d01*dot(v2,v0))/den,weights=[1-v-w,v,w];
 if(weights.some(x=>!Number.isFinite(x)||x< -tolerance||x>1+tolerance))throw new Error('Hit is outside posed triangle');
 const reconstructed=[0,1,2].map(k=>vertices.reduce((sum,p,i)=>sum+p[k]*weights[i],0));
 if(Math.hypot(...sub(reconstructed,point))>tolerance)throw new Error('Hit is off the posed surface');
 const bounded=weights.map(x=>Math.max(0,Math.min(1,x))),sum=bounded.reduce((a,b)=>a+b,0),barycentric=bounded.map(x=>x/sum);
 const interpolate=arr=>[0,1,2].map(k=>ids.reduce((sum,v,i)=>sum+arr[v*3+k]*barycentric[i],0));
 const pos=interpolate(restPositions),normal=interpolate(restNormals),length=Math.hypot(...normal);
 if(!pos.every(Number.isFinite)||!normal.every(Number.isFinite)||length<1e-10)throw new Error('Invalid canonical surface');
 return {pos,normal:normal.map(x=>x/length),anchor:{triangle,barycentric}};
}
