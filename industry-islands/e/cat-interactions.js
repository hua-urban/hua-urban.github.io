// Additive cat gestures. Route clocks are frozen while a gesture owns the pose.
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const blend = (a, b, t) => a + (b - a) * t;

export function createCatInteractions({ actors, random = Math.random, soundEnabled = true }) {
  const interval = () => 18 + Math.max(0, Math.min(1, random())) * 22;
  const cats = actors.map(actor => {
    const body = actor.root.getObjectByName('cat-body');
    const nodes = [];
    if (body) body.traverse(node => {
      if (node === body || /^cat-(head|torso|chest|hips|leg-|tail-)/.test(node.name)) nodes.push(node);
    });
    const contact = [];
    if (body) body.traverse(node => {
      const type = node.geometry?.type;
      if (['SphereGeometry', 'IcosahedronGeometry', 'CylinderGeometry'].includes(type)) contact.push(node);
    });
    return { actor, body, nodes, contact, groundY: actor.root.position.y,
      clock: 0, nextScratch: interval(), action: null };
  });
  let disposed = false, audioContext = null, sound = null;

  function restore(cat) {
    if (!cat.action) return;
    for (const pose of cat.action.poses) {
      pose.node.position.copy(pose.position);
      pose.node.quaternion.copy(pose.quaternion);
      pose.node.scale.copy(pose.scale);
    }
    cat.actor.root.updateMatrixWorld(true);
  }
  function begin(cat, mode, side) {
    restore(cat);
    cat.groundY=cat.actor.root.position.y;
    const poses = cat.nodes.map(node => ({ node, position: node.position.clone(),
      quaternion: node.quaternion.clone(), rotation: node.rotation.clone(), scale: node.scale.clone() }));
    const baseRoll=cat.body.rotation.z;
    const direction=Math.abs(baseRoll)>.5?Math.sign(baseRoll):side===-1||side===1?side:random()<.5?-1:1;
    cat.action = { mode, time: 0, duration: mode === 'scratch' ? 2.6 : 6,
      direction, poses };
  }
  function support(cat) {
    const root = cat.actor.root;
    root.updateMatrixWorld(true);
    let lowest = Infinity;
    for (const node of cat.contact) {
      const e = node.matrixWorld.elements, p = node.geometry.parameters || {};
      const radius = node.geometry.type === 'CylinderGeometry'
        ? Math.max(p.radiusTop ?? 1, p.radiusBottom ?? 1) * Math.hypot(e[1], e[9]) + (p.height ?? 1) * .5 * Math.abs(e[5])
        : (p.radius ?? 1) * Math.hypot(e[1], e[5], e[9]);
      lowest = Math.min(lowest, e[13] - radius);
    }
    // Body local Y maps to world Y even when the body itself rolls about Z.
    const parentY = cat.body.parent.matrixWorld.elements[5];
    if (Number.isFinite(lowest) && Math.abs(parentY) > 1e-8) {
      cat.body.position.y += Math.max(0, cat.groundY + .008 - lowest) / parentY;
      root.updateMatrixWorld(true);
    }
  }
  function pose(cat) {
    const action = cat.action, t = action.time;
    restore(cat);
    const weight = action.mode === 'scratch'
      ? smooth(t / .4) * smooth((action.duration - t) / .45)
      : smooth(t / .5) * smooth((action.duration - t) / .6);
    // Like a resting cat: crouch, settle onto a flank, then open the belly a
    // little. Never rotate the whole standing figure straight through 180°.
    const side=smooth((t-.45)/.9)*smooth((action.duration-.6-t)/.9);
    const belly=smooth((t-1.35)/.85)*smooth((action.duration-1.4-t)/.85);
    const bodyBase=action.poses.find(base=>base.node===cat.body);
    const roll=blend(blend(bodyBase.rotation.z,action.direction*1.15,side),action.direction*2.05,belly);
    for (const base of action.poses) {
      const node = base.node, name = node.name;
      if (action.mode === 'scratch') {
        if (name === 'cat-leg-back-right') {
          // Lift the hind paw toward the neck, then make short scratching strokes.
          node.rotation.x += weight * (-1.65 + Math.sin(t * 28) * .12);
          node.rotation.z += weight * -.48;
          node.position.y += weight * .11;
          node.position.z += weight * .16;
        } else if (name === 'cat-head') {
          node.rotation.z += weight * -.17;
          node.rotation.y += weight * .1;
        } else if (name === 'cat-body') node.rotation.z += weight * .035;
      } else {
        if (name === 'cat-body') {
          node.rotation.z=roll;
          // Roll about the torso, rather than orbiting around the feet.
          node.position.x+=.3*(Math.sin(roll)-Math.sin(base.rotation.z));
          node.position.y+=.3*(Math.cos(base.rotation.z)-Math.cos(roll))-.07*weight-.05*side-.015*belly;
        }
        else if (name.startsWith('cat-leg-')) {
          const front = name.includes('-front-');
          const pawSide = name.endsWith('-right') ? 1 : -1;
          const folded=blend(front?-.8:-.9,front?-1.05:-.58,belly);
          node.rotation.x=blend(base.rotation.x,folded,weight)+Math.sin(t*5+pawSide)*.035*belly;
          node.rotation.z=blend(base.rotation.z,-pawSide*.22,side);
          node.position.x=blend(base.position.x,action.direction*.07+pawSide*.03,side);
        } else if (name === 'cat-head') {
          node.position.y=blend(base.position.y,.335,side);
          node.position.z+=side*.055;
          node.rotation.x=blend(base.rotation.x,-.06,side);
          node.rotation.z=blend(base.rotation.z,action.direction*.55-roll,side);
        } else if(name==='cat-torso'){
          node.scale.y=base.scale.y*(1+.04*side+Math.sin(t*1.7)*.008*belly);
          node.scale.z=base.scale.z*(1-.08*side);
        } else if(name==='cat-chest'){
          node.position.y-=side*.035;
          node.position.z+=side*.025;
        } else if (name.startsWith('cat-tail-')) {
          const first=name.endsWith('-0');
          node.rotation.x=blend(base.rotation.x,first?-1.3:-.2,side);
          node.rotation.z=blend(base.rotation.z,-action.direction*(first?.28:.14),side)+Math.sin(t*2)*.025*belly;
        }
      }
    }
    support(cat);
  }
  function stopSound() {
    if (!sound) return;
    const current = sound;
    sound = null;
    for (const source of current.sources) { try { source.stop(); } catch {} }
    for (const node of current.nodes) { try { node.disconnect(); } catch {} }
  }
  function playPurr() {
    stopSound();
    try {
      // Only called synchronously from pet(), which the host calls on a click.
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      if (!audioContext || audioContext.state === 'closed') audioContext = new Audio();
      if (audioContext.state === 'suspended') audioContext.resume()?.catch(() => {});
      const ctx = audioContext, start = ctx.currentTime, end = start + 3.15;
      const carrier = ctx.createOscillator(), harmonic = ctx.createOscillator(), pulse = ctx.createOscillator();
      const filter = ctx.createBiquadFilter(), envelope = ctx.createGain(), modulation = ctx.createGain();
      carrier.type = 'triangle'; carrier.frequency.value = 57;
      harmonic.type = 'sine'; harmonic.frequency.value = 114;
      pulse.type = 'sine'; pulse.frequency.value = 25;
      filter.type = 'lowpass'; filter.frequency.value = 190; filter.Q.value = .4;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(.018, start + .3);
      envelope.gain.setValueAtTime(.018, end - .55);
      envelope.gain.linearRampToValueAtTime(0, end);
      modulation.gain.setValueAtTime(0, start);
      modulation.gain.linearRampToValueAtTime(.007, start + .3);
      modulation.gain.setValueAtTime(.007, end - .55);
      modulation.gain.linearRampToValueAtTime(0, end);
      carrier.connect(filter); harmonic.connect(filter); filter.connect(envelope); envelope.connect(ctx.destination);
      pulse.connect(modulation); modulation.connect(envelope.gain);
      const current = { sources: [carrier, harmonic, pulse], nodes: [carrier, harmonic, pulse, filter, envelope, modulation] };
      sound = current;
      carrier.onended = () => {
        current.nodes.forEach(node => { try { node.disconnect(); } catch {} });
        if (sound === current) sound = null;
      };
      for (const source of current.sources) { source.start(start); source.stop(end); }
    } catch { stopSound(); }
  }
  function pet(id, {side} = {}) {
    if (disposed) return false;
    const cat = cats.find(item => item.actor.root.name === id);
    if (!cat?.body) return false;
    begin(cat, 'belly',side);
    if(soundEnabled)playPurr();
    return true;
  }
  function update(elapsed, dt = 0) {
    if (disposed || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .05);
    for (const cat of cats) {
      cat.clock += dt;
      if (!cat.action) {
        if (cat.body && cat.clock >= cat.nextScratch) {
          if (Math.abs(cat.body.rotation.z) < .15) begin(cat, 'scratch');
          else cat.nextScratch = cat.clock + .6;
        }
        if (!cat.action) { cat.actor.update(elapsed, dt); continue; }
      }
      cat.action.time = Math.min(cat.action.duration, cat.action.time + dt);
      if (cat.action.time >= cat.action.duration - 1e-9) {
        restore(cat);
        cat.action = null;
        cat.nextScratch = cat.clock + interval();
      } else pose(cat);
    }
  }
  function dispose() {
    if (disposed) return;
    cats.forEach(cat => { restore(cat); cat.action = null; });
    stopSound();
    if (audioContext) { try { audioContext.close()?.catch(() => {}); } catch {} }
    audioContext = null;
    disposed = true;
  }
  return { update, pet, stopSound, dispose,
    getState: () => cats.map(cat => ({ name: cat.actor.root.name, action: cat.action?.mode ?? null,
      elapsed: cat.action?.time ?? 0, nextScratch: cat.nextScratch, clock: cat.clock })) };
}
