import {createAmaFansPavilion} from '../e/amafans-building.js?v=fan-finish2';
import {createStandingFanTable} from '../e/standing-fan-table.js?v=fan-finish2';
import {createEquipmentDisplay,EQUIPMENT_VIEWS} from '../e/industrial-equipment.js?v=fan-finish2';

// Shared equipment stays in E's asset coordinate frame; only this campus is translated.
export const CAMPUS_CENTER=[-11.1,.9];
export const CAMPUS_OFFSET=[CAMPUS_CENTER[0]-8.5,CAMPUS_CENTER[1]-1.4];
export const FAN_PRODUCTS=[['warehouse','大型吊扇'],['standing','晴天立扇桌'],['exhaust','負壓排風扇'],['wall','壁掛扇'],['mobile','移動坦克扇'],['watercooler','水冷扇']];
export async function createVentilationCampus({THREE,parent,keep,material,pickables,box,cyl,mesh}) {
  const group=new THREE.Group();group.name='d-complete-ventilation-campus';
  group.position.set(CAMPUS_OFFSET[0],0,CAMPUS_OFFSET[1]);parent.add(group);
  const pad=material('#cfc3a9'),brick=material('#b46f54'),wood=material('#ae8960');
  box(group,9.1,.085,.8,7.1,.04,6.8,pad).name='d-ventilation-demonstration-base';
  const pavilionRoot=new THREE.Group();pavilionRoot.position.set(5,0,1.1);group.add(pavilionRoot);
  const pavilion=await createAmaFansPavilion({THREE,root:pavilionRoot,keep,material,pickables,box,cyl,mesh,buildingPlots:[],includeWarehouse:false});
  const standing=await createStandingFanTable({THREE,parent:group,keep,material,pickables});
  const equipment=await createEquipmentDisplay({THREE,parent:group,keep,material,pickables,box,cyl});
  // Context fixtures share immutable CAD buffers/materials with the complete campus.
  // Only cloned rotor transforms are animated; their resources stay owned by the source.
  const contextDevices=[];
  function cloneContextDevice(id,topicId) {
    const source=id==='warehouse'?pavilion.fan.root:equipment.devices[id];
    const sourceRotor=id==='warehouse'?pavilion.fan.rotor:source.getObjectByName(`equipment-${id}-rotor`);
    const root=source.clone(true),rotor=root.getObjectByName(sourceRotor.name);
    root.name=`d-${topicId}-${source.name}`;
    root.traverse(object=>{object.userData.topicId=topicId;if(object.isMesh)pickables.push(object);});
    contextDevices.push({root,rotor,sourceRotor});
    return root;
  }
  function setNight(value){
    pavilion.fan.setNight(value);
    for(const {root} of contextDevices){
      const lamp=root.getObjectByName('amafans-night-light'),light=root.getObjectByName('amafans-factory-downlight');
      if(!lamp||!light)continue;
      const ratio=root.scale.x/pavilion.fan.scale;
      lamp.visible=!!value;light.intensity=value?light.userData.nightIntensity*ratio*ratio:0;light.distance=light.userData.nightDistance*ratio;
    }
  }
  // Outdoor break area beside the cooler, separate from the operations forecourt.
  box(group,11.4,.34,3.5,.83,.10,.24,wood);for(const x of [11.1,11.7])box(group,x,.2,3.5,.065,.28,.19,brick);
  // Equipment interactions belong to D's energy topic, including reused CAD meshes.
  group.traverse(object=>{object.userData.topicId='energy';});
  return {group,pavilion,equipment,cloneContextDevice,setNight,views:{...EQUIPMENT_VIEWS},update(time){pavilion.fan.update(time);standing.update(time);equipment.update(time);for(const {rotor,sourceRotor} of contextDevices)rotor.quaternion.copy(sourceRotor.quaternion);},dispose(){for(const {root} of contextDevices)root.removeFromParent();contextDevices.length=0;pavilion.dispose();standing.dispose();equipment.dispose();group.removeFromParent();}};
}
