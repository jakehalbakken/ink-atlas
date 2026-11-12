// Approximate mesh-edge route, not a clinical/tape measurement or exact geodesic.
export function createSurfaceRuler(positions,index){
 if(positions.length%3||index.length%3||positions.length>900000||!Array.from(positions).every(Number.isFinite))throw new Error('Invalid measurement mesh');
 const n=positions.length/3,edges=Array.from({length:n},()=>new Map());
 const point=i=>Array.from(positions.slice(i*3,i*3+3)),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){const a=index[i+k],b=index[i+(k+1)%3];if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=n||b>=n)throw new Error('Invalid measurement index');const w=distance(point(a),point(b));edges[a].set(b,w);edges[b].set(a,w);}
 function anchor(a){if(!Number.isInteger(a?.triangle)||a.triangle<0||a.triangle*3+2>=index.length||a.barycentric?.length!==3||!a.barycentric.every(x=>Number.isFinite(x)&&x>=0&&x<=1)||Math.abs(a.barycentric.reduce((s,x)=>s+x,0)-1)>1e-5)throw new Error('Invalid measurement anchor');const ids=Array.from(index.slice(a.triangle*3,a.triangle*3+3));return {ids,p:[0,1,2].map(k=>ids.reduce((s,id,i)=>s+positions[id*3+k]*a.barycentric[i],0))};}
 return (from,to,heightCm=175)=>{
 if(!Number.isFinite(heightCm)||heightCm<=0)throw new Error('Invalid body height');const a=anchor(from),b=anchor(to);
 if(from.triangle===to.triangle){const cm=distance(a.p,b.p)*heightCm/1.75;return {cm,inches:cm/2.54,points:[a.p,b.p]};}
 const costs=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),heap=[];
 const push=(id,d)=>{let i=heap.length;heap.push([id,d]);while(i){const p=(i-1)>>1;if(heap[p][1]<=d)break;heap[i]=heap[p];i=p;}heap[i]=[id,d];};
 const pop=()=>{const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return result;};
 for(const id of a.ids){costs[id]=distance(a.p,point(id));push(id,costs[id]);}
 let best=Infinity,end=-1;const ends=new Set(b.ids);
 while(heap.length){const [id,d]=pop();if(d!==costs[id])continue;if(d>=best)break;if(ends.has(id)){const total=d+distance(point(id),b.p);if(total<best){best=total;end=id;}}for(const [next,w]of edges[id])if(d+w<costs[next]){costs[next]=d+w;prev[next]=id;push(next,d+w);}}
 if(end<0)throw new Error('No connected surface route between these points');const route=[];for(let id=end;id>=0;id=prev[id])route.push(point(id));route.reverse();const cm=best*heightCm/1.75;return {cm,inches:cm/2.54,points:[a.p,...route,b.p]};
 };
}
