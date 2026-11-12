// Restrained visualization studies adapted to the rebuild rig, not v47's shader
// deformation. Angles are intentionally limited; no IK/contact/anatomy guarantee.
import {axisAngle} from './pose.js';
const q=(axis,value)=>axisAngle(axis==='x'?[1,0,0]:axis==='y'?[0,1,0]:[0,0,1],value);
const pack=angles=>Object.fromEntries(Object.entries(angles).map(([bone,[axis,value]])=>[bone,q(axis,value)]));
const arm=(side,{lift=0,reach=0,elbow=0}={})=>{
 // Reach and lift are offered separately so a single bone receives one canonical
 // axis rotation, not conflicting overwrites or an implied bone-local Euler rig.
 const out={};if(lift)out['upperarm01.'+side]=['z',side==='L'?lift:-lift];else if(reach)out['upperarm01.'+side]=['x',-reach];if(elbow)out['lowerarm01.'+side]=['x',-elbow];return out;
};
const both=options=>({...arm('L',options),...arm('R',options)});
const turn=value=>({spine03:['y',value*.55],spine02:['y',value*.45]});
const leg=(side,hip=0,knee=0)=>({['upperleg01.'+side]:['x',-hip],['lowerleg01.'+side]:['x',knee]});
export const POSE_CATALOG=Object.freeze({
 neutral:{label:'Neutral',angles:{}},
 elbow:{label:'Left elbow bend',angles:arm('L',{elbow:.55})},
 raised:{label:'Left shoulder lift',angles:arm('L',{lift:.48,elbow:.22})},
 twist:{label:'Gentle torso turn left',angles:turn(.27)},
 armsLifted:{label:'Both shoulders lifted',angles:both({lift:.55,elbow:.15})},
 doubleBiceps:{label:'Double biceps · restrained',angles:both({lift:.5,elbow:.72})},
 reachForward:{label:'Both arms forward',angles:both({reach:.38,elbow:.18})},
 openArms:{label:'Open arms · partial',angles:both({lift:.65})},
 leftForward:{label:'Left shoulder forward',angles:arm('L',{reach:.4,elbow:.1})},
 rightForward:{label:'Right shoulder forward',angles:arm('R',{reach:.4,elbow:.1})},
 leftBiceps:{label:'Left bicep flexed',angles:arm('L',{elbow:.75})},
 rightBiceps:{label:'Right bicep flexed',angles:arm('R',{elbow:.75})},
 guard:{label:'Boxing guard · partial',angles:both({reach:.25,elbow:.8})},
 chestOpener:{label:'Chest opener · gentle',angles:both({reach:-.18,elbow:.08})},
 turnRight:{label:'Gentle torso turn right',angles:turn(-.27)},
 rightLateral:{label:'Right shoulder lifted',angles:arm('R',{lift:.48,elbow:.22})},
 leftBehind:{label:'Left shoulder behind · gentle',angles:arm('L',{reach:-.2})},
 rightBehind:{label:'Right shoulder behind · gentle',angles:arm('R',{reach:-.2})},
 hinge:{label:'Hip/torso hinge · partial',angles:{spine04:['x',.12],spine03:['x',.12]}},
 kneeLeft:{label:'Left knee lift · partial',angles:leg('L',.35,.45)},
 kneeRight:{label:'Right knee lift · partial',angles:leg('R',.35,.45)},
 seated:{label:'Seated bend · partial, no chair/contact',angles:{...leg('L',.48,.55),...leg('R',.48,.55),spine04:['x',.08]}},
 squat:{label:'Squat bend · partial, no floor lock',angles:{...leg('L',.24,.4),...leg('R',.24,.4),spine04:['x',.12]}},
 stride:{label:'Stride stance · small',angles:{...leg('L',.16,.12),...leg('R',-.16,.08)}}
});
export function catalogRotations(key){const preset=POSE_CATALOG[key];if(!preset)throw new Error('Unknown pose study');return pack(preset.angles);}
export const MOTION_CATALOG=Object.freeze({
 elbow:{label:'Biceps curl',duration:2.5},reach:{label:'Reach and return',duration:2.7},turn:{label:'Alternating torso turns',duration:3.8},
 lateral:{label:'Lateral shoulder raise',duration:2.8},warmup:{label:'Arm warm-up · restrained',duration:2.8},swing:{label:'Alternating arm swing · small',duration:2.4},chest:{label:'Chest opening sweep · gentle',duration:3.2},
 hinge:{label:'Hip hinge and return · partial',duration:3.3},squat:{label:'Squat and stand · partial',duration:3.6},march:{label:'March study · no floor lock',duration:2.8},sitStand:{label:'Sit/stand bend · partial',duration:4.8},stretch:{label:'Slow shoulder stretch · partial',duration:5.8}
});
export function catalogMotionRotations(kind,phase){
 if(!MOTION_CATALOG[kind]||!Number.isFinite(phase))throw new Error('Invalid motion study');const p=((phase%1)+1)%1,cycle=(1-Math.cos(p*Math.PI*2))/2,wave=Math.sin(p*Math.PI*2);let angles;
 switch(kind){case'elbow':angles=both({elbow:.65*cycle});break;case'reach':angles=both({reach:.38*cycle,elbow:.18*cycle});break;case'turn':angles=turn(.27*wave);break;case'lateral':angles=both({lift:.55*cycle,elbow:.1*cycle});break;case'warmup':angles=both({lift:.3*cycle,elbow:.5*cycle});break;case'swing':angles={...arm('L',{reach:.22*wave}),...arm('R',{reach:-.22*wave})};break;case'chest':angles=both({reach:-.18*cycle});break;case'hinge':angles={spine04:['x',.12*cycle],spine03:['x',.12*cycle]};break;case'squat':angles={...leg('L',.24*cycle,.4*cycle),...leg('R',.24*cycle,.4*cycle),spine04:['x',.12*cycle]};break;case'march':angles={...leg('L',.3*Math.max(0,wave),.35*Math.max(0,wave)),...leg('R',.3*Math.max(0,-wave),.35*Math.max(0,-wave))};break;case'sitStand':angles={...leg('L',.48*cycle,.55*cycle),...leg('R',.48*cycle,.55*cycle),spine04:['x',.08*cycle]};break;case'stretch':angles=both({lift:.65*cycle,elbow:.12*cycle});break;}
 return pack(angles);
}
