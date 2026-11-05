import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../industry-islands/lib/three.module.js';
import {createCreamCat} from '../industry-islands/e/cream-cat.js';
import {createPhotoTabby} from '../industry-islands/e/photo-tabby.js';
import {createCatWalker} from '../industry-islands/e/cat-walker.js';

const source=fs.readFileSync(new URL('../industry-islands/e/scene.js',import.meta.url),'utf8');
const layoutSource=source.slice(source.indexOf('export const ROAD_LAYOUT'),source.indexOf('// A schematic miniature'));
const {ROAD_LAYOUT,findRoadPath}=await import('data:text/javascript;base64,'+Buffer.from(layoutSource).toString('base64'));
const landscape=new THREE.Group(),kept=new Set(),mats=new Set();
const keep=g=>(kept.add(g),g),material=color=>{const m=new THREE.MeshStandardMaterial({color});mats.add(m);return m;};
const unitCylinder=keep(new THREE.CylinderGeometry(1,1,1,12)),unitBox=keep(new THREE.BoxGeometry(1,1,1));
const P={white:material('#f6f1e4')};
function mesh(g,m,p=landscape,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);p.add(o);return o;}
function box(p,x,y,z,w,h,d,m){const o=mesh(unitBox,m,p,x,y,z);o.scale.set(w,h,d);return o;}
function cyl(p,x,y,z,r,h,m){const o=mesh(unitCylinder,m,p,x,y,z);o.scale.set(r,h,r);return o;}
const nodes=ROAD_LAYOUT.nodes,edges=ROAD_LAYOUT.links.map(([a,b,bends,bridge])=>{
const path=new THREE.CatmullRomCurve3([nodes[a],...bends,nodes[b]].map(([x,z])=>new THREE.Vector3(x,bridge?.24:.135,z)),false,'catmullrom',.26);
return {a,b,path,length:path.getLength(),bridge};});
const shortest=(a,b)=>findRoadPath(Object.keys(nodes),edges,a,b);
const routeSource=source.slice(source.indexOf('    function routeCurve('),source.indexOf('    // Reused geometry'));
const routeCurve=new Function('THREE',routeSource+';return routeCurve;')(THREE);
const catSource=source.slice(source.indexOf('    const cat = new THREE.Group()'),source.indexOf('    function vehicle('));
const build=new Function('THREE','landscape','material','mesh','box','cyl','unitCylinder','keep','P','routeCurve','shortest','createCreamCat','createPhotoTabby','createCatWalker',
catSource+';return [{root:cat,update:updateCat},{root:creamCat.root,update:creamCat.update},{root:extraTabby.root,update:extraTabby.update}];');
const expectedStops=[['center','talent','ai','property','finance'],['center','east','learning','industry'],['finance','land','industry','east','center']];
for(const fps of [20,30,60]){
const actors=build(THREE,landscape,material,mesh,box,cyl,unitCylinder,keep,P,routeCurve,shortest,createCreamCat,createPhotoTabby,createCatWalker);
const states=actors.map(actor=>({name:actor.root.name,previous:actor.root.position.clone(),yaw:actor.root.rotation.y,visited:new Set(),bad:0,backwards:0,moving:0,minDot:1,maxTurnSpeed:0,firstFailure:null}));
const dt=1/fps,forward=new THREE.Vector3(),velocity=new THREE.Vector3();
for(let frame=1;frame<=300/dt;frame++){
 for(let index=0;index<actors.length;index++){
 const actor=actors[index],s=states[index];actor.update(frame*dt,dt);
 const turn=Math.atan2(Math.sin(actor.root.rotation.y-s.yaw),Math.cos(actor.root.rotation.y-s.yaw));s.maxTurnSpeed=Math.max(s.maxTurnSpeed,Math.abs(turn)/dt);s.yaw=actor.root.rotation.y;
 assert(Math.abs(actor.root.rotation.x)<1e-9&&Math.abs(actor.root.rotation.z)<1e-9,s.name+': inherited root axis rotation');
 for(const id of expectedStops[index]){const [x,z]=nodes[id];if(Math.hypot(actor.root.position.x-x,actor.root.position.z-z)<.02)s.visited.add(id);}
 velocity.copy(actor.root.position).sub(s.previous);velocity.y=0;
 if(velocity.length()>1e-7){s.moving++;velocity.normalize();forward.set(0,0,1).applyQuaternion(actor.root.quaternion);forward.y=0;forward.normalize();
 const dot=forward.dot(velocity);s.minDot=Math.min(s.minDot,dot);
 if(dot<Math.cos(8*Math.PI/180)){s.bad++;if(!s.firstFailure)s.firstFailure={seconds:frame*dt,dot};}
 if(dot<0)s.backwards++;}
 assert(Number.isFinite(actor.root.position.length()),s.name+': nonfinite position');s.previous.copy(actor.root.position);
 }}
const report=states.map(({previous,yaw,visited,...s})=>({...s,visited:[...visited]}));console.log(JSON.stringify({fps,actors:report}));
assert(states.every(s=>s.moving>1000),'Each cat must walk, not freeze to pass');
assert(states.every(s=>s.bad===0),'Cats must face within 8 degrees of actual movement; no backwards/sideways sliding');
assert(states.every(s=>s.maxTurnSpeed<=2.8+1e-8),'Cats must turn smoothly rather than snapping');
assert(states.every((s,index)=>expectedStops[index].every(id=>s.visited.has(id))),'Each cat must complete its whole route, including reversals');
actors.forEach(actor=>landscape.remove(actor.root));
}
kept.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());

