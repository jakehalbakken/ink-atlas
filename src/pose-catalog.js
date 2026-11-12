// Poses and motion loops for the MakeHuman rig (pose.js), after v47's catalog.
// Rotations are quaternions on world axes, applied in the parent's frame. Big arm
// movements are shared along clavicle, shoulder and upper arm so the shoulder keeps
// its volume. No contact or floor locking: a seated pose has no chair.
import {axisAngle} from './pose.js';
const AX={x:[1,0,0],y:[0,1,0],z:[0,0,1]};
const axisOf=a=>typeof a==='string'?AX[a]:a;
const mul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
// angles: bone -> list of [axis, radians], applied left to right.
const pack=angles=>Object.fromEntries(Object.entries(angles).map(([bone,list])=>[bone,list.reduce((q,[axis,value])=>mul(axisAngle(axisOf(axis),value),q),[0,0,0,1])]));
const add=(out,bone,axis,value)=>{if(value)(out[bone]||(out[bone]=[])).push([axis,value]);return out;};
// lift: arm out to the side and up (0.75 is about level). reach: forward (+) or back (-).
// elbow: bend the forearm forward. curl: bend the forearm up, for a raised arm.
// hang: bring the arm in to the side first (1 = straight down), so a reach goes forward
// rather than forward and out.
const arm=(side,{lift=0,reach=0,elbow=0,curl=0,hang=0}={},out={})=>{
 const s=side==='L'?1:-1;lift-=.75*hang;
 const share=(bone,f)=>{add(out,bone,'z',s*lift*f);add(out,bone,'x',-reach*f);};
 share('clavicle.'+side,lift>.9?.12:0);share('shoulder01.'+side,lift>.9?.16:.08);share('upperarm01.'+side,lift>.9?.72:.92);
 // The elbow hinges across the upper arm, which hangs about 37 degrees out at rest.
 add(out,'lowerarm01.'+side,[-.79,-.61*s,0],elbow);add(out,'lowerarm01.'+side,'z',s*curl);
 return out;
};
const both=(o)=>arm('R',o,arm('L',o));
const spine=(out,{turn=0,bend=0,side=0}={})=>{for(const [b,f] of [['spine04',.2],['spine03',.4],['spine02',.4]]){add(out,b,'y',turn*f);add(out,b,'x',bend*f);add(out,b,'z',side*f);}return out;};
const leg=(side,hip=0,knee=0,out={})=>{add(out,'upperleg01.'+side,'x',-hip);add(out,'lowerleg01.'+side,'x',knee);return out;};
const merge=(...parts)=>{const out={};for(const p of parts)for(const [b,l] of Object.entries(p))(out[b]||(out[b]=[])).push(...l);return out;};

