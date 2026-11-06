import {createWaterCoolingFan} from './water-cooling-fan.js?v=warehouse1';

// Small teaching display positions, not an installation drawing or an airflow simulation.
export const EQUIPMENT_VIEWS={
  supply:{target:[7.18,1.85,-.8],direction:[-1,.22,.4],distance:4.0,span:2.8},
  mount:{target:[8.5,2.37,.2],direction:[-.25,-.1,1],distance:2.4,span:1.5},
  warehouse:{target:[9.5,1.5,.6],direction:[.65,.55,1],distance:9.3,span:7.8},
  standing:{target:[11.6,1,1.4],direction:[.65,.55,1],distance:5.7,span:3.5},
  exhaust:{target:[8.8,2.1,-2.16],direction:[.45,.35,-1],distance:3.4,span:1.7},
  wall:{target:[9.42,1.8,2.02],direction:[-.8,.24,1],distance:3.5,span:1.9},
  mobile:{target:[7.4,.7,3.3],direction:[.45,.4,1],distance:3.4,span:1.9},
  watercooler:{target:[10.25,.7,3.25],direction:[.45,.4,1],distance:3.4,span:1.9}
};
export async function createEquipmentDisplay({THREE,parent,keep,material,pickables,box,cyl}) {
  const group=new THREE.Group();group.name='industrial-equipment-display';parent.add(group);
  const devices={},moving=[];
  const configurations={
    exhaust:{width:.78,position:[8.8,2.1,-2.16],rotation:Math.PI},
    mobile:{height:1.08,position:[7.4,.14,3.3],rotation:.12,ground:true},
    wall:{width:1.02,position:[9.42,1.8,2.02],rotation:-Math.PI*3/4}
  };
  await Promise.all(Object.entries(configurations).map(async([id,config])=>{
    const base=new URL('./assets/industrial-fans/',import.meta.url);
    const responses=await Promise.all(['json','bin'].map(extension=>fetch(new URL(`${id}.${extension}`,base))));
    if(responses.some(r=>!r.ok))throw new Error(`Equipment asset unavailable: ${id}`);
    const [data,buffer]=await Promise.all([responses[0].json(),responses[1].arrayBuffer()]);
    const root=new THREE.Group();root.name=`equipment-${id}`;
    const scale=config.width?config.width/(data.bounds.max[0]-data.bounds.min[0]):config.height/(data.bounds.max[1]-data.bounds.min[1]);
    root.scale.setScalar(scale);root.position.fromArray(config.position);root.rotation.y=config.rotation;
    if(config.ground)root.position.y-=data.bounds.min[1]*scale;
    group.add(root);devices[id]=root;
    const rotor=new THREE.Group();rotor.name=`equipment-${id}-rotor`;rotor.position.fromArray(data.rotorPivot);root.add(rotor);
    for(const part of data.meshes){
      const positions=new Float32Array(buffer,part.position.byteOffset,part.position.count).slice();
      if(part.rotor)for(let i=0;i<positions.length;i+=3)for(let axis=0;axis<3;axis++)positions[i+axis]-=data.rotorPivot[axis];
      const geometry=keep(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(buffer,part.normal.byteOffset,part.normal.count),3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,part.index.byteOffset,part.index.count),1));geometry.computeBoundingSphere();
      const surface=material(new THREE.Color(...part.color),{roughness:.62,metalness:.12,side:THREE.DoubleSide});
      const object=new THREE.Mesh(geometry,surface);object.name=`${id}-${part.name}`;object.castShadow=true;object.receiveShadow=true;
      object.userData={topicId:'industry',equipment:id,role:part.rotor?'rotating-part':'fixed-part'};
      (part.rotor?rotor:root).add(object);pickables.push(object);
    }
    moving.push({rotor,axis:new THREE.Vector3().fromArray(data.rotorAxis).normalize()});
  }));
  const watercooler=createWaterCoolingFan({THREE,parent:group,keep,material,pickables});
  watercooler.root.position.set(10.25,.14,3.25);watercooler.root.rotation.y=-.12;devices.watercooler=watercooler.root;
  const pad=material('#d3c7ad'),steel=material('#728880',{metalness:.2});
  cyl(group,7.4,.108,3.3,.60,.04,pad).name='mobile-fan-work-pad';
  box(group,10.25,.108,3.25,.86,.04,.70,pad).name='water-cooler-work-pad';
  // The original rear hanger reaches the front-right exterior column.
  // A two-face saddle fixes the hanger to that corner; the guard faces diagonally into the work bay.
  const mount=new THREE.Group();mount.name='wall-fan-exterior-column-saddle';group.add(mount);
  mount.position.set(9.74,0,2.34);
  for(const y of [2.49,2.61]){
    box(mount,0,y,0,.14,.055,.14,steel).name='wall-fan-column-collar';
    for(const x of [-.085,.085])box(mount,x,y,.085,.035,.035,.055,steel).name='wall-fan-column-clamp-bolt';
  }
  box(mount,-.055,2.585,-.055,.15,.11,.15,steel).name='wall-fan-column-hanger-adapter';
  mount.traverse(object=>{object.userData={topicId:'industry',equipment:'wall',role:'fixed-column-mount'};});
  return {group,devices,moving,update(time){for(const {rotor,axis} of moving)rotor.quaternion.setFromAxisAngle(axis,time*1.1);watercooler.update(time);},dispose(){watercooler.dispose();group.removeFromParent();}};
}
