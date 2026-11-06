import {createSupplyWarehouse} from './supply-warehouse.js?v=warehouse1';

// A schematic HVLS display pavilion; dimensions are for the miniature only.
export function createAmaFansPavilion({THREE,root,box,cyl,mesh,material,keep,pickables,buildingPlots}) {
  const pavilion=new THREE.Group();pavilion.name='amafans-pavilion';
  pavilion.position.set(3.5,0,.3);root.add(pavilion);
  pavilion.userData={topicId:'industry',schematic:true};
  const steel=material('#6b7778',{metalness:.35,roughness:.48});
  const black=material('#171b1e',{metalness:.42,roughness:.36});
  const orange=material('#ef791e',{metalness:.18,roughness:.38});
  const silver=material('#adb7bc',{metalness:.8,roughness:.28});
  const roofMaterial=material('#c4edf0',{transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide,roughness:.12,metalness:.12});
  const cladding=material('#e7e2d2',{roughness:.8});
  // Open sides and a clear roof keep both the long suspension and rotor visible.
  const roof=box(pavilion,0,2.73,0,2.7,.025,2.10,roofMaterial);
  roof.name='amafans-transparent-roof';roof.castShadow=false;
  roof.userData={topicId:'industry',role:'transparent-roof',opacity:.34};
  const glassEdge=material('#a0dde7',{transparent:true,opacity:.67,depthWrite:false,roughness:.22});
  const reflectionMaterial=material('#e9ffff',{transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide});
  for(const x of [-1.34,-.45,.45,1.34]) {
    const seam=box(pavilion,x,2.747,0,.013,.009,2.10,glassEdge);
    seam.name='amafans-glass-panel-division';seam.castShadow=false;
  }
  for(const z of [-1.045,1.045]) {
    const edge=box(pavilion,0,2.747,z,2.7,.009,.013,glassEdge);
    edge.name='amafans-glass-roof-edge';edge.castShadow=false;
  }
  for(const x of [-.83,.06,.95]) {
    const reflection=box(pavilion,x,2.751,-.16,.045,.002,1.5,reflectionMaterial);
    reflection.rotation.y=-.25;reflection.name='amafans-glass-reflection';reflection.castShadow=false;
  }
  for(const x of [-1.24,1.24])for(const z of [-.94,.94]) {
    box(pavilion,x,1.41,z,.055,2.56,.055,steel).name='amafans-steel-column';
    box(pavilion,x,.14,z,.16,.08,.16,steel);
  }
  for(const z of [-.96,.96])box(pavilion,0,2.66,z,2.58,.075,.055,steel);
  for(const x of [-1.26,1.26])box(pavilion,x,2.66,0,.055,.075,1.98,steel);
  // Low factory cladding anchors the pavilion while leaving the rotor and rod exposed.
  box(pavilion,1.24,.58,0,.055,.9,1.88,cladding).name='amafans-side-knee-wall';
  for(const z of [-.7,-.35,0,.35,.7])box(pavilion,1.272,.58,z,.012,.86,.012,steel);
  // Slim overhead mounting rails do not form an opaque ceiling slab.
  for(const z of [-.15,.15])box(pavilion,0,2.67,z,2.5,.035,.025,steel);
  const suspension=new THREE.Group();suspension.name='amafans-fixed-suspension';pavilion.add(suspension);
  cyl(suspension,0,2.63,0,.12,.07,black).name='amafans-top-mount';
  const shaftReduction=1.01/3;
  const shaftLength=1.01-shaftReduction;
  const downrod=cyl(suspension,0,2.10+shaftReduction/2,0,.027,shaftLength,black);
  downrod.name='amafans-long-downrod';downrod.userData={topicId:'industry',role:'downrod',length:shaftLength,originalLength:1.01,reduction:shaftReduction};
  cyl(suspension,0,1.61+shaftReduction,0,.063,.095,black);
  const motor=mesh(keep(new THREE.SphereGeometry(1,24,14)),black,suspension,0,1.545+shaftReduction,0);
  motor.scale.set(.155,.092,.155);motor.name='amafans-rounded-motor';
  for(const [r,y] of [[.127,1.478],[.096,1.462],[.06,1.45]]) {
    const ring=mesh(keep(new THREE.TorusGeometry(r,.008,6,32)),silver,suspension,0,y+shaftReduction,0);
    ring.rotation.x=Math.PI/2;ring.name='amafans-silver-motor-ring';
  }
  const rotor=new THREE.Group();rotor.position.y=1.49+shaftReduction;rotor.name='amafans-fan-rotor';
  rotor.userData={topicId:'industry',role:'fan-rotor',bladeCount:5,angularSpeed:.7};pavilion.add(rotor);
  cyl(rotor,0,0,0,.118,.036,black).name='amafans-rotating-hub';
  // Long narrow airfoil silhouettes with raised orange winglets match the reference.
  const profile=new THREE.Shape();
  profile.moveTo(.115,-.037);profile.lineTo(.81,-.055);profile.quadraticCurveTo(.91,-.055,.932,-.035);
  profile.lineTo(.932,.045);profile.quadraticCurveTo(.88,.064,.79,.057);profile.lineTo(.115,.035);profile.closePath();
  const bladeGeometry=keep(new THREE.ExtrudeGeometry(profile,{depth:.015,bevelEnabled:false,steps:1,curveSegments:5}));
  bladeGeometry.rotateX(Math.PI/2);
  for(let i=0;i<5;i++) {
    const blade=new THREE.Group();blade.name=`amafans-blade-${i+1}`;blade.rotation.y=i*Math.PI*2/5;
    blade.userData={topicId:'industry',role:'fan-blade',index:i+1};rotor.add(blade);
    mesh(bladeGeometry,black,blade).name='amafans-black-airfoil';
    const tip=box(blade,.923,.002,.003,.075,.021,.105,orange);tip.name='amafans-orange-tip';
    const winglet=box(blade,.95,.036,.003,.021,.08,.105,orange);
    winglet.rotation.z=-.18;winglet.name='amafans-orange-winglet';
  }
  const warehouse=createSupplyWarehouse({THREE,pavilion,material,keep,mesh});
  buildingPlots.push({x:root.position.x+pavilion.position.x,z:root.position.z+pavilion.position.z,w:2.7,d:2.10});
  // The supplied physical badge photograph preserves the exact wordmark and pin outline.
  let disposed=false;
  const badgeMaterial=new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false});
  const badgeTexture=new THREE.TextureLoader().load(new URL('./assets/amafans-badge.png',import.meta.url).href,texture=>{
    if(disposed){texture.dispose();return;}
    texture.colorSpace=THREE.SRGBColorSpace;badgeMaterial.needsUpdate=true;
  });
  badgeTexture.colorSpace=THREE.SRGBColorSpace;badgeMaterial.map=badgeTexture;
  const sign=mesh(keep(new THREE.PlaneGeometry(1.85,.925)),badgeMaterial,pavilion,1.295,.92,0);
  sign.rotation.y=Math.PI/2;sign.name='amafans-side-brand-sign';sign.castShadow=false;
  sign.userData={topicId:'industry',role:'brand-sign',externalUrl:'https://www.amafans.com/',externalURL:'https://www.amafans.com/',badgeStyle:'exact-photo-cutout'};
  pickables.push(sign);
  const badges=[sign];
  pavilion.traverse(object=>{object.userData.topicId='industry';if(object.isMesh&&!object.userData.externalUrl)pickables.push(object);});
  return {pavilion,rotor,roof,downrod,badges,warehouse,dispose(){if(disposed)return;disposed=true;warehouse.dispose();badgeTexture.dispose();badgeMaterial.dispose();}};
}