const still=(group,label,angles)=>({group,label,angles});
export const POSE_GROUPS=Object.freeze(['Standing','Arms','One arm','Torso','Legs']);
export const POSE_CATALOG=Object.freeze({
 neutral:still('Standing','Standing',{}),
 armsLifted:still('Arms','Arms out to the sides',both({lift:.78})),
 raisedBoth:still('Arms','Arms overhead',both({lift:2.15,elbow:.1})),
 doubleBiceps:still('Arms','Double biceps',both({lift:.82,curl:1.45})),
 reachForward:still('Arms','Arms forward',both({hang:1,reach:1.05,elbow:.1})),
 openArms:still('Arms','Open arms',both({lift:.7,reach:-.35})),
 guard:still('Arms','Boxing guard',both({hang:.85,reach:.55,elbow:1.9})),
 chestOpener:still('Arms','Chest opener',both({lift:.35,reach:-.55})),
 elbow:still('One arm','Left elbow bent',arm('L',{hang:.7,elbow:1.2})),
 raised:still('One arm','Left arm to the side',arm('L',{lift:.78})),
 overheadLeft:still('One arm','Left arm overhead',arm('L',{lift:2.15,elbow:.1})),
 leftForward:still('One arm','Left arm forward',arm('L',{hang:1,reach:1.05,elbow:.1})),
 leftBehind:still('One arm','Left arm behind',arm('L',{hang:.8,reach:-.95})),
 leftBiceps:still('One arm','Left biceps flexed',arm('L',{lift:.82,curl:1.45})),
 rightElbow:still('One arm','Right elbow bent',arm('R',{hang:.7,elbow:1.2})),
 rightLateral:still('One arm','Right arm to the side',arm('R',{lift:.78})),
 overheadRight:still('One arm','Right arm overhead',arm('R',{lift:2.15,elbow:.1})),
 rightForward:still('One arm','Right arm forward',arm('R',{hang:1,reach:1.05,elbow:.1})),
 rightBehind:still('One arm','Right arm behind',arm('R',{hang:.8,reach:-.95})),
 rightBiceps:still('One arm','Right biceps flexed',arm('R',{lift:.82,curl:1.45})),
 twist:still('Torso','Turn left',spine({},{turn:.5})),
 turnRight:still('Torso','Turn right',spine({},{turn:-.5})),
 sideReach:still('Torso','Side reach',spine(arm('L',{lift:2.15}),{side:-.3})),
 hinge:still('Torso','Bend forward',merge(spine({},{bend:.45}),leg('L',.35),leg('R',.35))),
 kneeLeft:still('Legs','Left knee up',leg('L',1.2,1.4)),
 kneeRight:still('Legs','Right knee up',leg('R',1.2,1.4)),
 squat:still('Legs','Squat',merge(leg('L',1.1,1.7),leg('R',1.1,1.7),spine({},{bend:.35}))),
 seated:still('Legs','Seated',merge(leg('L',1.5,1.5),leg('R',1.5,1.5))),
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
  case'elbow':a=both({hang:.7,elbow:1.9*cycle});break;
  case'reach':a=both({hang:cycle,reach:1.05*cycle,elbow:.1*cycle});break;
  case'turn':a=spine({},{turn:.5*wave});break;
  case'lateral':a=both({lift:.78*cycle});break;
  case'press':a=both({lift:.82+1.3*cycle,curl:1.45*(1-cycle)});break;
  case'wave':a=arm('L',{lift:.82,curl:1.2+.45*wave});break;
  case'warmup':a=both({lift:.78*cycle,curl:1.2*cycle});break;
  case'swing':a=merge(arm('L',{hang:.7,reach:.6*wave}),arm('R',{hang:.7,reach:-.6*wave}));break;
  case'chest':a=both({lift:.35*cycle,reach:-.55*cycle});break;
  case'punches':a=merge(arm('L',{hang:.85+.15*pos,reach:.5+.55*pos,elbow:1.9*(1-pos)}),arm('R',{hang:.85+.15*neg,reach:.5+.55*neg,elbow:1.9*(1-neg)}));break;
  case'jacks':a=both({lift:2.15*cycle});break;
  case'hinge':a=merge(spine({},{bend:.45*cycle}),leg('L',.35*cycle),leg('R',.35*cycle));break;
  case'squat':a=merge(leg('L',1.1*cycle,1.7*cycle),leg('R',1.1*cycle,1.7*cycle),spine({},{bend:.35*cycle}));break;
  case'sitStand':a=merge(leg('L',1.5*cycle,1.5*cycle),leg('R',1.5*cycle,1.5*cycle));break;
  case'march':a=merge(leg('L',1.1*pos,1.3*pos),leg('R',1.1*neg,1.3*neg),arm('L',{hang:.7,reach:-.45*wave}),arm('R',{hang:.7,reach:.45*wave}));break;
  case'walk':a=merge(leg('L',.42*wave,.2+.35*neg),leg('R',-.42*wave,.2+.35*pos),arm('L',{hang:.7,reach:-.4*wave}),arm('R',{hang:.7,reach:.4*wave}));break;
  case'stretch':a=p<.5?both({lift:2.15*cycle}):merge(both({lift:2.15*cycle}),spine({},{side:.3*Math.sin((p-.5)*Math.PI*4)}));break;
 }
 return pack(a);
}
