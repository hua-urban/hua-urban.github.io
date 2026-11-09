// Execute the production map transform and measure its effect on model axes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../industry-islands/lib/three.core.js';
const source=fs.readFileSync(new URL('../industry-islands/d/scene.js',import.meta.url),'utf8');
const start=source.indexOf('    const landscape = new THREE.Group();');
const end=source.indexOf('    const mapPoint =',start);
assert(start>=0&&end>start,'Production landscape transform must be available');
const landscape=new Function('THREE','scene',source.slice(start,end)+';return landscape;')(THREE,new THREE.Scene());
landscape.updateMatrixWorld(true);
const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)]
 .map(v=>v.applyMatrix4(landscape.matrixWorld).sub(new THREE.Vector3().applyMatrix4(landscape.matrixWorld)));
const sizes=axes.map(v=>v.length());
const ratio=Math.max(...sizes)/Math.min(...sizes);
const shear=Math.max(...axes.flatMap((a,i)=>axes.slice(i+1).map(b=>Math.abs(a.dot(b)/(a.length()*b.length())))));
console.log(JSON.stringify({axisLengths:sizes,aspectRatio:ratio,shearCosine:shear}));
assert(ratio<1.00001,'D island stretches shared fan and building models differently across axes');
assert(shear<0.00001,'D island shears fan circles and building right angles');
assert(landscape.matrixWorld.determinant()>0,'Map orientation must not mirror equipment');
console.log('PASS: D shared fans and architecture retain proportions and right angles.');
