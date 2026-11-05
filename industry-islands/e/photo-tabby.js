import { createCatWalker } from './cat-walker.js?v=walk1';
// A separate photo-reference tabby shares the original's tracked geometry while
// owning its pose and coat materials. The original actor is never animated here.
export function createPhotoTabby({ THREE, parent, source, parts, palette,
  earGeometry, material, routeCurve, shortest }) {
  const root = source.clone(true);
  root.rotation.set(0,0,0);
  root.name = 'round-tabby-cat';
  root.scale.setScalar(.94);
  parent.add(root);
  const originalNodes = [], clonedNodes = [];
  source.traverse(node => originalNodes.push(node));
  root.traverse(node => clonedNodes.push(node));
  const mapped = new Map(originalNodes.map((node, index) => [node, clonedNodes[index]]));
  const coatColors = {
    fur: '#826f58', darkFur: '#302b24', faceFur: '#95816a',
    chestFur: '#a18c70', lightFur: '#e8dac2', earPink: '#bb9482',
    nosePink: '#ad8372', catEye: '#b5a15a', pupil: '#1e241b',
  };
  const materials = new Map(Object.entries(coatColors).map(([key, color]) =>
    [palette[key], material(color)]));
  root.traverse(node => {
    if (!node.isMesh) return;
    node.material = Array.isArray(node.material)
      ? node.material.map(value => materials.get(value) || value)
      : materials.get(node.material) || node.material;
  });
  const body = mapped.get(parts.body), torso = mapped.get(parts.torso),
    chest = mapped.get(parts.chest), head = mapped.get(parts.head),
    legs = parts.legs.map(node => mapped.get(node)),
    tail = parts.tail.map(node => mapped.get(node)),
    eyes = parts.eyes.map(node => mapped.get(node));
  // Expand the torso group so coat stripes follow the fuller silhouette.
  torso.scale.set(1.14, 1.06, 1.04);
  head.scale.set(1.12, 1.055, 1.035);
  chest.scale.x *= 1.09;
  const chestScaleY = chest.scale.y;
  const stops = ['finance', 'land', 'industry', 'east', 'center', 'finance'];
  const routes = stops.slice(1).map((to, index) => {
    const path = routeCurve(shortest(stops[index], to), 0, .16);
    return { path, duration: path.getLength() / .195 };
  });
  const idle = 5.1;
  const walker=createCatWalker({root,routes,speed:.195,idle,startProgress:.62});
  const smooth = (value, from, to) => THREE.MathUtils.smoothstep(value, from, to);
  function update(elapsed, dt = 0) {
    const motion=walker.update(dt),{walking,progress}=motion;
    const route=routes[motion.routeIndex],phase=progress*route.duration;
    const timeAtStop=motion.idleTime;
    const sitting = walking||motion.turning ? 0 : smooth(timeAtStop, 0, .9) *
      (1 - smooth(timeAtStop, idle - .85, idle));
    const stride = walking ? Math.min(1, phase * 3, (route.duration - phase) * 3) : 0;
    const gait = elapsed * 6.7;
    body.position.y = Math.sin(gait * 2) * .005 * stride;
    body.rotation.set(0, 0, 0);
    torso.position.y = .315 - sitting * .026;
    torso.scale.y = 1.06 + sitting * .17;
    torso.scale.z = 1.04 - sitting * .14;
    chest.position.y = .29 + sitting * .059;
    chest.scale.y = chestScaleY * (1 + sitting * .075 + Math.sin(elapsed * 1.8) * sitting * .012);
    head.position.y = .465 + sitting * .07;
    head.rotation.x = sitting * (.035 + Math.sin(timeAtStop * .8) * .035);
    head.rotation.y = Math.sin(elapsed * .72) * (.035 + sitting * .16);
    head.rotation.z = sitting * (-.19 + Math.sin(timeAtStop * 1.05) * .04);
    legs.forEach((leg, index) => {
      leg.rotation.x = Math.sin(gait + (index === 0 || index === 3 ? 0 : Math.PI)) * .27 * stride -
        (index > 1 ? sitting * .53 : 0);
      leg.rotation.z = index > 1 ? (index % 2 ? -.08 : .08) * sitting : 0;
      leg.position.y = .245 - (index > 1 ? sitting * .006 : 0);
    });
    const blinkPhase = (elapsed + 1.3) % 7.1;
    const blink = blinkPhase < .18 ? 1 - Math.sin(blinkPhase / .18 * Math.PI) * .92 : 1;
    eyes.forEach(eye => { eye.scale.y = blink; });
    tail.forEach((joint, index) => {
      joint.rotation.x = (index ? -.14 : -.9) + sitting * (index ? -.06 : -.24) +
        Math.sin(elapsed * .8 - index * .4) * .035;
      joint.rotation.z = Math.sin(elapsed * .95 - index * .5) * (.07 + index * .016) + sitting * .08;
    });
  }
  update(0);
  return { root, update };
}
