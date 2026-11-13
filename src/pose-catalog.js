// Poses and motion loops for the MakeHuman rig (pose.js), after v47's catalog.
// Rotations are quaternions on world axes, applied in the parent's frame. Big arm
// movements are shared along clavicle, shoulder and upper arm so the shoulder keeps
// its volume. The lowest foot stays on the floor (pose-view.js); a seated pose has no chair.
import {axisAngle,createRestRig,POSE_BONES,poseTransforms} from './pose.js';
const AX={x:[1,0,0],y:[0,1,0],z:[0,0,1]};
const axisOf=a=>typeof a==='string'?AX[a]:a;
const mul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
// angles: bone -> list of [axis, radians], applied left to right.
const pack=angles=>Object.fromEntries(Object.entries(angles).map(([bone,list])=>[bone,list.reduce((q,[axis,value])=>mul(axisAngle(axisOf(axis),value),q),[0,0,0,1])]));
const add=(out,bone,axis,value)=>{if(value)(out[bone]||(out[bone]=[])).push([axis,value]);return out;};
// The arm moves the way a real one can. The elbow only hinges, on its own axis, so the
// crease and the biceps stay on the inside of the bend. To bring a forearm up beside the
// head (curl) the upper arm turns outward first, as in a biceps flex, rather than the
// elbow bending sideways. The forearm can turn the palm up (palm) and the hand can close
// into a fist (fist, 0..1). Axes come from the rest skeleton, so they fit every body.
let REST=null;
const restRig=()=>REST||(REST=createRestRig({}));
const restJoint=(name,end='head')=>{const J=restRig().joints,b=POSE_BONES.find(x=>x.name===name),k=b[end]*3;return [J[k],J[k+1],J[k+2]];};
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],vdot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],vunit=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);};
const AXES={};
function armAxes(side){
 if(AXES[side])return AXES[side];
 const sh=restJoint('upperarm01.'+side),el=restJoint('lowerarm01.'+side),wr=restJoint('wrist.'+side);
 const upper=vunit(vsub(el,sh)),fore=vunit(vsub(wr,el)),hinge=vunit(vcross(upper,fore));
 // the palm faces where the fingers curl to: across the knuckles, then square to the fingers
 const across=vunit(vsub(restJoint('finger2-1.'+side),restJoint('finger5-1.'+side))),fingers=vunit(vsub(restJoint('finger3-3.'+side,'tail'),restJoint('finger3-1.'+side)));
 let palmN=vunit(vcross(fingers,across));
 // the thumb sits on the palm side of the hand
 if(vdot(palmN,vsub(restJoint('finger1-3.'+side,'tail'),restJoint('finger3-1.'+side)))<0)palmN=palmN.map(x=>-x);
 const s=side==='L'?1:-1,thumbTip=restJoint('finger1-3.'+side,'tail');
 // supination turns the thumb outward when the arm hangs
 const turn=vcross(fore,vsub(thumbTip,el));const sup=Math.sign(turn[0]*s)||1;
 const finger=[];
 for(const f of [2,3,4,5])for(const k of [1,2,3]){const name=`finger${f}-${k}.${side}`,d=vunit(vsub(restJoint(name,'tail'),restJoint(name)));let ax=vunit(vcross(d,palmN));finger.push({name,axis:ax,k});}
 // the thumb closes over the middle of the index and middle fingers
 const fistRot={};for(const f of finger)fistRot[f.name]=axisAngle(f.axis,[0,1.45,1.6,1.05][f.k]);
 const T=poseTransforms(restRig(),fistRot),bi=Object.fromEntries(POSE_BONES.map((b,i)=>[b.name,i]));
 const posed=(name,end)=>{const t=T[bi[name]],p=restJoint(name,end),[x,y,z]=p,[a,b,c,w]=t.q,tx=2*(b*z-c*y),ty=2*(c*x-a*z),tz=2*(a*y-b*x);return [x+w*tx+b*tz-c*ty+t.t[0],y+w*ty+c*tx-a*tz+t.t[1],z+w*tz+a*ty-b*tx+t.t[2]];};
 const mid=n=>{const a=posed(n,'head'),b=posed(n,'tail');return [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];};
 const target=mid('finger2-2.'+side).map((x,i)=>(x+mid('finger3-2.'+side)[i])/2);
 const tb=restJoint('finger1-1.'+side),td=vunit(vsub(restJoint('finger1-3.'+side,'tail'),tb)),tt=vunit(vsub(target,tb));
 const d2=vunit(vsub(restJoint('finger1-2.'+side,'tail'),restJoint('finger1-2.'+side))),tp=vunit(vsub(tt,d2.map(x=>x*vdot(tt,d2))));
 const thumb={dir:td,swingAxis:vunit(vcross(td,tt)),swing:Math.acos(Math.min(1,vdot(td,tt))),bend:vunit(vcross(d2,tp))};
 return AXES[side]={upper,fore,hinge,palmN,sup,finger,thumb};
}
const smooth01=x=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
// lift: arm out to the side and up (0.75 is about level). reach: forward (+) or back (-).
// elbow: bend the forearm forward. curl: bend the forearm up, for a raised arm.
// hang: bring the arm in to the side first (1 = straight down), so a reach goes forward
// rather than forward and out. palm: turn the palm up/forward (radians). fist: 0..1.
const arm=(side,{lift=0,reach=0,elbow=0,curl=0,hang=0,palm=0,fist=0}={},out={})=>{
 const s=side==='L'?1:-1,A=armAxes(side);lift-=.75*hang;
 // outward turn of the upper arm first (rest frame), split over its two bones
 const outward=-s*(Math.PI/2)*smooth01(curl/.5);
 add(out,'upperarm01.'+side,A.upper,outward*.6);add(out,'upperarm02.'+side,A.upper,outward*.4);
 const share=(bone,f)=>{add(out,bone,'z',s*lift*f);add(out,bone,'x',-reach*f);};
 share('clavicle.'+side,lift>.9?.12:0);share('shoulder01.'+side,lift>.9?.16:.08);share('upperarm01.'+side,lift>.9?.72:.92);
 add(out,'lowerarm01.'+side,A.hinge,elbow+curl);
 add(out,'lowerarm02.'+side,A.fore,A.sup*palm);
 if(fist){
  for(const f of A.finger)add(out,f.name,f.axis,fist*[0,1.45,1.6,1.05][f.k]);
  add(out,'finger1-1.'+side,A.thumb.dir,s*.35*fist);add(out,'finger1-1.'+side,A.thumb.swingAxis,.4*A.thumb.swing*fist);
  add(out,'finger1-2.'+side,A.thumb.bend,.3*fist);add(out,'finger1-3.'+side,A.thumb.bend,.9*fist);
 }
 return out;
};
const both=(o)=>arm('R',o,arm('L',o));
const spine=(out,{turn=0,bend=0,side=0}={})=>{for(const [b,f] of [['spine04',.2],['spine03',.4],['spine02',.4]]){add(out,b,'y',turn*f);add(out,b,'x',bend*f);add(out,b,'z',side*f);}return out;};
// The foot stays level with the floor unless told otherwise (ankle), so a squat stands
// on flat feet rather than on its toes.
const leg=(side,hip=0,knee=0,out={},ankle=hip-knee)=>{add(out,'upperleg01.'+side,'x',-hip);add(out,'lowerleg01.'+side,'x',knee);add(out,'foot.'+side,'x',ankle);return out;};
const merge=(...parts)=>{const out={};for(const p of parts)for(const [b,l] of Object.entries(p))(out[b]||(out[b]=[])).push(...l);return out;};

