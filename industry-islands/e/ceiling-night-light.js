// Fixed underside lamp; CAD coordinates are millimeters, light range is in scene units.
export function createCeilingNightLight({THREE,parent,keep,material,bottomY}) {
  const group=new THREE.Group();group.name='amafans-night-light';group.visible=false;
  group.position.y=bottomY-18;parent.add(group);
  const light=new THREE.PointLight('#fff3dc',0,5,2);light.name='amafans-factory-downlight';
  light.castShadow=false;light.userData={nightIntensity:18,nightDistance:5};group.add(light);
  const lensMaterial=material('#ffffff',{emissive:'#fff6de',emissiveIntensity:4,roughness:.2,side:THREE.DoubleSide});
  const lens=new THREE.Mesh(keep(new THREE.CircleGeometry(88,24)),lensMaterial);
  lens.rotation.x=-Math.PI/2;lens.position.y=2;lens.name='amafans-night-light-lens';group.add(lens);
  group.userData={role:'fixed-night-light'};
  function setNight(value,powerScale=1){group.visible=!!value;light.intensity=value?light.userData.nightIntensity*powerScale*powerScale:0;light.distance=light.userData.nightDistance*powerScale;}
  return {group,light,setNight};
}
