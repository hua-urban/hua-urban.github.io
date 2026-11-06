// Lightweight mesh derived locally from the supplied STEP assembly; no CAD runtime needed.
export async function createStandingFanTable({THREE,parent,keep,material,pickables}) {
  const base=new URL('./assets/standing-fan-table/',import.meta.url);
  const responses=await Promise.all(['standing-fan-table.json','standing-fan-table.bin'].map(file=>fetch(new URL(file,base))));
  if(responses.some(response=>!response.ok))throw new Error('Standing fan table asset could not be loaded');
  const [data,buffer]=await Promise.all([responses[0].json(),responses[1].arrayBuffer()]);
  const root=new THREE.Group();root.name='sunny-standing-fan-table';root.userData={topicId:'industry',source:'user-step-model'};
  const scale=1.9/(data.bounds.max[1]-data.bounds.min[1]);
  root.scale.setScalar(scale);root.position.set(11.6,.14-data.bounds.min[1]*scale,1.4);
  root.rotation.y=.12;parent.add(root);
  const rotor=new THREE.Group();rotor.name='sunny-standing-fan-rotor';rotor.position.fromArray(data.rotorPivot);root.add(rotor);
  for(const part of data.meshes){
    // Rotor geometry uses the same CAD coordinate frame; rebase only rotating parts.
    const positions=new Float32Array(buffer,part.position.byteOffset,part.position.count).slice();
    if(part.rotor)for(let i=0;i<positions.length;i+=3)for(let axis=0;axis<3;axis++)positions[i+axis]-=data.rotorPivot[axis];
    const geometry=keep(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(buffer,part.normal.byteOffset,part.normal.count),3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,part.index.byteOffset,part.index.count),1));
    geometry.computeBoundingSphere();
    const surface=material(new THREE.Color(...part.color),{roughness:.55,metalness:.12,side:THREE.DoubleSide});
    const object=new THREE.Mesh(geometry,surface);object.name=`sunny-${part.name}`;
    object.castShadow=true;object.receiveShadow=true;object.userData={topicId:'industry',role:part.rotor?'sunny-rotating-part':'sunny-fixed-part'};
    (part.rotor?rotor:root).add(object);pickables.push(object);
  }
  const axis=new THREE.Vector3().fromArray(data.rotorAxis).normalize();
  return {root,rotor,update(time){rotor.quaternion.setFromAxisAngle(axis,time*1.1);},dispose(){root.removeFromParent();}};
}
