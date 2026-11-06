import {createAmaFansPavilion} from '../e/amafans-building.js?v=ceiling-cad1';
import {createStandingFanTable} from '../e/standing-fan-table.js?v=ceiling-cad1';
import {createEquipmentDisplay,EQUIPMENT_VIEWS} from '../e/industrial-equipment.js?v=ceiling-cad1';

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
  box(group,8.8,2.1,-2.155,.8,.83,.045,material('#e7e2d2')).name='d-campus-closed-rear-panel';
  const standing=await createStandingFanTable({THREE,parent:group,keep,material,pickables});
  const equipment=await createEquipmentDisplay({THREE,parent:group,keep,material,pickables,box,cyl});
  // Outdoor break area beside the cooler, separate from the operations forecourt.
  box(group,11.4,.34,3.5,.83,.10,.24,wood);for(const x of [11.1,11.7])box(group,x,.2,3.5,.065,.28,.19,brick);
  // Equipment interactions belong to D's energy topic, including reused CAD meshes.
  group.traverse(object=>{object.userData.topicId='energy';});
  return {group,pavilion,equipment,views:{...EQUIPMENT_VIEWS},update(time){pavilion.rotor.rotation.y=time*.7;standing.update(time);equipment.update(time);},dispose(){pavilion.dispose();standing.dispose();equipment.dispose();group.removeFromParent();}};
}
