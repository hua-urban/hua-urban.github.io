// The cream-white companion uses the garden's tracked primitives and materials.
// Its round cheeks, short ears and full coat are separate from the original tabby.
export function createCreamCat({ THREE, parent, oval, mesh, cylinder, box, material,
  earGeometry, unitCylinder, keep, routeCurve, shortest }) {
  const root = new THREE.Group();
  root.name = 'cream-white-cat';
  root.scale.setScalar(.97);
  parent.add(root);
  const body = new THREE.Group();
  root.add(body);
  const coat = material('#f2eadb'), white = material('#fff9ed'),
    cap = material('#aa9277'), cheek = material('#b59c7f'), back = material('#a58a6e'),
    innerEar = material('#dfbfb2'), nose = material('#d6a4a1'),
    iris = material('#bba058'), pupil = material('#29291f'),
    rim = material('#786f5d'), mouth = material('#a18e7d');
  // Contact support is evaluated analytically for every rounded part, so rolling
  // to one side never puts a paw, belly or tail below the road/bridge surface.
  const contact = [];
  function round(p, x, y, z, sx, sy, sz, mat) {
    const object = oval(p, x, y, z, sx, sy, sz, mat);
    contact.push({ object, cylinder: false });
    return object;
  }
  function segment(p, a, b, radius, mat) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const delta = to.clone().sub(from);
    const object = mesh(unitCylinder, mat, p);
    object.position.copy(from).add(to).multiplyScalar(.5);
    object.scale.set(radius, delta.length(), radius);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    contact.push({ object, cylinder: true });
    return object;
  }
  const torso = round(body, 0, .315, -.075, .207, .196, .285, back);
  const haunches = round(body, 0, .285, -.235, .202, .183, .17, back);
  round(body, 0, .205, -.055, .175, .115, .257, white);
  round(body, 0, .305, .115, .165, .177, .154, white);
  const head = new THREE.Group();
  head.position.set(0, .49, .215);
  body.add(head);
  round(head, 0, 0, 0, .207, .18, .169, cap);
  // A milk-tea cap hugs the rear/top of the head. Two rounded cheek patches
  // leave a broad cream blaze and muzzle; there are deliberately no stripes.
  round(head, 0, .058, -.041, .196, .145, .139, cap);
  const blazePositions=[],blazeIndices=[];
  for(let row=0;row<=18;row++){
    const t=row/18,y=.155-t*.235,halfWidth=.012+.035*t**1.5;
    for(let col=0;col<=4;col++){
      const x=(col/2-1)*halfWidth,z=.169*Math.sqrt(Math.max(0,1-(x/.207)**2-(y/.18)**2))+.002;
      blazePositions.push(x,y,z);
      if(row<18&&col<4){const i=row*5+col;blazeIndices.push(i,i+5,i+1,i+1,i+5,i+6);}
    }
  }
  const blaze=keep(new THREE.BufferGeometry());blaze.setAttribute('position',new THREE.Float32BufferAttribute(blazePositions,3));blaze.setIndex(blazeIndices);blaze.computeVertexNormals();mesh(blaze,white,head);
  const eyes = [];
  for (const side of [-1, 1]) {
    round(head, side * .143, -.024, .067, .086, .088, .100, cheek);
    const ear = mesh(earGeometry, cap, head, side * .14, .163, -.029);
    ear.scale.set(.087, .15, .075);
    ear.rotation.z = -side * .18;
    const inner = mesh(earGeometry, innerEar, head, side * .14, .169, .017);
    inner.scale.set(.049, .09, .012);
    inner.rotation.z = -side * .18;
    const eye = new THREE.Group();
    eye.position.set(side * .084, .007, .145);
    eye.rotation.y = side * .13;
    head.add(eye);
    eyes.push(eye);
    // Shallow sockets keep the eyes integrated into the face at portrait scale.
    round(eye, 0, 0, 0, .047, .048, .011, rim);
    round(eye, 0, 0, .007, .041, .042, .008, iris);
    round(eye, 0, .001, .014, .027, .032, .004, pupil);
    round(eye, -.01, .014, .019, .008, .009, .002, white);
    round(head, side * .047, -.067, .148, .064, .044, .047, white);
    for (let i = 0; i < 2; i++) {
      segment(head, [side * .071, -.061 - i * .017, .18],
        [side * (.225 + i * .008), -.047 - i * .037, .148], .0017, coat);
    }
  }
  round(head, 0, -.055, .193, .024, .016, .012, nose);
  round(head, 0, -.111, .134, .071, .03, .038, white);
  segment(head, [0, -.069, .192], [0, -.09, .182], .0025, mouth);
  for (const side of [-1, 1]) {
    segment(head, [0, -.09, .182], [side * .019, -.096, .178], .002, mouth);
  }
  const legs = [];
  for (const z of [.145, -.238]) for (const side of [-1, 1]) {
    const joint = new THREE.Group();
    joint.position.set(side * .125, .245, z);
    body.add(joint);
    round(joint, 0, -.085, 0, .057, .105, .06, coat);
    const paw = round(joint, 0, -.201, .026, .063, .04, .078, white);
    legs.push({ joint, paw, side, front: z > 0 });
  }
  // The thick, softly tapered tail curls alongside the full hindquarters.
  const tail = [];
  let tailParent = body;
  for (let i = 0; i < 6; i++) {
    const joint = new THREE.Group();
    joint.position.set(i ? 0 : .025, i ? .076 : .30, i ? 0 : -.31);
    tailParent.add(joint);
    const r = .049 - i * .004;
    round(joint, 0, .04, 0, r, .06, r, i % 2 ? cheek : cap);
    tail.push(joint);
    tailParent = joint;
  }
  const stops = ['center', 'east', 'learning', 'east', 'industry', 'center'];
  const routes = stops.slice(1).map((to, i) => {
    const path = routeCurve(shortest(stops[i], to), 0, .16);
    return { path, duration: path.getLength() / .205 };
  });
  const idle = 5.5;
  const cycle = routes.reduce((sum, route) => sum + route.duration + idle, 0);
  const start = routes[0].duration * .28;
  const smooth = (value, from, to) => THREE.MathUtils.smoothstep(value, from, to);
  function update(elapsed, dt = 0) {
    let phase = ((elapsed + start) % cycle + cycle) % cycle;
    let route = routes[0];
    for (const candidate of routes) {
      route = candidate;
      if (phase < route.duration + idle) break;
      phase -= route.duration + idle;
    }
    const walking = phase < route.duration;
    const progress = Math.min(phase / route.duration, 1);
    root.position.copy(route.path.getPointAt(progress));
    const direction = route.path.getTangentAt(progress);
    const heading = Math.atan2(direction.x, direction.z);
    const delta = Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y));
    root.rotation.y += delta * (dt > 0 ? Math.min(1, dt * 5) : 1);
    const restTime = Math.max(0, phase - route.duration);
    const rest = walking ? 0 : smooth(restTime, .15, 1.25) *
      (1 - smooth(restTime, idle - 1.15, idle));
    const gait = elapsed * 7;
    const stride = walking ? Math.min(1, phase * 2, (route.duration - phase) * 2) : 0;
    // Roll about the long body axis. The front paws fold toward the chest and
    // the rear paws tuck gently, echoing a relaxed sideways sleeping pose.
    body.rotation.z = rest * 1.22;
    body.position.y = 0;
    torso.scale.y = .196 * (1 + Math.sin(elapsed * 1.7) * .012 * rest);
    haunches.scale.y = .183 * (1 + Math.sin(elapsed * 1.7) * .008 * rest);
    legs.forEach(({ joint, paw, side, front }, i) => {
      const wave = Math.sin(gait + (i === 0 || i === 3 ? 0 : Math.PI));
      joint.rotation.x = wave * .27 * stride - rest * (front ? 1.02 : .65);
      joint.rotation.z = rest * (front ? -side * .28 : -side * .16);
      joint.position.x = side * .125 * (1 - rest) + rest * (front ? .09 : .05);
      joint.position.y = .245 + rest * (front ? .018 : -.005);
      paw.rotation.x = rest * .38;
    });
    head.rotation.y = Math.sin(elapsed * .7) * (.04 + rest * .075);
    head.rotation.x = rest * .12;
    head.rotation.z = -rest * .14 + Math.sin(elapsed * .8) * .025;
    head.position.y = .49 - rest * .045;
    const blinkPhase = elapsed % 6.7;
    const blink = blinkPhase < .19 ? 1 - Math.sin(blinkPhase / .19 * Math.PI) * .93 : 1;
    eyes.forEach(eye => { eye.scale.y = blink * (1 - rest * .43); });
    tail.forEach((joint, i) => {
      joint.rotation.x = (i ? -.20 : -1.22) + Math.sin(elapsed * .85 - i * .4) * .035;
      joint.rotation.z = (i ? .24 : .16) * (1 - rest) + rest * (i ? -.15 : -.35) + Math.sin(elapsed * .9 - i * .45) * .065 * (1 - rest * .6);
    });
    root.updateMatrixWorld(true);
    let lowest = Infinity;
    for (const { object, cylinder: isCylinder } of contact) {
      const e = object.matrixWorld.elements;
      // Rounded parts use ellipsoid support; whiskers and mouth use cylinder
      // support so even small facial details stay above the surface.
      const radius=isCylinder?Math.hypot(e[1],e[9])+Math.abs(e[5])*.5:Math.hypot(e[1],e[5],e[9]);
      lowest = Math.min(lowest, e[13] - radius);
    }
    body.position.y = (root.position.y + .006 - lowest) / root.scale.y;
    root.updateMatrixWorld(true);
  }
  update(0);
  return { root, update };
}
