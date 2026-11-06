// A schematic HVLS display pavilion; dimensions are for the miniature only.
export function createAmaFansPavilion({THREE,root,box,cyl,mesh,material,keep,pickables,buildingPlots}) {
  const pavilion=new THREE.Group();pavilion.name='amafans-pavilion';
  pavilion.position.set(.15,0,-.05);root.add(pavilion);
  pavilion.userData={topicId:'industry',schematic:true};
  const steel=material('#6b7778',{metalness:.35,roughness:.48});
  const black=material('#171b1e',{metalness:.42,roughness:.36});
  const orange=material('#ef791e',{metalness:.18,roughness:.38});
  const silver=material('#adb7bc',{metalness:.8,roughness:.28});
  const roofMaterial=material('#c4edf0',{transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,roughness:.22,metalness:.05});
  const bagMaterial=material('#f1ecdf');
  const palletMaterial=material('#a58159');
  const cladding=material('#e7e2d2',{roughness:.8});
  // Open sides and a clear roof keep both the long suspension and rotor visible.
  const roof=box(pavilion,0,2.73,0,2.7,.025,2.10,roofMaterial);
  roof.name='amafans-transparent-roof';roof.castShadow=false;
  roof.userData={topicId:'industry',role:'transparent-roof',opacity:.18};
  for(const x of [-1.24,1.24])for(const z of [-.94,.94]) {
    box(pavilion,x,1.41,z,.055,2.56,.055,steel).name='amafans-steel-column';
    box(pavilion,x,.14,z,.16,.08,.16,steel);
  }
  for(const z of [-.96,.96])box(pavilion,0,2.66,z,2.58,.075,.055,steel);
  for(const x of [-1.26,1.26])box(pavilion,x,2.66,0,.055,.075,1.98,steel);
  // Low factory cladding anchors the pavilion while leaving the rotor and rod exposed.
  const rearWall=new THREE.Group();rearWall.name='amafans-low-rear-wall';pavilion.add(rearWall);
  box(rearWall,-.945,.55,-.94,.59,.84,.055,cladding);
  box(rearWall,1.02,.55,-.94,.44,.84,.055,cladding);
  box(pavilion,1.24,.58,0,.055,.9,1.88,cladding).name='amafans-side-knee-wall';
  for(const z of [-.7,-.35,0,.35,.7])box(pavilion,1.272,.58,z,.012,.86,.012,steel);
  for(const x of [.40,1.08])box(pavilion,x,.5,.968,.025,.74,.025,steel).name='amafans-front-sign-support';
  // Slim overhead mounting rails do not form an opaque ceiling slab.
  for(const z of [-.15,.15])box(pavilion,0,2.67,z,2.5,.035,.025,steel);
  const suspension=new THREE.Group();suspension.name='amafans-fixed-suspension';pavilion.add(suspension);
  cyl(suspension,0,2.63,0,.12,.07,black).name='amafans-top-mount';
  const downrod=cyl(suspension,0,2.10,0,.027,1.01,black);
  downrod.name='amafans-long-downrod';downrod.userData={topicId:'industry',role:'downrod',length:1.01};
  cyl(suspension,0,1.61,0,.063,.095,black);
  const motor=mesh(keep(new THREE.SphereGeometry(1,24,14)),black,suspension,0,1.545,0);
  motor.scale.set(.155,.092,.155);motor.name='amafans-rounded-motor';
  for(const [r,y] of [[.127,1.478],[.096,1.462],[.06,1.45]]) {
    const ring=mesh(keep(new THREE.TorusGeometry(r,.008,6,32)),silver,suspension,0,y,0);
    ring.rotation.x=Math.PI/2;ring.name='amafans-silver-motor-ring';
  }
  const rotor=new THREE.Group();rotor.position.y=1.49;rotor.name='amafans-fan-rotor';
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
  // FIBC bags on a compact loading pallet stay within the original district plot.
  box(pavilion,-.97,.19,.53,.48,.08,.55,palletMaterial);
  for(const z of [.39,.65]) {
    const bag=box(pavilion,-.97,.40,z,.32,.34,.23,bagMaterial);bag.name='industry-fibc-bag';
    for(const x of [-1.07,-.87]) {
      const loop=mesh(keep(new THREE.TorusGeometry(.035,.008,5,12,Math.PI)),bagMaterial,pavilion,x,.58,z);
      loop.name='industry-fibc-lifting-loop';
    }
  }
  buildingPlots.push({x:root.position.x+.15,z:root.position.z-.05,w:2.7,d:2.10});
  // One owned canvas texture is shared by two facade signs, including the +x side.
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=300;
  const context=canvas.getContext('2d');
  const signTexture=new THREE.CanvasTexture(canvas);signTexture.colorSpace=THREE.SRGBColorSpace;
  const signMaterial=material('#ffffff',{map:signTexture,roughness:.7,side:THREE.DoubleSide});
  let disposed=false;
  function paint(logo) {
    context.fillStyle='#f6f3e9';context.fillRect(0,0,1024,300);
    if(logo)context.drawImage(logo,56,10,912,912*151/640);
    else {context.fillStyle='#505452';context.font='bold 148px Arial, sans-serif';context.fillText('AmaFans',90,180);}
    context.fillStyle='#3d474a';context.textAlign='center';context.font='52px Arial, sans-serif';
    context.fillText('www.amafans.com',512,279);context.textAlign='start';signTexture.needsUpdate=true;
  }
  paint();
  const logo=new Image();logo.onload=()=>{if(!disposed)paint(logo);};
  logo.src=new URL('./assets/amafans-logo.png',import.meta.url).href;
  for(const [name,x,z,width,rotation] of [['side',1.281,0,1.75,Math.PI/2],['front',.74,.991,.82,0]]) {
    const sign=mesh(keep(new THREE.PlaneGeometry(width,width*300/1024)),signMaterial,pavilion,x,.65,z);
    sign.rotation.y=rotation;sign.name=`amafans-${name}-brand-sign`;sign.castShadow=false;
    sign.userData={topicId:'industry',role:'brand-sign',externalUrl:'https://www.amafans.com/'};pickables.push(sign);
  }
  pavilion.traverse(object=>{object.userData.topicId='industry';if(object.isMesh&&!object.userData.externalUrl)pickables.push(object);});
  return {rotor,dispose(){disposed=true;logo.onload=null;logo.onerror=null;signTexture.dispose();}};
}
