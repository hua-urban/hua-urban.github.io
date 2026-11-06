// Production placeLabels + vendored THREE + actual CAD geometry, with CUA-measured button sizes.
// The old final factory exclusion reproduced a 306.03 px single-frame jump.
import fs from 'node:fs';
import * as Core from '../industry-islands/lib/three.core.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
const THREE={...Core,TextureLoader:class {load(){return new Core.Texture();}}};
globalThis.fetch=async url=>{const data=fs.readFileSync(url);return {ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
const {createAmaFansPavilion}=await import('../industry-islands/e/amafans-building.js');
const {createStandingFanTable}=await import('../industry-islands/e/standing-fan-table.js');
const {createEquipmentDisplay}=await import('../industry-islands/e/industrial-equipment.js');
const site=new URL('../',import.meta.url),src=fs.readFileSync(new URL('industry-islands/e/scene.js',site),'utf8');
const fn=src.slice(src.indexOf('    function placeLabels(){'),src.indexOf('    function animate(now)'));
const landscape=new THREE.Group();landscape.scale.set(.92,1,1.06);landscape.rotation.y=-.19;landscape.updateMatrixWorld(true);
const mapPoint=p=>p.clone().applyMatrix4(landscape.matrix);
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,...extra}),keep=x=>x,pickables=[],buildingPlots=[];
const mesh=(g,m,p,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);p.add(o);return o;};
const box=(p,x,y,z,w,h,d,m=material('#aaa'))=>mesh(new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
const cyl=(p,x,y,z,r,h,m=material('#aaa'))=>mesh(new THREE.CylinderGeometry(r,r,h,16),m,p,x,y,z);
const root=new THREE.Group();root.position.set(5,0,1.1);landscape.add(root);
const pavilion=await createAmaFansPavilion({THREE,root,box,cyl,mesh,material,keep,pickables,buildingPlots});
const standing=await createStandingFanTable({THREE,parent:landscape,material,keep,pickables});
const equipment=await createEquipmentDisplay({THREE,parent:landscape,material,keep,pickables,box,cyl});
landscape.updateMatrixWorld(true);
const boxCorners=b=>{const r=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])r.push(new THREE.Vector3(x,y,z));return r;};
const standingCorners=boxCorners(new THREE.Box3().setFromObject(standing.root));
const fanRegions=[pavilion.fan.root,standing.root,...Object.values(equipment.devices)].map(o=>boxCorners(new THREE.Box3().setFromObject(o)));
const fanCorners=boxCorners(new THREE.Box3().setFromObject(pavilion.pavilion).union(new THREE.Box3().setFromObject(standing.root)).union(new THREE.Box3().setFromObject(equipment.group)));
const node={ai:[-4.6,-1.8],property:[-1.4,-3.35],finance:[1.3,-1.85],land:[4.7,-2.3],industry:[11.6,1.4],talent:[-5.2,1],overseas:[-5.4,6.65],learning:[4.7,6.65]};
let worst={jump:0},overlapFrames=0,hidden=0,maxDrift=0,maxOverlapDepth=0,maxOverlapArea=0;
for(const [width,height] of [[1248,632],[376,773],[356,510]]){
 const camera=new THREE.PerspectiveCamera(36,width/height,.1,180),target=mapPoint(new THREE.Vector3(0,.25,1.1));
 const ids=['property','overseas','land','industry','ai','finance','talent','learning'],mobile=width<600;
 const widths=mobile?[48,48,56,72,42,56,56,48]:[66,66,76,96,59,76,76,66];
 const labels=ids.map((id,i)=>{const [x,z]=node[id];return {anchor:new THREE.Vector3(x,id==='industry'?2.2:1.65,z+(id==='industry'?0:.25)),width:widths[i],height:mobile?22:28,el:{dataset:{topic:id},style:{}}};});
 const coastline=src.slice(src.indexOf('    const mainCoast='),src.indexOf('    for(const outline of [mainCoast,portCoast,learnCoast])'));
 const fitFn=src.slice(src.indexOf('    function fit()'),src.indexOf('    let focusedEquipment='));
 const controls={target:new THREE.Vector3(),update(){camera.lookAt(this.target);}},defaultPosition=new THREE.Vector3();
 new Function('THREE','labels','mapPoint','camera','width','height','controls','defaultPosition','fitTarget','scene','v',coastline+fitFn+';fit();')(THREE,labels,mapPoint,camera,width,height,controls,defaultPosition,target,{fog:{}},(x,z,y)=>new THREE.Vector3(x,y,z));
 const distance=defaultPosition.distanceTo(target),elevation=defaultPosition.y-target.y,horizontal=Math.sqrt(distance*distance-elevation*elevation);

 const container={dataset:{}};const projected=new THREE.Vector3();
 const screenBounds=new Function('camera','width','height',src.slice(src.indexOf('    function screenBounds('),src.indexOf('    function placeLabels(){'))+';return screenBounds')(camera,width,height);
 const place=new Function('labels','projected','mapPoint','camera','THREE','width','height','screenBounds','fanCorners','standingCorners','container','fanRegions',fn+';return placeLabels')(labels,projected,mapPoint,camera,THREE,width,height,screenBounds,fanCorners,standingCorners,container,fanRegions);
 let prior;const before=overlapFrames;let localDrift=0,fanOverlapFrames=0,maxFanOverlapDepth=0;
 for(let frame=0;frame<Number(process.env.LABEL_SWEEP_FRAMES||6284);frame++){
  const a=-.5+frame*.001;camera.position.set(Math.sin(a)*horizontal,elevation,Math.cos(a)*horizontal).add(target);camera.lookAt(target);camera.updateMatrixWorld(true);place();
  const out=labels.map(l=>[+parseFloat(l.el.style.left),+parseFloat(l.el.style.top)]);
  const pinned=labels.find(l=>l.el.dataset.topic==='industry').layout;
  if(Math.abs(pinned.x-pinned.baseX)>20.01||pinned.y-pinned.baseY>0.01||pinned.y-pinned.baseY< -20.01)throw new Error('Industry label left its standing-fan anchor');
  if(labels.some(l=>l.el.style.visibility==='hidden'))hidden++;
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j],ox=(a.width+b.width)/2-Math.abs(a.layout.x-b.layout.x),oy=(a.height+b.height)/2-Math.abs(a.layout.y-b.layout.y);if(ox>0&&oy>0){maxOverlapDepth=Math.max(maxOverlapDepth,Math.min(ox,oy));maxOverlapArea=Math.max(maxOverlapArea,ox*oy);}}
  if(labels.some((l,i)=>labels.slice(i+1).some(o=>Math.abs(l.layout.x-o.layout.x)<(l.width+o.width)/2&&Math.abs(l.layout.y-o.layout.y)<(l.height+o.height)/2))){overlapFrames++;}
  for(const l of labels){const p=mapPoint(l.anchor).project(camera);const drift=Math.hypot(l.layout.x-(p.x*.5+.5)*width,l.layout.y-(-p.y*.5+.5)*height);maxDrift=Math.max(maxDrift,drift);localDrift=Math.max(localDrift,drift);}
  let fanHit=false;for(const l of labels)for(const corners of fanRegions){const r=screenBounds(corners);if(!r)continue;const ox=Math.min(l.layout.x+l.width/2,r.right)-Math.max(l.layout.x-l.width/2,r.x),oy=Math.min(l.layout.y+l.height/2,r.bottom)-Math.max(l.layout.y-l.height/2,r.y);if(ox>0&&oy>0){fanHit=true;maxFanOverlapDepth=Math.max(maxFanOverlapDepth,Math.min(ox,oy));}}if(fanHit)fanOverlapFrames++;
  if(prior)out.forEach((p,i)=>{const jump=Math.hypot(p[0]-prior[i][0],p[1]-prior[i][1]);if(jump>worst.jump)worst={jump,width,height,frame,topic:labels[i].el.dataset.topic,from:prior[i],to:p};});prior=out;
 }
 console.log(JSON.stringify({width,overlapFrames:overlapFrames-before,maxAnchorDisplacement:localDrift,fanOverlapFrames,maxFanOverlapDepth}));if(localDrift>(width<600?100.01:80.01))process.exitCode=1;
}
console.log(JSON.stringify({worst,overlapFrames,hidden,maxDrift,maxOverlapDepth,maxOverlapArea}));if(worst.jump>5||overlapFrames||hidden)process.exitCode=1;
// Legacy groups use their real placeLabels and real district anchors with the same camera projection.
for(const group of ['a','b','c','d']){
 const code=fs.readFileSync(new URL(`industry-islands/${group}/scene.js`,site),'utf8');
 const transform=code.slice(code.indexOf('    const landscape ='),code.indexOf('    const geometries ='));
 const mapPoint=new Function('THREE','scene',transform+';return mapPoint')(THREE,{add(){}});
 const layoutCode=code.slice(code.indexOf('export const ROAD_LAYOUT ='),code.indexOf('};',code.indexOf('export const ROAD_LAYOUT ='))+2);
 const nodes=new Function(layoutCode.replace('export const','const')+';return ROAD_LAYOUT.nodes')();
 let worstLegacy=0;
 for(const [width,height] of [[1100,700],[390,650]]){
  const camera=new THREE.PerspectiveCamera(36,width/height,.1,180),target=mapPoint(new THREE.Vector3(0,.25,1.1));
  const labels=Object.entries(nodes).filter(([id])=>!['center','west','east'].includes(id)).map(([id,[x,z]])=>({anchor:new THREE.Vector3(x,1.65,z+.25),width:100,height:30,el:{dataset:{topic:id},style:{}}}));
  if(group==='d')labels.find(l=>l.el.dataset.topic==='energy').anchor.set(9.74-19.6,3.08,2.34-.5);
  const implementation=code.slice(code.indexOf('    function placeLabels(){'),code.indexOf('    function animate(now)'));
  const place=new Function('labels','projected','mapPoint','camera','THREE','width','height',implementation+';return placeLabels')(labels,new THREE.Vector3(),mapPoint,camera,THREE,width,height);
  let prior;
  for(let frame=0;frame<Number(process.env.LABEL_SWEEP_FRAMES||6284);frame++){
   const a=-.5+frame*.001;camera.position.set(Math.sin(a)*34,17,Math.cos(a)*34).add(target);camera.lookAt(target);camera.updateMatrixWorld(true);place();
   const positions=labels.map(l=>[parseFloat(l.el.style.left),parseFloat(l.el.style.top)]);
   if(prior)positions.forEach((p,i)=>{worstLegacy=Math.max(worstLegacy,Math.hypot(p[0]-prior[i][0],p[1]-prior[i][1]));});prior=positions;
  }
 }
 console.log(JSON.stringify({group,maxJump:worstLegacy}));if(worstLegacy>5)process.exitCode=1;
}
