// Compact AW-150-inspired miniature based on the official product photo.
// This is a visual schematic, not certified product geometry.
export function createWaterCoolingFan({THREE,parent,keep,material,pickables}) {
  const root=new THREE.Group();
  root.name='industry-aw150-water-cooling-fan';
  root.userData={topicId:'industry',role:'watercooler',source:'aw150-product-photo',schematic:true};
  parent.add(root);

  const cabinet=material('#d7d8d3',{roughness:.92});
  const edge=material('#eeeae0',{roughness:.9});
  const tank=material('#303435',{roughness:.88});
  const outlet=material('#191c1d',{roughness:.9});
  const grille=material('#393d3d',{roughness:.8});
  const rotorBlade=material('#17191a',{roughness:.9});
  const louvers=material('#4b3e33',{roughness:.9});
  const silver=material('#aeb4b1',{metalness:.48,roughness:.5});
  const rubber=material('#242829',{roughness:.95});

  const boxGeometry=keep(new THREE.BoxGeometry(1,1,1));
  const wheelGeometry=keep(new THREE.CylinderGeometry(.5,.5,1,12));
  const boxParts=new Map();
  const finiteParts=[];
  const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
  function rememberBounds(x,y,z,w,h,d) {
    const values=[x,y,z,w,h,d];
    if(!values.every(Number.isFinite)||w<=0||h<=0||d<=0)throw new Error('AW-150 schematic contains a non-finite part');
    bounds.minX=Math.min(bounds.minX,x-w/2);bounds.maxX=Math.max(bounds.maxX,x+w/2);
    bounds.minY=Math.min(bounds.minY,y-h/2);bounds.maxY=Math.max(bounds.maxY,y+h/2);
    bounds.minZ=Math.min(bounds.minZ,z-d/2);bounds.maxZ=Math.max(bounds.maxZ,z+d/2);
    finiteParts.push(values);
  }
  function addBox(mat,x,y,z,w,h,d,rx=0,ry=0,rz=0) {
    rememberBounds(x,y,z,w,h,d);
    if(!boxParts.has(mat))boxParts.set(mat,[]);
    boxParts.get(mat).push({x,y,z,w,h,d,rx,ry,rz});
  }
  const cube=new THREE.Object3D();
  const meshes=[];
  function addInstances(name,geometry,mat,items,parentGroup=root) {
    if(!items.length)return null;
    const batch=new THREE.InstancedMesh(geometry,mat,items.length);
    batch.name=name;batch.castShadow=true;batch.receiveShadow=true;
    parentGroup.add(batch);meshes.push(batch);
    items.forEach((part,index)=>{
      cube.position.set(part.x,part.y,part.z);
      cube.rotation.set(part.rx||0,part.ry||0,part.rz||0);
      cube.scale.set(part.w,part.h,part.d);
      cube.updateMatrix();batch.setMatrixAt(index,cube.matrix);
    });
    batch.instanceMatrix.needsUpdate=true;
    batch.computeBoundingBox();batch.computeBoundingSphere();
    pickables.push(batch);
    return batch;
  }

  // Light upper cabinet and its narrow corner trim.
  addBox(cabinet,0,.655,0,.64,.78,.42);
  for(const x of [-.312,.312])for(const z of [-.207,.207])addBox(edge,x,.655,z,.012,.77,.012);
  // Dark water tank and its understated lower front inset.
  addBox(tank,0,.165,0,.60,.20,.40);
  addBox(outlet,0,.165,.203,.48,.145,.006);

  // Square black air outlet. Blades sit behind the grille and remain subtle.
  const outletY=.735;
  addBox(outlet,0,outletY,.214,.47,.42,.009);
  const grilleBars=[];
  const grilleWidth=.434,grilleHeight=.382;
  for(let i=0;i<13;i++)grilleBars.push({x:-grilleWidth/2+i*grilleWidth/12,y:outletY,z:.226,w:.0055,h:grilleHeight,d:.004});
  for(let i=0;i<12;i++)grilleBars.push({x:0,y:outletY-grilleHeight/2+i*grilleHeight/11,z:.226,w:grilleWidth,h:.0055,d:.004});

  // Center crossbar over the outlet and a slim divider across the cabinet front.
  addBox(silver,0,outletY,.232,.47,.014,.007);
  addBox(silver,0,.485,.214,.64,.018,.008);

  // Dark brownish horizontal air-intake louvers on the right side.
  for(let i=0;i<9;i++)addBox(louvers,.322,.39+i*.064,0,.004,.012,.285);

  // Four small fixed casters. They are only children of the moving model root.
  const wheelItems=[];
  for(const x of [-.235,.235])for(const z of [-.145,.145]) {
    wheelItems.push({x,y:.038,z,w:.07,h:.02,d:.07,rz:Math.PI/2});
    rememberBounds(x,.038,z,.02,.07,.07);
    addBox(tank,x,.072,z,.047,.035,.048);
  }

  for(const [mat,items] of boxParts)addInstances(
    mat===cabinet?'industry-aw150-offwhite-cabinet':mat===edge?'industry-aw150-corner-trim':mat===tank?'industry-aw150-charcoal-water-tank':mat===outlet?'industry-aw150-black-panels':mat===silver?'industry-aw150-silver-crossbars':'industry-aw150-right-intake-louvers',
    boxGeometry,mat,items
  );
  addInstances('industry-aw150-fine-front-grille',boxGeometry,grille,grilleBars);
  addInstances('industry-aw150-four-caster-wheels',wheelGeometry,rubber,wheelItems);

  // A simple, low-contrast four-blade fan is visible only through the grille.
  const rotor=new THREE.Group();
  rotor.name='industry-aw150-internal-rotor';
  rotor.position.set(0,outletY,.220);
  rotor.userData={topicId:'industry',role:'watercooler',part:'internal-rotor'};
  root.add(rotor);
  const bladeItems=[];
  for(let i=0;i<4;i++) {
    const angle=i*Math.PI/2+Math.PI/4;
    bladeItems.push({x:Math.cos(angle)*.105,y:Math.sin(angle)*.105,z:0,w:.17,h:.052,d:.003,rz:angle});
  }
  addInstances('industry-aw150-dark-internal-blades',boxGeometry,rotorBlade,bladeItems,rotor);
  addInstances('industry-aw150-internal-rotor-hub',boxGeometry,grille,[{x:0,y:0,z:.001,w:.052,h:.052,d:.006}],rotor);

  root.traverse(object=>{
    if(object.isMesh) {
      object.userData={...object.userData,topicId:'industry',role:'watercooler'};
      object.castShadow=true;object.receiveShadow=true;
    }
  });
  if(!finiteParts.length||!Object.values(bounds).every(Number.isFinite)||bounds.minY<-.001||bounds.maxY>1.06) {
    root.removeFromParent();
    throw new Error('AW-150 schematic bounds are invalid');
  }
  root.userData.bounds={...bounds};
  const triangles=mesh=>((mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3)*(mesh.count||1);
  root.userData.counts={parts:finiteParts.length,drawCalls:meshes.length,approxTriangles:meshes.reduce((sum,mesh)=>sum+triangles(mesh),0)};

  let disposed=false;
  return {
    root,
    rotor,
    update(time) {
      if(!disposed&&Number.isFinite(time))rotor.rotation.z=time*.9;
    },
    dispose() {
      if(disposed)return;
      disposed=true;
      for(const object of meshes) {
        const index=pickables.indexOf(object);
        if(index!==-1)pickables.splice(index,1);
      }
      root.removeFromParent();
    }
  };
}
