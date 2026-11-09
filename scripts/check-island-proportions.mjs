// Execute the production map transform and measure its effect on model axes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as THREE from '../industry-islands/lib/three.core.js';

const supportedIslands = new Set(['a', 'b', 'c', 'd']);

export function checkIslandProportions(island) {
  const group = String(island).toLowerCase();
  assert(supportedIslands.has(group), 'Usage: node scripts/check-island-proportions.mjs A|B|C|D');

  const sceneFile = new URL(`../industry-islands/${group}/scene.js`, import.meta.url);
  const source = fs.readFileSync(sceneFile, 'utf8');
  const start = source.indexOf('    const landscape = new THREE.Group();');
  const end = source.indexOf('    const mapPoint =', start);
  assert(start >= 0 && end > start, `${group.toUpperCase()} production landscape transform must be available`);

  // Run the production setup statements verbatim, stopping just before mapPoint.
  const landscape = new Function('THREE', 'scene', `${source.slice(start, end)};return landscape;`)(THREE, new THREE.Scene());
  landscape.updateMatrixWorld(true);

  const origin = new THREE.Vector3().applyMatrix4(landscape.matrixWorld);
  const transformVector = vector => vector.clone().applyMatrix4(landscape.matrixWorld).sub(origin);
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ].map(transformVector);
  const axisLengths = axes.map(axis => axis.length());
  const axisLengthRatio = Math.max(...axisLengths) / Math.min(...axisLengths);
  const axisShearCosine = Math.max(...axes.flatMap((a, i) =>
    axes.slice(i + 1).map(b => Math.abs(a.dot(b) / (a.length() * b.length())))));

  // Check a pair of perpendicular model edges rotated 45 degrees around Y.
  const diagonalA = transformVector(new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2));
  const diagonalB = transformVector(new THREE.Vector3(-Math.SQRT1_2, 0, Math.SQRT1_2));
  const rotatedRightAngleCosine = Math.abs(diagonalA.dot(diagonalB) / (diagonalA.length() * diagonalB.length()));
  const determinant = landscape.matrixWorld.determinant();

  const result = {
    island: group.toUpperCase(),
    axisLengths,
    axisLengthRatio,
    axisShearCosine,
    rotatedRightAngleCosine,
    determinant,
  };
  console.log(JSON.stringify(result));

  assert(axisLengthRatio < 1.00001, `${group.toUpperCase()} island scales shared models differently across axes`);
  assert(axisShearCosine < 0.00001, `${group.toUpperCase()} island shears shared models`);
  assert(rotatedRightAngleCosine < 0.00001, `${group.toUpperCase()} island changes rotated model right angles`);
  assert(determinant > 0, 'Map orientation must not mirror equipment');
  console.log(`PASS: ${group.toUpperCase()} shared models retain proportions and right angles.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkIslandProportions(process.argv[2] ?? 'd');
}
