// Actual STEP assembly, loaded without a browser CAD runtime.
// Installation hardware and motor remain fixed; only the supplied blade assembly turns.
export async function createCeilingFan({THREE,parent,keep,material,pickables,diameter=1.94,top=2.67,topicId='industry'}) {
  const base=new URL('./assets/ceiling-fan/',import.meta.url);
  const responses=await Promise.all(['ceiling-fan.json','ceiling-fan.bin'].map(file=>fetch(new URL(file,base))));
  if(responses.some(r=>!r.ok))throw new Error('Ceiling fan assembly unavailable');
  const [data,buffer]=await Promise.all([responses[0].json(),responses[1].arrayBuffer()]);
  const root=new THREE.Group();root.name='amafans-cad-ceiling-fan';
  root.userData={topicId,source:'user-step-model',mountStyle:'source-assembly'};
  const scale=diameter/(2*data.rotorRadius);
  root.scale.setScalar(scale);root.position.y=top-data.bounds.max[1]*scale;parent.add(root);
  const rotor=new THREE.Group();rotor.name='amafans-fan-rotor';rotor.position.fromArray(data.rotorPivot);
  rotor.userData={topicId,role:'fan-rotor',angularSpeed:.7};root.add(rotor);
  const fixed=new THREE.Group();fixed.name='amafans-fixed-suspension';root.add(fixed);
  for(const part of data.meshes){
    const positions=new Float32Array(buffer,part.position.byteOffset,part.position.count).slice();
    if(part.rotor)for(let i=0;i<positions.length;i+=3)for(let axis=0;axis<3;axis++)positions[i+axis]-=data.rotorPivot[axis];
    const geometry=keep(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(buffer,part.normal.byteOffset,part.normal.count),3));
    const IndexType=part.index.type==='Uint16Array'?Uint16Array:Uint32Array;
    geometry.setIndex(new THREE.BufferAttribute(new IndexType(buffer,part.index.byteOffset,part.index.count),1));geometry.computeBoundingSphere();
    const surface=material(new THREE.Color(...(part.role==='blade'?[.07,.085,.095]:part.role==='tip'?[.95,.32,.055]:part.color)),{roughness:.45,metalness:.35,side:THREE.DoubleSide});
    const object=new THREE.Mesh(geometry,surface);object.name=`ceiling-${part.name}`;
    object.userData={topicId,role:part.rotor?'rotating-part':'fixed-part',component:part.role||part.name};
    object.castShadow=true;object.receiveShadow=true;(part.rotor?rotor:fixed).add(object);pickables.push(object);
  }
  return {root,rotor,fixed,data,scale,update(time){rotor.rotation.y=time*.7;},dispose(){root.removeFromParent();}};
}
