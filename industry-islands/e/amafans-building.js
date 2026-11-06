import {createCeilingFan} from './ceiling-fan.js?v=ceiling-cad1';
import {createSupplyWarehouse} from './supply-warehouse.js?v=column-wall1';

// A schematic HVLS display pavilion; dimensions are for the miniature only.
export async function createAmaFansPavilion({THREE,root,box,cyl,mesh,material,keep,pickables,buildingPlots,includeWarehouse=true}) {
  const pavilion=new THREE.Group();pavilion.name='amafans-pavilion';
  pavilion.position.set(3.5,0,.3);root.add(pavilion);
  pavilion.userData={topicId:'industry',schematic:true};
  const steel=material('#6b7778',{metalness:.35,roughness:.48});
  const roofMaterial=material('#c4edf0',{transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide,roughness:.12,metalness:.12});
  const cladding=material('#e7e2d2',{roughness:.8});
  // Open sides and a clear roof keep both the long suspension and rotor visible.
  const roof=box(pavilion,0,2.73,-1.2,2.7,.025,4.5,roofMaterial);
  roof.name='amafans-transparent-roof';roof.castShadow=false;
  roof.userData={topicId:'industry',role:'transparent-roof',opacity:.34};
  const glassEdge=material('#a0dde7',{transparent:true,opacity:.67,depthWrite:false,roughness:.22});
  const reflectionMaterial=material('#e9ffff',{transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide});
  for(const x of [-1.34,-.45,.45,1.34]) {
    const seam=box(pavilion,x,2.747,-1.2,.013,.009,4.5,glassEdge);
    seam.name='amafans-glass-panel-division';seam.castShadow=false;
  }
  for(const z of [-3.445,1.045]) {
    const edge=box(pavilion,0,2.747,z,2.7,.009,.013,glassEdge);
    edge.name='amafans-glass-roof-edge';edge.castShadow=false;
  }
  for(const x of [-.83,.06,.95]) {
    const reflection=box(pavilion,x,2.751,-1.2,.045,.002,3.7,reflectionMaterial);
    reflection.rotation.y=-.25;reflection.name='amafans-glass-reflection';reflection.castShadow=false;
  }
  for(const x of [-1.24,1.24])for(const z of [-3.34,-.94,.94]) {
    box(pavilion,x,1.41,z,.055,2.56,.055,steel).name='amafans-steel-column';
    box(pavilion,x,.14,z,.16,.08,.16,steel);
  }
  for(const z of [-3.36,-.96,.96])box(pavilion,0,2.66,z,2.58,.075,.055,steel);
  for(const x of [-1.26,1.26])box(pavilion,x,2.66,-1.2,.055,.075,4.38,steel);
  // Low factory cladding anchors the pavilion while leaving the rotor and rod exposed.
  box(pavilion,1.24,.58,0,.055,.9,1.88,cladding).name='amafans-side-knee-wall';
  for(const z of [-.7,-.35,0,.35,.7])box(pavilion,1.272,.58,z,.012,.86,.012,steel);
  // Slim overhead mounting rails do not form an opaque ceiling slab.
  for(const z of [-.15,.15])box(pavilion,0,2.67,z,2.5,.035,.025,steel);
  const ceiling=await createCeilingFan({THREE,parent:pavilion,keep,material,pickables});
  const rotor=ceiling.rotor;
  // An I-section roof member meets the supplied folded clamp; bolts enter the lower flange.
  const clampTop=ceiling.root.position.y+ceiling.data.mountContactY*ceiling.scale;
  box(pavilion,0,clampTop+.0045,0,.14,.009,1.98,steel).name='amafans-mount-beam-lower-flange';
  box(pavilion,0,clampTop+.027,0,.022,.036,1.98,steel).name='amafans-mount-beam-web';
  box(pavilion,0,clampTop+.0495,0,.14,.009,1.98,steel).name='amafans-mount-beam-upper-flange';
  const warehouse=createSupplyWarehouse({THREE,pavilion,material,keep,mesh,showContents:includeWarehouse});
  buildingPlots.push({x:root.position.x+pavilion.position.x,z:root.position.z+pavilion.position.z-1.2,w:2.7,d:4.5});
  // The supplied physical badge photograph preserves the exact wordmark and pin outline.
  let disposed=false;
  const badgeMaterial=new THREE.MeshBasicMaterial({transparent:true,alphaTest:.1,side:THREE.DoubleSide,toneMapped:false});
  const badgeTexture=new THREE.TextureLoader().load(new URL('./assets/amafans-badge.png',import.meta.url).href,texture=>{
    if(disposed){texture.dispose();return;}
    texture.colorSpace=THREE.SRGBColorSpace;badgeMaterial.needsUpdate=true;
  });
  badgeTexture.colorSpace=THREE.SRGBColorSpace;badgeMaterial.map=badgeTexture;
  const sign=mesh(keep(new THREE.PlaneGeometry(1.85,.925)),badgeMaterial,pavilion,1.365,2.58,-2.2);
  sign.rotation.y=Math.PI/2;sign.name='amafans-side-brand-sign';sign.castShadow=false;
  for(const z of [-2.78,-1.62])box(pavilion,1.325,2.45,z,.08,.035,.035,steel).name='amafans-sign-wall-standoff';
  sign.userData={topicId:'industry',role:'brand-sign',externalUrl:'https://www.amafans.com/',externalURL:'https://www.amafans.com/',badgeStyle:'exact-photo-cutout',placement:'side-wall-roof-edge',fanMarkAboveRoof:true};
  pickables.push(sign);
  const badges=[sign];
  pavilion.traverse(object=>{object.userData.topicId='industry';if(object.isMesh&&!object.userData.externalUrl)pickables.push(object);});
  return {pavilion,rotor,roof,fan:ceiling,badges,warehouse,dispose(){if(disposed)return;disposed=true;ceiling.dispose();warehouse.dispose();badgeTexture.dispose();badgeMaterial.dispose();}};
}