const still=(group,label,angles)=>({group,label,angles});
export const POSE_GROUPS=Object.freeze(['Standing','Arms','One arm','Torso','Legs']);
export const POSE_CATALOG=Object.freeze({
 neutral:still('Standing','Standing',{}),
 armsLifted:still('Arms','Arms out to the sides',both({lift:.78})),
 raisedBoth:still('Arms','Arms overhead',both({lift:2.15,elbow:.1})),
 doubleBiceps:still('Arms','Double biceps',both({lift:.9,curl:.95,palm:1.3,fist:1})),
 reachForward:still('Arms','Arms forward',both({hang:1,reach:1.05,elbow:.1})),
 openArms:still('Arms','Open arms',both({lift:.7,reach:-.35})),
 guard:still('Arms','Boxing guard',both({hang:.85,reach:.6,elbow:1.55,palm:1.1,fist:1})),
 chestOpener:still('Arms','Chest opener',both({lift:.35,reach:-.55})),
 elbow:still('One arm','Left elbow bent',arm('L',{hang:.7,elbow:1.2})),
 raised:still('One arm','Left arm to the side',arm('L',{lift:.78})),
 overheadLeft:still('One arm','Left arm overhead',arm('L',{lift:2.15,elbow:.1})),
 leftForward:still('One arm','Left arm forward',arm('L',{hang:1,reach:1.05,elbow:.1})),
 leftBehind:still('One arm','Left arm behind',arm('L',{hang:.8,reach:-.95})),
 leftBiceps:still('One arm','Left biceps flexed',arm('L',{lift:.9,curl:.95,palm:1.3,fist:1})),
 rightElbow:still('One arm','Right elbow bent',arm('R',{hang:.7,elbow:1.2})),
 rightLateral:still('One arm','Right arm to the side',arm('R',{lift:.78})),
 overheadRight:still('One arm','Right arm overhead',arm('R',{lift:2.15,elbow:.1})),
 rightForward:still('One arm','Right arm forward',arm('R',{hang:1,reach:1.05,elbow:.1})),
 rightBehind:still('One arm','Right arm behind',arm('R',{hang:.8,reach:-.95})),
 rightBiceps:still('One arm','Right biceps flexed',arm('R',{lift:.9,curl:.95,palm:1.3,fist:1})),
 twist:still('Torso','Turn left',spine({},{turn:.5})),
 turnRight:still('Torso','Turn right',spine({},{turn:-.5})),
 sideReach:still('Torso','Side reach',spine(arm('L',{lift:2.15}),{side:-.3})),
 hinge:still('Torso','Bend forward',spine({},{bend:.65})),
 kneeLeft:still('Legs','Left knee up',leg('L',1.2,1.4)),
 kneeRight:still('Legs','Right knee up',leg('R',1.2,1.4)),
 squat:still('Legs','Squat',merge(leg('L',1.45,1.8),leg('R',1.45,1.8),spine({},{bend:.62}),both({hang:1,reach:1.05,elbow:.15}))),
 seated:still('Legs','Seated',merge(leg('L',1.5,1.5),leg('R',1.5,1.5),spine({},{bend:.08}),both({hang:1,reach:.25,elbow:.9}))),
 stride:still('Legs','Stride',merge(leg('L',.42,.15),leg('R',-.3,.35))),
});
export function catalogRotations(key){const preset=POSE_CATALOG[key];if(!preset)throw new Error('Unknown pose study');return pack(preset.angles);}
export const MOTION_CATALOG=Object.freeze({
 elbow:{label:'Biceps curl',duration:2.5},reach:{label:'Reach and return',duration:2.7},turn:{label:'Torso turns',duration:3.8},
 lateral:{label:'Lateral raise',duration:2.8},press:{label:'Overhead press',duration:3},wave:{label:'Wave',duration:2.5},
 warmup:{label:'Arm warm-up',duration:2.8},swing:{label:'Arm swing',duration:2.4},chest:{label:'Chest opening',duration:3.2},
 punches:{label:'Punches',duration:2.8},jacks:{label:'Jumping jack arms',duration:2.1},
 hinge:{label:'Bend and return',duration:3.3},squat:{label:'Squat and stand',duration:3.6},sitStand:{label:'Sit and stand',duration:4.8},
 march:{label:'March in place',duration:2.8},walk:{label:'Walk in place',duration:2.3},stretch:{label:'Slow stretch',duration:5.8}
});
export function catalogMotionRotations(kind,phase){
 if(!MOTION_CATALOG[kind]||!Number.isFinite(phase))throw new Error('Invalid motion study');
 const p=((phase%1)+1)%1,cycle=(1-Math.cos(p*Math.PI*2))/2,wave=Math.sin(p*Math.PI*2),pos=Math.max(0,wave),neg=Math.max(0,-wave);
 let a;
 switch(kind){
  case'elbow':a=both({hang:.7,elbow:1.6*cycle,palm:1.1,fist:.85});break;
  case'reach':a=both({hang:cycle,reach:1.05*cycle,elbow:.1*cycle});break;
  case'turn':a=spine({},{turn:.5*wave});break;
  case'lateral':a=both({lift:.78*cycle});break;
  case'press':a=both({lift:.82+1.3*cycle,curl:1.45*(1-cycle)});break;
  case'wave':a=arm('L',{lift:.82,curl:1.2+.45*wave});break;
  case'warmup':a=both({lift:.78*cycle,curl:1.2*cycle});break;
  case'swing':a=merge(arm('L',{hang:.7,reach:.6*wave}),arm('R',{hang:.7,reach:-.6*wave}));break;
  case'chest':a=both({lift:.35*cycle,reach:-.55*cycle});break;
  case'punches':a=merge(arm('L',{hang:.85+.15*pos,reach:.5+.55*pos,elbow:1.55*(1-pos),palm:-.3-.9*pos,fist:1}),arm('R',{hang:.85+.15*neg,reach:.5+.55*neg,elbow:1.55*(1-neg),palm:-.3-.9*neg,fist:1}));break;
  case'jacks':a=both({lift:2.15*cycle});break;
  case'hinge':a=spine({},{bend:.65*cycle});break;
  case'squat':a=merge(leg('L',1.45*cycle,1.8*cycle),leg('R',1.45*cycle,1.8*cycle),spine({},{bend:.62*cycle}),both({hang:1,reach:1.05*cycle,elbow:.15*cycle}));break;
  case'sitStand':a=merge(leg('L',1.5*cycle,1.5*cycle),leg('R',1.5*cycle,1.5*cycle),spine({},{bend:.08*cycle}),both({hang:cycle,reach:.25*cycle,elbow:.9*cycle}));break;
  case'march':a=merge(leg('L',1.1*pos,1.3*pos),leg('R',1.1*neg,1.3*neg),arm('L',{hang:.7,reach:-.45*wave}),arm('R',{hang:.7,reach:.45*wave}));break;
  case'walk':a=merge(leg('L',.42*wave,.2+.35*neg),leg('R',-.42*wave,.2+.35*pos),arm('L',{hang:.7,reach:-.4*wave}),arm('R',{hang:.7,reach:.4*wave}));break;
  case'stretch':a=p<.5?both({lift:2.15*cycle}):merge(both({lift:2.15*cycle}),spine({},{side:.3*Math.sin((p-.5)*Math.PI*4)}));break;
 }
 return pack(a);
}
