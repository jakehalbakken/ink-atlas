// Read-only rectangular center/edge guide candidates. Bounds are image rectangles,
// not visible ink contours; caller must verify local surface connectivity.
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a);
const unit=a=>a.map(x=>x/len(a));
function valid(t){return t?.pos?.length===3&&t?.normal?.length===3&&[...t.pos,...t.normal,t.width,t.aspect,t.rot||0].every(Number.isFinite)&&len(t.normal)>1e-8&&t.width>0&&t.aspect>0;}
function frame(t){const n=unit(t.normal),r=unit(cross(Math.abs(n[1])>.93?[0,0,-1]:[0,1,0],n)),u=cross(n,r),c=Math.cos(t.rot||0),s=Math.sin(t.rot||0);return {n,r:r.map((x,i)=>x*c+u[i]*s),u:u.map((x,i)=>x*c-r[i]*s)};}
export function findLiveAlignment(moving,references,{threshold=.006,maxDistance=.22}={}){
 if(!valid(moving)||moving.locked||moving.status==='existing'||moving.hidden)return null;
 if(!Number.isFinite(threshold)||threshold<=0||!Number.isFinite(maxDistance)||maxDistance<=0)throw new Error('Invalid guide thresholds');
 const mf=frame(moving),candidates=[];
 for(const ref of references){if(ref.id===moving.id||ref.hidden||!valid(ref)||len(sub(ref.pos,moving.pos))>maxDistance)continue;const f=frame(ref);if(dot(f.n,mf.n)<.85)continue;const off=sub(moving.pos,ref.pos),x=dot(off,f.r),y=dot(off,f.u),z=dot(off,f.n);if(Math.abs(z)>.025)continue;
 const rw=ref.width/2,rh=ref.width/ref.aspect/2,mw=Math.abs(dot(mf.r,f.r))*moving.width/2+Math.abs(dot(mf.u,f.r))*moving.width/moving.aspect/2,mh=Math.abs(dot(mf.r,f.u))*moving.width/2+Math.abs(dot(mf.u,f.u))*moving.width/moving.aspect/2;
 const optionsX=[{kind:'Center',delta:-x,at:0},{kind:'Left edge',delta:-rw-(x-mw),at:-rw},{kind:'Right edge',delta:rw-(x+mw),at:rw}],optionsY=[{kind:'Center',delta:-y,at:0},{kind:'Top edge',delta:rh-(y+mh),at:rh},{kind:'Bottom edge',delta:-rh-(y-mh),at:-rh}];
 const best=opts=>opts.filter(o=>Math.abs(o.delta)<=threshold).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta))[0],gx=best(optionsX),gy=best(optionsY);if(!gx&&!gy)continue;
 const point=(a,b)=>ref.pos.map((v,i)=>v+f.r[i]*a+f.u[i]*b+f.n[i]*.001),lines=[];
 if(gx){const low=Math.min(-rh,y-mh)-.025,high=Math.max(rh,y+mh)+.025;lines.push({axis:'x',kind:gx.kind,from:point(gx.at,low),to:point(gx.at,high),error:gx.delta});}
 if(gy){const low=Math.min(-rw,x-mw)-.025,high=Math.max(rw,x+mw)+.025;lines.push({axis:'y',kind:gy.kind,from:point(low,gy.at),to:point(high,gy.at),error:gy.delta});}
 candidates.push({referenceId:ref.id,referenceName:ref.name||'Reference',lines,candidate:moving.pos.map((v,i)=>v+f.r[i]*(gx?.delta||0)+f.u[i]*(gy?.delta||0)),score:Math.min(...lines.map(l=>Math.abs(l.error)))});
 }
 return candidates.sort((a,b)=>a.score-b.score||b.lines.length-a.lines.length)[0]||null;
}
