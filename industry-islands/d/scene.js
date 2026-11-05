import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';

// This pure layout is shared by rendered roads and headless connectivity checks.
export const ROAD_LAYOUT = {
  nodes: {digital:[-4.6,-1.8],leasing:[-1.4,-3.35],materials:[1.3,-1.85],design:[4.7,-2.3],energy:[5,1.1],business:[-5.2,1],center:[-.1,.9],west:[-3.35,2.7],east:[3.3,2.75],logistics:[-5.4,6.65],collaboration:[4.7,6.65]},
  links: [
    ['digital','leasing',[[-3.5,-2.8]]], ['leasing','design',[[.6,-3.4],[2.8,-3.3]]],
    ['design','energy',[[5.7,-.8]]], ['energy','east',[[4.4,2.4]]],
    ['east','west',[[1.8,2.9],[-.7,2.7]]], ['west','business',[[-4.7,2.2]]],
    ['business','digital',[[-5.8,-.3]]], ['leasing','materials',[[0,-2.9]]],
    ['materials','design',[[3,-2.1]]], ['materials','center',[[1,-.5]]],
    ['center','business',[[-2.4,.6]]], ['center','energy',[[2.5,.65]]],
    ['center','west',[[-1.9,1.65]]], ['center','east',[[1.6,1.8]]],
    ['west','logistics',[[-3.7,3.7],[-4.4,5]],true],
    ['east','collaboration',[[3.6,4],[4.2,5.4]],true],
  ],
};
export function findRoadPath(nodeIds, edges, from, to) {
  if(!nodeIds.includes(from)||!nodeIds.includes(to))return [];
  const adjacency=new Map(nodeIds.map(id=>[id,[]]));
  for(const edge of edges){adjacency.get(edge.a)?.push(edge);adjacency.get(edge.b)?.push(edge);}
  const dist=new Map(nodeIds.map(id=>[id,Infinity])),prev=new Map(),open=new Set(nodeIds);dist.set(from,0);
  while(open.size){
    const u=[...open].reduce((a,b)=>dist.get(a)<dist.get(b)?a:b);
    if(u===to||!Number.isFinite(dist.get(u)))break;open.delete(u);
    for(const edge of adjacency.get(u)){
      const next=edge.a===u?edge.b:edge.a,nd=dist.get(u)+edge.length;
      if(nd<dist.get(next)){dist.set(next,nd);prev.set(next,{id:u,edge,reverse:edge.b===u});}
    }
  }
  const route=[];let current=to;
  while(current!==from){const p=prev.get(current);if(!p)return [];route.unshift({edge:p.edge,reverse:p.reverse});current=p.id;}
  return route;
}

// A schematic miniature landscape. District geography does not imply business facts.
export async function createIsland({ container, topics = [], onSelect = () => {}, onReady = () => {}, onError = () => {}, onTourStop = () => {} }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 600 ? 1.2 : 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.domElement.setAttribute('aria-label', '狹長智慧港灣中的 D 組商務物流群島，可拖曳旋轉與點選街區');
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xc7e3e4, 54, 110);
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 180);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .065; controls.enablePan = false;
    controls.minDistance = 20; controls.maxDistance = 70;
    controls.minPolarAngle = .25; controls.maxPolarAngle = 1.2;
    controls.target.set(0, .25, 1.1);
    const hemi = new THREE.HemisphereLight(0xe7f5fb, 0xb2ad83, 2.35); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffedce, 2.6);
    sun.position.set(-11, 23, 11); sun.castShadow = true;
    sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera, { left:-15, right:15, top:15, bottom:-15, near:1, far:65 });
    sun.shadow.bias = -.0007; sun.shadow.normalBias = .025; scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc0e6ee, 1); fill.position.set(9,8,-10); scene.add(fill);
    // The whole miniature uses one map transform: coasts, bridges, paths, trees,
    // moving traffic and picking stay in the same coordinate system.
    const landscape = new THREE.Group();scene.add(landscape);
    // A long, oblique industrial harbor, with the freight island to the southwest.
    landscape.matrixAutoUpdate=false;
    landscape.matrix.set(1.14,0,.25,0, 0,1,0,0, -.045,0,.82,0, 0,0,0,1);
    const mapPoint = point => point.clone().applyMatrix4(landscape.matrix);
    const geometries = new Set(), materials = new Set();
    const material = (color, opts={}) => { const m=new THREE.MeshStandardMaterial({color,roughness:.88,...opts}); materials.add(m); return m; };
    const P = {
      grass:material('#7f9877'), grassLight:material('#9eaf86'), deepGreen:material('#536e62'),
      sand:material('#c6b897'), wetSand:material('#a0b4ad'), rock:material('#7b8a87'),
      road:material('#7f8d91'), pavement:material('#b1b8b0'), stripe:material('#f4e6be'),
      cream:material('#eae4d1'), white:material('#f6f1e4'), brick:material('#b46f54'), roof:material('#b86c4e'),
      wood:material('#ae8960'), trunk:material('#846447'), leaf:material('#4f805c'), leaf2:material('#6a9567'),
      glass:material('#69a8bc',{roughness:.3,metalness:.1}), dark:material('#41575a'),
      window:material('#d5e6df',{emissive:'#ffc875',emissiveIntensity:.04}),
      skin:material('#dcb38e'), gold:material('#dfb65e'),
      water:material('#438da2',{roughness:.34,metalness:.12}), shallow:material('#7bb6b5',{roughness:.55}),
      foam:material('#d1e5ce',{transparent:true,opacity:.48,depthWrite:false}),
      route:material('#bb793c',{emissive:'#b97427',emissiveIntensity:.2}),
      routeSecondary:material('#c0eddf',{emissive:'#92d9cb',emissiveIntensity:.35}),
    };
    const keep = g => {geometries.add(g);return g;};
    const unitBox=keep(new THREE.BoxGeometry(1,1,1));
    const unitCylinder=keep(new THREE.CylinderGeometry(1,1,1,12));
    const unitSphere=keep(new THREE.IcosahedronGeometry(1,1));
    const coneGeo=keep(new THREE.ConeGeometry(1,1,4));
    function mesh(g,m,p=landscape,x=0,y=0,z=0) {const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
    function box(p,x,y,z,w,h,d,m=P.cream) {const o=mesh(unitBox,m,p,x,y,z);o.scale.set(w,h,d);return o;}
    function cyl(p,x,y,z,r,h,m=P.wood) {const o=mesh(unitCylinder,m,p,x,y,z);o.scale.set(r,h,r);return o;}
    function ellipsoid(p,x,y,z,sx,sy,sz,m) {const o=mesh(unitSphere,m,p,x,y,z);o.scale.set(sx,sy,sz);return o;}
    const v = (x,z,y=.15) => new THREE.Vector3(x,y,z);
    let seed=173;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    function curve(points,closed=false) {return new THREE.CatmullRomCurve3(points.map(p=>Array.isArray(p)?v(p[0],p[1],p[2]??.15):p),closed,'catmullrom',.26);}
    // Horizontal ribbons keep roads flush with the landscape, including curved bridge decks.
    function ribbon(path,width,m,yOffset=0,segments=80) {
      const pts=path.getPoints(segments), positions=[], indices=[];
      pts.forEach((p,i)=>{const t=path.getTangent(i/segments), n=new THREE.Vector3(-t.z,0,t.x).normalize().multiplyScalar(width/2);positions.push(p.x+n.x,p.y+yOffset,p.z+n.z,p.x-n.x,p.y+yOffset,p.z-n.z);if(i<segments){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}});
      const g=keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
      const o=mesh(g,m);o.castShadow=false;return o;
    }
    function tube(path,r,m,parent=landscape) {const o=mesh(keep(new THREE.TubeGeometry(path,64,r,5,false)),m,parent);o.castShadow=false;return o;}
    function coast(points,scale,y,depth,m) {


      // A closed Catmull-Rom outline avoids the repeated straight-edged platform silhouette.
      const outline=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0]*scale,p[1]*scale,0)),true,'catmullrom',.3).getPoints(100);
      const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(p.x,-p.y)));
      const g=keep(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:48}));
      g.rotateX(-Math.PI/2);return mesh(g,m,landscape,0,y,0);
    }
    const sea=mesh(keep(new THREE.PlaneGeometry(240,240)),P.water,scene,0,-.46,0);sea.rotation.x=-Math.PI/2;sea.castShadow=false;
    const mainCoast=[[-8,.7],[-7.5,-2.3],[-5.8,-6.3],[-2.5,-7.15],[1,-6.8],[4.6,-5.5],[6.7,-3],[7.8,-.3],[7.25,.65],[6.9,1.8],[7.1,2.5],[5.6,3.7],[3.1,4.1],[.4,3.65],[-1.5,3.55],[-2.8,3.35],[-4.2,3.8],[-5.8,3.2],[-7.6,2]];
    const portCoast=[[-8,6.2],[-7.4,5.35],[-5.3,5.2],[-3.5,5.75],[-3.05,6.8],[-3.05,8.35],[-4.5,8.85],[-6.8,8.8],[-8,7.9]];
    const learnCoast=[[2.7,6.7],[3.4,5.3],[5.3,5.15],[7,5.8],[7.8,7.1],[7.1,8.5],[5.5,9],[3.6,8.3]];
    for(const outline of [mainCoast,portCoast,learnCoast]) {
      coast(outline,1.065,-.435,.025,P.shallow);
      coast(outline,1.024,-.405,.17,P.rock);
      coast(outline,1.014,-.25,.12,P.wetSand);
      coast(outline,1,-.15,.18,P.sand);
      // Inset is around each island's centroid, so satellite beaches stay equally narrow.
      const cx=outline.reduce((s,p)=>s+p[0],0)/outline.length,cz=outline.reduce((s,p)=>s+p[1],0)/outline.length;
      coast(outline.map(([x,z])=>[cx+(x-cx)*.965,cz+(z-cz)*.965]),1,.025,.06,P.grass);
    }
    // A continuous, faceted ridge grows from the northern mainland, with low wooded foothills.
    const ridgeNorth=x=>x < -4 ? -6.4+(-4-x)*.3 : x>1 ? -6.4+(x-1)*.32 : -6.4;
    function terrainHeight(x,z) {
      const north=ridgeNorth(x),nx=(x+5.6)/9.7,nz=(z-north)/(-4.15-north);
      if(nx<=0||nx>=1||nz<=0||nz>=1)return .08;
      const envelope=Math.pow(Math.sin(Math.PI*nx),.65)*Math.pow(Math.sin(Math.PI*nz),1.05);
      const ridge=1.15+.48*Math.sin(x*1.55)+.26*Math.cos(x*2.9+z*1.2);
      return .08+envelope*ridge;
    }
    const ridgePositions=[],ridgeColors=[],ridgeIndices=[];
    const ridgeCols=26,ridgeRows=9;
    for(let j=0;j<=ridgeRows;j++)for(let i=0;i<=ridgeCols;i++) {
      const x=-5.6+i/ridgeCols*9.7,north=ridgeNorth(x),z=north+j/ridgeRows*(-4.15-north),y=terrainHeight(x,z);
      ridgePositions.push(x,y,z);const c=new THREE.Color(y>1.25?'#7d936d':y>.65?'#749365':'#85a66d');c.multiplyScalar(.93+random()*.14);ridgeColors.push(c.r,c.g,c.b);
      if(i<ridgeCols&&j<ridgeRows){const a=j*(ridgeCols+1)+i;ridgeIndices.push(a,a+ridgeCols+1,a+1,a+1,a+ridgeCols+1,a+ridgeCols+2);}
    }
    const ridgeGeo=keep(new THREE.BufferGeometry());ridgeGeo.setAttribute('position',new THREE.Float32BufferAttribute(ridgePositions,3));ridgeGeo.setAttribute('color',new THREE.Float32BufferAttribute(ridgeColors,3));ridgeGeo.setIndex(ridgeIndices);ridgeGeo.computeVertexNormals();
    mesh(ridgeGeo,material('#ffffff',{vertexColors:true,flatShading:true}));
    [[-10,-5,.8,.65,1.2],[-9,-6.2,.5,.4,.65],[9.5,-5,1.2,.85,.9],[11,-4.4,.55,.4,.75],[-9.2,4,.65,.3,.55]].forEach(([x,z,a,b,c])=>{ellipsoid(landscape,x,-.3,z,a,b,c,P.sand);ellipsoid(landscape,x,-.18,z,a*.84,b,c*.84,P.deepGreen);});
    // One connected street graph supports route selection, pedestrians, cars and freight.
    const nodes=ROAD_LAYOUT.nodes;
    const edges=[];
    function road(a,b,bends=[],bridge=false) {
      const path=curve([nodes[a],...bends,nodes[b]].map(([x,z])=>[x,z,bridge?.24:.135]));
      const edge={a,b,path,length:path.getLength(),bridge};edges.push(edge);
      ribbon(path,bridge?.69:.79,P.pavement,0);ribbon(path,bridge?.46:.51,P.road,.009);
      const pts=path.getSpacedPoints(Math.ceil(edge.length/.45));
      pts.forEach((p,i)=>{if(i%2)return;const d=path.getTangent(i/(pts.length-1)),o=box(landscape,p.x,p.y+.018,p.z,.027,.008,.14,P.stripe);o.rotation.y=Math.atan2(d.x,d.z);o.castShadow=false;});
      if(bridge) {
        // Narrow timber/concrete bridges actually span open channels.
        for(const side of [-1,1]) {
          const railPts=path.getPoints(40).map((p,i)=>{const d=path.getTangent(i/40);return p.clone().add(new THREE.Vector3(-d.z*.31*side,.18,d.x*.31*side));});
          tube(new THREE.CatmullRomCurve3(railPts),.022,P.cream);
          for(let j=1;j<10;j++){const p=path.getPoint(j/10),d=path.getTangent(j/10);cyl(landscape,p.x-d.z*.31*side,p.y+.09,p.z+d.x*.31*side,.018,.2,P.cream);}
        }
        for(const u of [.28,.63]) {const p=path.getPoint(u);box(landscape,p.x,-.12,p.z,.14,.68,.38,P.rock);}
      }
      return edge;
    }
    ROAD_LAYOUT.links.forEach(([a,b,bends,bridge])=>road(a,b,bends,bridge));
    const shortest=(from,to)=>findRoadPath(Object.keys(nodes),edges,from,to);
    function routeCurve(route,offset=0,y=.16) {
      const points=[];route.forEach(({edge,reverse})=>{let pts=edge.path.getSpacedPoints(32);if(reverse)pts.reverse();pts.forEach((p,i)=>{if(points.length&&i===0)return;const tangent=pts[Math.min(i+1,pts.length-1)].clone().sub(pts[Math.max(0,i-1)]).normalize();points.push(p.clone().add(new THREE.Vector3(-tangent.z*offset,y-.135,tangent.x*offset)));});});
      return points.length>1?new THREE.CatmullRomCurve3(points,false,'centripetal'):null;
    }
    // Reused geometry keeps the detailed miniature economical to render.
    const pickables=[], districtMap=new Map(), labels=[], fans=[], walkers=[], vehicles=[], boats=[], birds=[], waves=[];
    const treeData=[], buildingPlots=[];
    function tree(x,z,s=1,y=.08) {treeData.push({x,z,s,y,rot:random()*6.28});}
    function lamp(x,z) {cyl(landscape,x,.42,z,.027,.65,P.dark);ellipsoid(landscape,x,.78,z,.1,.08,.1,P.window);}
    function building(parent,x,z,w,d,h,kind='office',accent=P.cream) {
      buildingPlots.push({x:x+parent.position.x,z:z+parent.position.z,w,d});
      const g=new THREE.Group();g.position.set(x,.09,z);parent.add(g);
      box(g,0,.035,0,w+.13,.07,d+.13,P.pavement);
      const body=box(g,0,h/2+.06,0,w,h,d,accent);
      if(parent.userData.topicId){body.userData.topicId=parent.userData.topicId;pickables.push(body);}
      if(kind==='house') {
        const roof=mesh(coneGeo,P.roof,g,0,h+.25,0);roof.scale.set(w*.8,.45,d*.8);roof.rotation.y=Math.PI/4;
        box(g,0,.25,d/2+.015,.16,.36,.025,P.wood);
      } else {
        box(g,0,h+.1,0,w+.09,.12,d+.09,kind==='factory'?P.brick:P.white);
        if(kind==='office')box(g,-w*.15,h+.2,0,w*.4,.15,d*.45,P.dark);
      }
      // Windows are strips on both street-facing facades rather than individual high-cost panes.
      for(let level=.37;level<h-.02;level+=.4) {
        box(g,0,level,d/2+.009,w*.72,.16,.022,P.window);
        box(g,-w/2-.009,level,0,.022,.16,d*.7,P.glass);
      }
      return g;
    }
    function person(color=P.brick,s=.48) {
      const g=new THREE.Group();g.scale.setScalar(s);landscape.add(g);
      ellipsoid(g,0,.8,0,.13,.145,.13,P.skin);box(g,0,.52,0,.25,.34,.18,color);
      const limbs=[];for(let i=0;i<4;i++){const pivot=new THREE.Group();pivot.position.set(i<2?(i? .18:-.18):(i===2?-.075:.075),i<2?.65:.35,0);g.add(pivot);box(pivot,0,-.16,0,.075,.32,.085,i<2?color:P.dark);limbs.push(pivot);}return {g,limbs};
    }
    // The eight districts share a continuous townscape, with architecture and planting as boundaries.
    for(const topic of topics) {
      if(!nodes[topic.id])continue;
      const [x,z]=nodes[topic.id], root=new THREE.Group();root.position.set(x,0,z);root.userData.topicId=topic.id;landscape.add(root);
      const accent=material(topic.color||'#c3936b');
      const glowMat=material(topic.color||'#e7bc72',{transparent:true,opacity:.19,emissive:topic.color||'#e7bc72',emissiveIntensity:.55,depthWrite:false});
      const halo=mesh(keep(new THREE.RingGeometry(.55,.76,48)),glowMat,root,0,.16,0);halo.rotation.x=-Math.PI/2;halo.castShadow=false;halo.visible=false;
      const marker=cyl(root,0,.19,0,.1,.12,accent);marker.castShadow=false;
      const hit=cyl(root,0,.09,0,1.22,.08,P.grass);hit.castShadow=false;hit.material=material('#ffffff',{transparent:true,opacity:0,depthWrite:false});hit.userData.topicId=topic.id;pickables.push(hit);
      const label=document.createElement('button');label.type='button';label.className='island-label';label.dataset.topic=topic.id;label.textContent=topic.short||topic.title;label.setAttribute('aria-label',topic.title||topic.id);label.style.position='absolute';label.style.zIndex='3';
      label.addEventListener('click',()=>{stopTour();select(topic.id);onSelect(topic.id);});container.appendChild(label);
      labels.push({el:label,anchor:new THREE.Vector3(x,1.65,z+.25)});
      districtMap.set(topic.id,{root,halo,glowMat,topic});
      if(topic.id==='leasing') {
        // Office leasing streets: varied storefronts and workspaces around a shared courtyard.
        building(root,-.95,-.95,.68,.65,1.45,'office',P.white);
        building(root,.05,-1.02,.72,.62,1.08,'office',P.cream);
        building(root,1.05,-.7,.68,.7,1.65,'office',P.white);
        building(root,-1.02,.55,.72,.65,1.15,'office',P.brick);
        building(root,.1,.6,.63,.6,1.85,'office',P.cream);
        for(const [a,b] of [[-.95,-.95],[.05,-1.02],[1.05,-.7]]) {
          box(root,a,.46,b+.36,.48,.18,.035,P.glass);
          box(root,a,.65,b+.4,.76,.06,.25,P.wood);
        }
        [[-.6,-.9],[.5,-.8],[.9,.6],[-1.6,-.8]].forEach(([a,b])=>tree(x+a,z+b,.56));
        box(root,1,.13,.55,.72,.06,.55,P.grassLight);
        box(root,1,.25,.9,.8,.1,.12,P.wood);
      } else if(topic.id==='materials') {
        // Glazed materials showroom, stone samples and a compact active construction yard.
        const showroom=building(root,.1,-.68,1.24,.67,.82,'office',P.white);
        box(showroom,0,.52,.35,1.04,.61,.025,P.glass);
        box(showroom,0,.98,.42,1.35,.1,.27,P.wood);
        building(root,1.35,.15,.62,.63,1.35,'office',P.cream);
        box(root,-.92,.13,.2,.82,.09,.85,P.pavement);
        for(let j=0;j<4;j++) {
          const slab=box(root,-1.18+j*.2,.42,.14,.095,.56,.48,[P.cream,P.brick,P.rock,P.sand][j]);
          slab.rotation.z=-.11;
        }
        for(let j=0;j<3;j++)box(root,-.65+j*.3,.25,1.02,.25,.28,.34,P.brick);
        for(const a of [-.28,.28])cyl(root,.55+a,.62,.75,.024,1.05,P.dark);
        box(root,.55,1.14,.75,.7,.05,.08,P.gold);
        box(root,.73,.83,.75,.014,.57,.014,P.dark);
        box(root,.73,.5,.75,.29,.1,.24,P.rock);
        tree(x-1.25,z-.75,.65);tree(x+1.25,z-.9,.55);
      } else if(topic.id==='design') {
        // Courtyard studios and an open exhibition terrace replace agricultural plots.
        building(root,.05,-.94,1.3,.65,.78,'office',P.white);
        building(root,1.26,-.2,.65,.86,.92,'office',P.cream);
        box(root,-.42,.13,.48,1.75,.08,1.36,P.sand);
        box(root,-.44,.19,.48,1.36,.045,1.03,P.pavement);
        for(const [a,b] of [[-1.08,.05],[-1.08,.96],[.22,.96]]) {
          box(root,a,.5,b,.5,.64,.075,P.white);
          box(root,a,.51,b+.043,.37,.42,.014,accent);
        }
        for(const a of [-1.2,.44])for(const b of [-.07,1.08])cyl(root,a,.61,b,.027,1.05,P.wood);
        for(let j=0;j<6;j++)box(root,-1.22+j*.33,1.16,.5,.055,.045,1.32,P.wood);
        cyl(root,-.42,.39,.5,.24,.4,P.rock);
        const sculpture=ellipsoid(root,-.42,.84,.5,.16,.35,.14,P.gold);sculpture.rotation.z=.4;
        box(root,.62,.23,1.03,.76,.12,.15,P.wood);
        tree(x+.95,z-1.25,.65);tree(x-1.45,z+.62,.62);
      } else if(topic.id==='energy') {
        building(root,.42,-.6,1.55,1.05,.88,'factory',P.cream);building(root,-1.1,-.55,.72,.72,.65,'factory',P.white);
        // Clerestory workshop roof, solar panels, equipment crates and a visible HVLS fan.
        for(let j=0;j<3;j++)box(root,.03+j*.42,1.12,-.6,.31,.05,.55,P.glass);
        for(let j=0;j<4;j++){const xx=-.9+j*.37;box(root,xx,.3,.62,.29,.34,.32,j%2?P.dark:P.wood);box(root,xx,.49,.62,.32,.045,.35,P.cream);for(const zz of [.46,.78])box(root,xx,.3,zz,.22,.035,.02,P.gold);}
        const frame=new THREE.Group();frame.position.set(1.25,.09,.73);root.add(frame);
        for(const a of [-.48,.48])for(const b of [-.3,.3])cyl(frame,a,.63,b,.027,1.2,P.dark);
        box(frame,0,1.26,0,1.07,.07,.75,P.wood);
        const fan=new THREE.Group();fan.position.y=1.1;frame.add(fan);cyl(fan,0,0,0,.09,.1,P.gold);
        for(let k=0;k<6;k++){const a=k*Math.PI/3,o=box(fan,Math.sin(a)*.22,0,Math.cos(a)*.22,.085,.025,.43,P.dark);o.rotation.y=a;}fans.push(fan);
        box(root,1.8,.18,-.5,.35,.2,.6,P.wood);
      } else if(topic.id==='digital') {
        building(root,-.9,-.3,.85,.7,1.65,'office',P.white);building(root,.1,-.65,.75,.8,1.95,'office',P.cream);
        building(root,.85,.3,.85,.72,1.2,'office',P.white);
        for(let j=0;j<3;j++){box(root,-.75+j*.32,.48,.75,.24,.75,.28,P.dark);for(let k=0;k<3;k++)box(root,-.75+j*.32,.28+k*.2,.9,.15,.025,.02,P.glass);}
        const dish=ellipsoid(root,.1,2.3,-.65,.23,.06,.23,P.white);dish.rotation.z=.35;cyl(root,.1,2.18,-.65,.025,.4,P.dark);
        tree(x-1.5,z+.35,.7);
      } else if(topic.id==='business') {
        building(root,-.9,-.45,.73,.8,1.12,'office',P.cream);building(root,.15,-.75,.8,.64,.87,'office',P.brick);
        building(root,.95,.55,.65,.6,1.15,'office',P.white);
        cyl(root,0,.14,.6,.59,.1,P.sand);cyl(root,0,.5,.6,.25,.08,P.wood);
        for(let j=0;j<4;j++){const a=j*Math.PI/2,p=person(j%2?P.dark:P.brick,.48);p.g.position.set(x+Math.sin(a)*.43,.18,z+.6+Math.cos(a)*.43);p.g.rotation.y=a+Math.PI;}
        tree(x-1.1,z+.9,.85);tree(x+.7,z-1.25,.7);
      } else if(topic.id==='logistics') {
        building(root,-.6,-.35,1.1,.8,.7,'factory',P.cream);building(root,.8,-.25,.6,.65,.75,'office',P.white);
        box(root,-.1,.1,1.05,3,.12,.7,P.pavement);box(root,-.1,-.04,1.52,3.2,.28,.18,P.rock);
        for(let j=0;j<5;j++){const colors=[P.brick,P.dark,P.grassLight];box(root,-1.1+j*.48,.3,.7,.4,.32,.65,colors[j%3]);if(j<2)box(root,-1.1+j*.48,.62,.7,.4,.3,.65,colors[(j+1)%3]);}
        // A working harbor crane and timber piers extend into the water.
        cyl(root,1.35,1,.9,.055,1.9,P.gold);box(root,1.05,1.89,.9,1.3,.07,.09,P.gold);box(root,.5,1.5,.9,.018,.75,.018,P.dark);
        for(const px of [-1.4,.4]) {box(root,px,-.04,2,.3,.16,1.4,P.wood);for(const zz of [1.5,2.4])cyl(root,px,-.3,zz,.045,.6,P.wood);}
        tree(x-1.5,z-.7,.6);
      } else if(topic.id==='collaboration') {
        building(root,.6,-.6,.85,.65,.8,'office',P.cream);building(root,-.9,-.5,.65,.65,.72,'office',P.white);
        const pavilion=new THREE.Group();pavilion.position.set(0,.1,.65);root.add(pavilion);
        box(pavilion,0,.03,0,1.3,.1,1,P.wood);
        for(const a of [-.52,.52])for(const b of [-.37,.37])cyl(pavilion,a,.52,b,.036,1,P.wood);
        const roof=mesh(coneGeo,P.deepGreen,pavilion,0,1.2,0);roof.scale.set(1,.5,.8);roof.rotation.y=Math.PI/4;
        box(pavilion,0,.47,0,.75,.08,.43,P.wood);
        for(let j=0;j<4;j++){const p=person(j%2?P.brick:P.dark,.44);p.g.position.set(x+(j%2?.4:-.4),.18,z+.4+Math.floor(j/2)*.45);p.g.rotation.y=j%2?-Math.PI/2:Math.PI/2;}
        // Open-air study garden, with two round tables and people facing one another.
        for(const [tx,tz] of [[-1.03,.65],[.85,1.25]]) {
          cyl(root,tx,.42,tz,.27,.08,P.wood);cyl(root,tx,.25,tz,.055,.35,P.dark);
          for(let j=0;j<3;j++){const a=j*2.094+.4,p=person(j%2?P.dark:P.brick,.43);p.g.position.set(x+tx+Math.sin(a)*.4,.12,z+tz+Math.cos(a)*.4);p.g.rotation.y=a+Math.PI;box(root,tx+Math.sin(a)*.41,.24,tz+Math.cos(a)*.41,.18,.06,.18,P.wood);}
          box(root,tx-.07,.48,tz,.13,.018,.16,P.white);
        }
        for(const [a,b] of [[-1.4,.2],[1.25,.45],[.8,1.4],[-.8,1.5],[-1.1,-1.25]])tree(x+a,z+b,.75);
        ribbon(curve([[x-1,z-.5],[x-1.2,z+.5],[x,z+1.4],[x+1,z+.7]]),.19,P.sand,.005,30);
      }
    }
    // A steel-blue harbor control tower makes the commercial skyline recognizable.
    const harborTower=new THREE.Group();harborTower.position.set(-6.9,.08,6.05);landscape.add(harborTower);
    box(harborTower,0,.08,0,.58,.16,.52,P.pavement);
    cyl(harborTower,0,.75,0,.12,1.4,P.white);
    box(harborTower,0,1.5,0,.6,.34,.5,P.glass);
    box(harborTower,0,1.71,0,.71,.08,.61,P.dark);
    cyl(harborTower,0,1.96,0,.025,.48,P.gold);
    // Civic green, market stalls, benches and small street furniture fill the shared center.
    cyl(landscape,-.35,.14,.15,.6,.14,P.sand);cyl(landscape,-.35,.25,.15,.36,.15,P.rock);cyl(landscape,-.35,.34,.15,.29,.04,P.shallow);
    for(let i=0;i<3;i++){const x=-2.3+i*.7;box(landscape,x,.4,-.3,.5,.55,.45,P.wood);const awning=box(landscape,x,.75,-.3,.62,.08,.6,i%2?P.white:P.brick);awning.rotation.z=-.1;}
    for(const [x,z] of [[-2.7,1],[-.4,2.1],[2.3,1.25],[3.9,1.9],[-5.3,-.1],[.8,-2.4],[-4.7,6.1],[5.7,6.1]]) {lamp(x,z);box(landscape,x+.21,.28,z,.43,.08,.17,P.wood);}
    // Forests are instanced in three shared draw calls. Planting stays off the street network.
    const distToRoad=(x,z)=>Math.min(...edges.map(e=>Math.min(...e.path.getPoints(22).map(p=>Math.hypot(p.x-x,p.z-z)))));
    for(let i=0;i<110;i++){
      const x=-7+random()*13.7,z=-4.6+random()*7.5;
      if((z<-3.6||x<-6.15||x>6.25||z>3)&&distToRoad(x,z)>.65)tree(x,z,.45+random()*.38);
    }
    for(let i=0;i<120;i++) {
      const x=-6.4+random()*11.1,z=-6.6+random()*2.2;
      if(terrainHeight(x,z)>.13)tree(x,z,.44+random()*.55,terrainHeight(x,z));
    }
    const isClearPlot=(x,z)=>!buildingPlots.some(p=>Math.abs(x-p.x)<p.w/2+.25&&Math.abs(z-p.z)<p.d/2+.25);
    const urbanGreens=[];
    for(let i=0;i<170;i++) {
      const x=-6.7+random()*13.25,z=-3.5+random()*6.65,roadDistance=distToRoad(x,z);
      if(roadDistance<.58||roadDistance>1.3||!isClearPlot(x,z))continue;
      if(x>3&&z<-.15)continue; // exhibition terraces and equipment yards stay legible
      tree(x,z,.34+random()*.38);urbanGreens.push([x,z]);
    }
    // Informal planting along the harbor shore avoids a decorative ring of identical trees.
    for(let i=0;i<14;i++){const x=-7.1+random()*.75,z=5.95+random()*1.9;if(isClearPlot(x,z))tree(x,z,.45+random()*.35);}
    for(const [x,z] of urbanGreens.filter((_,i)=>i%3===0)) {
      const planter=box(landscape,x+.18,.13,z,.35,.13,.27,P.rock);planter.rotation.y=random()*2;
      for(let j=0;j<3;j++)ellipsoid(landscape,x+.07+j*.1,.26,z,.12,.13,.12,j%2?P.leaf:P.leaf2);
      for(let j=0;j<2;j++)ellipsoid(landscape,x+.12+j*.14,.37,z,.035,.035,.035,j%2?P.gold:P.brick);
    }
    // A shared outdoor display garden links the commercial streets and design studios.
    for(let i=0;i<5;i++){
      const x=-2.9+i*.38,z=-1.3+Math.sin(i*1.4)*.18;
      box(landscape,x,.16,z,.25,.14,.25,P.pavement);
      const sample=box(landscape,x,.42,z,.13,.42,.12,i%2?P.rock:P.wood);sample.rotation.y=i*.38;
    }
    const instTrunk=new THREE.InstancedMesh(unitCylinder,P.trunk,treeData.length), instLeaf=new THREE.InstancedMesh(unitSphere,P.leaf,treeData.length),instLeaf2=new THREE.InstancedMesh(unitSphere,P.leaf2,treeData.length);
    const dummy=new THREE.Object3D();
    treeData.forEach(({x,z,s,y,rot},i)=>{
      dummy.position.set(x,y+.3*s,z);dummy.rotation.set(0,rot,0);dummy.scale.set(.055*s,.6*s,.055*s);dummy.updateMatrix();instTrunk.setMatrixAt(i,dummy.matrix);
      dummy.position.set(x,y+.83*s,z);dummy.scale.set(.34*s,.45*s,.32*s);dummy.updateMatrix();instLeaf.setMatrixAt(i,dummy.matrix);
      dummy.position.set(x+.17*s,y+.65*s,z+.06*s);dummy.scale.set(.25*s,.3*s,.25*s);dummy.updateMatrix();instLeaf2.setMatrixAt(i,dummy.matrix);
    });
    [instTrunk,instLeaf,instLeaf2].forEach(o=>{o.castShadow=true;o.receiveShadow=true;landscape.add(o);});
    // Broad translucent sea-grass shallows and foam follow the coastline, rather than white slabs.
    const shallowPatch=material('#a8d2bb',{transparent:true,opacity:.32,depthWrite:false,roughness:.65});
    for(const [x,z,sx,sz] of [[-7.6,-1.5,2.5,1.7],[7.4,1.7,1.75,2.2],[-1.7,4.6,2.6,1.2],[-6.5,8.8,2,1.3],[5.4,9.15,2.5,1.2]]) {
      const o=mesh(keep(new THREE.CircleGeometry(1,36)),shallowPatch,landscape,x,-.45,z);o.rotation.x=-Math.PI/2;o.rotation.z=random()*3;o.scale.set(sx,sz,1);o.castShadow=false;
    }
    for(const outline of [mainCoast,portCoast,learnCoast]) {
      const cx=outline.reduce((n,p)=>n+p[0],0)/outline.length,cz=outline.reduce((n,p)=>n+p[1],0)/outline.length;
      const shoreline=new THREE.CatmullRomCurve3(outline.map(([x,z])=>v(cx+(x-cx)*1.027,cz+(z-cz)*1.027,-.225)),true,'catmullrom',.3);
      for(const [a,b] of [[.025,.18],[.27,.43],[.56,.71],[.8,.95]])tube(new THREE.CatmullRomCurve3(Array.from({length:22},(_,i)=>shoreline.getPoint(a+(b-a)*i/21))),.011,P.foam);
    }
    // Shore rocks and thin water streaks make the coastline read as a landscape.
    for(let i=0;i<28;i++){const p=mainCoast[i%mainCoast.length],x=p[0]+(random()-.5)*.45,z=p[1]+(random()-.5)*.45;ellipsoid(landscape,x,-.09,z,.12+random()*.18,.14+random()*.13,.16,P.rock);}
    for(let i=0;i<16;i++) {
      const x=-11+random()*22,z=-5+random()*16;if(distToRoad(x,z)<1)continue;
      const path=curve([[x-.2,z,-.442],[x,z+.04,-.442],[x+.5,z,-.442]]);const w=tube(path,.012,P.foam);waves.push({g:w,phase:i*.6});
    }
    // Walkers cross the two bridges and the town, following precisely the same graph as routes.
    const trips=[['business','materials'],['digital','design'],['leasing','collaboration'],['energy','logistics'],['logistics','digital'],['collaboration','business'],['materials','energy'],['leasing','business'],['design','collaboration'],['logistics','collaboration'],['digital','energy'],['business','leasing']];
    trips.forEach(([a,b],i)=>{const p=person(i%3?P.brick:P.dark,.42);const path=routeCurve(shortest(a,b),i%2?.32:-.32,.16);if(path)walkers.push({...p,path,length:path.getLength(),offset:i*.083});});
    function vehicle(path,isTruck=false,offset=0) {
      const g=new THREE.Group();landscape.add(g);
      const color=isTruck?P.cream:P.brick;
      box(g,0,.17,0,.26,.18,isTruck?.64:.44,color);box(g,0,.32,isTruck?.2:0,.23,.16,.25,isTruck?P.brick:P.white);box(g,0,.34,.14,.19,.09,.025,P.glass);
      if(isTruck)box(g,0,.35,-.16,.25,.3,.36,P.cream);
      for(const x of [-.15,.15])for(const z of [-.16,.16]){const o=cyl(g,x,.1,z,.07,.04,P.dark);o.rotation.z=Math.PI/2;}
      vehicles.push({g,path,length:path.getLength(),offset,truck:isTruck});
    }
    const ringRoute=[...shortest('digital','leasing'),...shortest('leasing','design'),...shortest('design','energy'),...shortest('energy','east'),...shortest('east','west'),...shortest('west','business'),...shortest('business','digital')];
    const ringPath=routeCurve(ringRoute,.13,.16);vehicle(ringPath,false,.13);vehicle(ringPath,false,.59);
    vehicle(routeCurve(shortest('energy','logistics'),-.1,.25),true,.1);
    // Curved sea lanes connect the harbor and collaboration cove, staying south of both islands.
    const seaLane=curve([[-6.7,9.5,-.35],[-3,10.5,-.35],[.5,10,-.35],[4,10.1,-.35],[8.6,8.5,-.35],[8.7,5,-.35]],false);
    const seaRoute=ribbon(seaLane,.045,P.foam,0,80);seaRoute.visible=true;
    function boat(path,offset,small=false) {
      const g=new THREE.Group();landscape.add(g);const hull=box(g,0,.06,0,small?.28:.47,.2,small?.65:1.15,P.white);hull.rotation.z=.03;
      box(g,0,.24,-.1,small?.23:.34,.2,small?.27:.48,P.wood);box(g,0,.37,-.1,small?.26:.38,.06,small?.3:.52,P.white);
      if(!small){cyl(g,0,.54,.2,.015,.75,P.wood);const sail=mesh(coneGeo,P.white,g,.12,.64,.2);sail.scale.set(.26,.59,.02);sail.rotation.z=-.15;}
      boats.push({g,path,offset});
    }
    boat(seaLane,.12);boat(seaLane,.68,true);
    for(let i=0;i<5;i++){const g=new THREE.Group(),wings=[];landscape.add(g);for(const side of [-1,1])wings.push(box(g,side*.13,0,0,.26,.025,.075,P.white));birds.push({g,wings,offset:i*.8});}
    // Collaboration overlays are graph routes; roads and bridges remain visible when these are off.
    const routeGroup=new THREE.Group();landscape.add(routeGroup);const routeDots=[];
    let showRoutes=true, selected='energy', connected=null;
    function clearRoutes(){while(routeGroup.children.length){const o=routeGroup.children.pop();o.parent=null;if(o.geometry&&o.geometry!==unitSphere){geometries.delete(o.geometry);o.geometry.dispose();}}routeDots.length=0;}
    function drawRoutes(pairs) {
      clearRoutes();const seen=new Set();
      for(const [a,b] of pairs){const path=shortest(a,b);if(!path.length)continue;
        for(const {edge} of path){const key=[edge.a,edge.b].sort().join(':');if(seen.has(key))continue;seen.add(key);const raised=new THREE.CatmullRomCurve3(edge.path.getPoints(36).map(p=>p.clone().add(new THREE.Vector3(0,.047,0))));tube(raised,.052,P.route,routeGroup);const dot=ellipsoid(routeGroup,0,0,0,.065,.065,.065,P.white);const offset=routeDots.length*.19;dot.position.copy(raised.getPointAt(offset%1));routeDots.push({dot,path:raised,offset});}
      }
      routeGroup.visible=showRoutes;
    }
    function select(id) {
      if(!districtMap.has(id))return;selected=id;connected=null;
      const partners=(districtMap.get(id).topic.partners||[]).map(p=>Array.isArray(p)?p[0]:p.id).filter(p=>districtMap.has(p));
      districtMap.forEach((d,key)=>{d.halo.visible=key===id||partners.includes(key);d.glowMat.opacity=key===id?.35:.15;});
      labels.forEach(({el})=>{const active=el.dataset.topic===id;el.classList.toggle('active',active);el.classList.remove('route-endpoint');el.classList.toggle('partner',partners.includes(el.dataset.topic));el.setAttribute('aria-pressed',String(active));});
      drawRoutes(partners.map(p=>[id,p]));
    }
    function connect(fromId,toId) {
      if(!districtMap.has(fromId)||!districtMap.has(toId))return false;
      connected=[fromId,toId];labels.forEach(({el})=>{el.classList.remove('partner');el.classList.toggle('route-endpoint',connected.includes(el.dataset.topic));});districtMap.forEach((d,key)=>{d.halo.visible=connected.includes(key);d.glowMat.opacity=key===fromId?.35:.23;});
      drawRoutes([[fromId,toId]]);return true;
    }
    let width=0,height=0,paused=false,reduced=false,touring=false,disposed=false,raf=0,time=0,last=0,pointerDown=null;
    const defaultPosition=new THREE.Vector3(), fitTarget=mapPoint(new THREE.Vector3(0,.25,1.1));
    function fit() {
      controls.target.copy(fitTarget);const dir=new THREE.Vector3(.22,.48,1).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize();
      const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=22;
      function include(p,padX=12,padY=12){const r=p.clone().sub(fitTarget),depth=r.dot(dir),usableX=Math.max(.3,1-2*padX/width),usableY=Math.max(.3,1-2*padY/height);distance=Math.max(distance,depth+Math.abs(r.dot(right))/(tan*camera.aspect*usableX),depth+Math.abs(r.dot(up))/(tan*usableY));}
      // Natural shoreline and district labels are fitted together. UI bars get explicit breathing room.
      for(const [x,z] of [...mainCoast,...portCoast,...learnCoast])include(mapPoint(v(x,z,.8)),20,82);
      labels.forEach(({el,anchor})=>include(mapPoint(anchor),Math.max(42,labels.find(item=>item.el===el)?.width/2||45)+10,112));
      distance*=1.045;defaultPosition.copy(dir).multiplyScalar(distance).add(fitTarget);camera.position.copy(defaultPosition);controls.maxDistance=Math.max(70,distance*1.6);controls.update();
    }
    function measureLabels(){labels.forEach(item=>{item.width=(item.el.offsetWidth||90)+2;item.height=(item.el.offsetHeight||30)+2;});}
    function resize(){const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);if(w===width&&h===height)return;width=w;height=h;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);measureLabels();fit();}
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    document.fonts?.ready.then(()=>{if(!disposed){measureLabels();fit();}});
    function stopTour(){if(touring){touring=false;container.dispatchEvent(new CustomEvent('island-tour-stop'));onTourStop();}}
    controls.addEventListener('start',stopTour);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    function intersect(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(pickables,false)[0];}
    const onDown=e=>{pointerDown={x:e.clientX,y:e.clientY};};
    const onUp=e=>{if(pointerDown&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)<6){const hit=intersect(e);if(hit){const id=hit.object.userData.topicId;select(id);onSelect(id);}}pointerDown=null;};
    const onMove=e=>{renderer.domElement.style.cursor=intersect(e)?'pointer':pointerDown?'grabbing':'grab';};
    const onCancel=()=>{pointerDown=null;};
    renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointercancel',onCancel);
    function setNight(value){const night=!!value;hemi.intensity=night?1.1:2.35;sun.intensity=night?.65:2.6;fill.intensity=night?.7:1;sun.color.set(night?'#96b8e7':'#ffedce');hemi.color.set(night?'#8098c6':'#e7f5fb');P.water.color.set(night?'#204e65':'#438da2');P.shallow.color.set(night?'#39717c':'#7bb6b5');P.window.emissiveIntensity=night?2.2:.04;P.route.emissiveIntensity=night?1.1:.2;scene.fog.color.set(night?'#193c56':'#c7e3e4');renderer.toneMappingExposure=night?1:1.02;}
    const projected=new THREE.Vector3(),pos=new THREE.Vector3(),tangent=new THREE.Vector3();
    function locate(g,path,u,yOffset=0) {path.getPointAt(u,pos);path.getTangentAt(u,tangent);g.position.copy(pos);g.position.y+=yOffset;g.rotation.y=Math.atan2(tangent.x,tangent.z);}
    function placeLabels(){
      const maxShift=40,gap=3.2;
      const items=labels.map(item=>{
        projected.copy(mapPoint(item.anchor)).project(camera);
        const w=item.width||90,h=item.height||30;
        const minX=w/2+8,maxX=width-w/2-8,minY=104+h/2,maxY=height-60-h/2;
        const x=THREE.MathUtils.clamp((projected.x*.5+.5)*width,minX,maxX);
        const y=THREE.MathUtils.clamp((-projected.y*.5+.5)*height,minY,maxY);
        // Carry the previous screen offset forward. Restarting from the anchor on
        // every frame can reverse pair ordering after subpixel camera movement.
        const previous=item.layout;
        let dx=previous?(previous.x-previous.baseX)*.985:0;
        let dy=previous?(previous.y-previous.baseY)*.985:0;
        const length=Math.hypot(dx,dy);if(length>maxShift){dx*=maxShift/length;dy*=maxShift/length;}
        return {...item,w,h,x:THREE.MathUtils.clamp(x+dx,minX,maxX),y:THREE.MathUtils.clamp(y+dy,minY,maxY),baseX:x,baseY:y,minX,maxX,minY,maxY,hidden:projected.z>1};
      });
      // Leave a settled layout alone while the camera is effectively stationary.
      if(items.every((item,i)=>{const old=labels[i].layout;return old&&old.hidden===item.hidden&&old.w===item.w&&old.h===item.h&&Math.abs(old.baseX-item.baseX)<.35&&Math.abs(old.baseY-item.baseY)<.35;}))return;
      const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+gap&&Math.abs(a.y-b.y)<(a.h+b.h)/2+gap;
      function capacity(item,axis,direction){
        const other=axis==='x'?'y':'x',base=axis==='x'?item.baseX:item.baseY,otherBase=axis==='x'?item.baseY:item.baseX;
        const radius=Math.sqrt(Math.max(0,maxShift*maxShift-(item[other]-otherBase)**2));
        const low=Math.max(base-radius,axis==='x'?item.minX:item.minY),high=Math.min(base+radius,axis==='x'?item.maxX:item.maxY);
        return Math.max(0,direction<0?item[axis]-low:high-item[axis]);
      }
      // Resolve pairs together rather than offsetting individual district names. Most pairs
      // separate vertically; horizontal space is used when the UI boundary constrains that.
      for(let pass=0;pass<24;pass++){
        let collisions=0;
        for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
          const a=items[i],b=items[j];if(a.hidden||b.hidden||!overlap(a,b))continue;collisions++;
          const choices=['y','x'].map(axis=>{
            const lower=a[axis]<=b[axis]?a:b,upper=lower===a?b:a,size=axis==='x'?'w':'h';
            const required=(lower[size]+upper[size])/2+gap-(upper[axis]-lower[axis]);
            const lowCap=capacity(lower,axis,-1),highCap=capacity(upper,axis,1);
            return {axis,lower,upper,required,lowCap,highCap,possible:lowCap+highCap>=required-.001};
          });
          const c=choices.find(c=>c.possible)||choices.sort((a,b)=>(b.lowCap+b.highCap)/b.required-(a.lowCap+a.highCap)/a.required)[0];
          const amount=Math.min(c.required,c.lowCap+c.highCap);
          let lowMove=Math.min(amount/2,c.lowCap),highMove=Math.min(amount-lowMove,c.highCap);
          lowMove=Math.min(c.lowCap,amount-highMove);
          c.lower[c.axis]-=lowMove;c.upper[c.axis]+=highMove;
        }
        if(!collisions)break;
      }
      // A small local fallback handles three-way collisions without moving a label farther
      // than 40 px from its original clamped projection. Clear desktop layouts stay exact.
      if(items.some((a,i)=>items.slice(i+1).some(b=>overlap(a,b)))){
        const offsets=[[0,0],[0,-40],[0,40],[-40,0],[40,0]];
        for(const dx of [-32,-16,0,16,32])for(const dy of [-32,-16,0,16,32])if(dx*dx+dy*dy<=1600)offsets.push([dx,dy]);
        const score=(item,x,y)=>{
          let result=(x-item.baseX)**2+(y-item.baseY)**2;
          for(const other of items){if(other===item||other.hidden)continue;const ox=(item.w+other.w)/2+gap-Math.abs(x-other.x),oy=(item.h+other.h)/2+gap-Math.abs(y-other.y);if(ox>0&&oy>0)result+=100000+ox*oy*100;}
          return result;
        };
        for(let pass=0;pass<3;pass++)for(const item of items){
          if(item.hidden||!items.some(other=>other!==item&&!other.hidden&&overlap(item,other)))continue;
          let best={x:item.x,y:item.y,value:score(item,item.x,item.y)};
          for(const [dx,dy] of offsets){const x=THREE.MathUtils.clamp(item.baseX+dx,item.minX,item.maxX),y=THREE.MathUtils.clamp(item.baseY+dy,item.minY,item.maxY),value=score(item,x,y);if(value<best.value)best={x,y,value};}
          item.x=best.x;item.y=best.y;
        }
      }
      for(let i=0;i<items.length;i++){
        const item=items[i],old=labels[i].layout;
        if(old){const oldDx=old.x-old.baseX,oldDy=old.y-old.baseY;
          const dx=item.x-item.baseX-oldDx,dy=item.y-item.baseY-oldDy,length=Math.hypot(dx,dy);
          if(length>2){item.x=THREE.MathUtils.clamp(item.baseX+oldDx+dx*2/length,item.minX,item.maxX);item.y=THREE.MathUtils.clamp(item.baseY+oldDy+dy*2/length,item.minY,item.maxY);}}
        labels[i].layout={x:item.x,y:item.y,baseX:item.baseX,baseY:item.baseY,w:item.w,h:item.h,hidden:item.hidden};item.el.style.left=`${item.x}px`;item.el.style.top=`${item.y}px`;item.el.style.visibility=item.hidden?'hidden':'visible';}
    }
    function animate(now){if(disposed)return;raf=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05)||0;last=now;if(document.hidden)return;
      const moving=!paused&&!reduced;if(moving)time+=dt;
      if(moving){fans.forEach(g=>g.rotation.y=time*4);
        walkers.forEach(w=>{const phase=(time*.23/w.length+w.offset)%2,u=phase<1?phase:2-phase;locate(w.g,w.path,u);if(phase>1)w.g.rotation.y+=Math.PI;w.limbs.forEach((l,i)=>l.rotation.x=Math.sin(time*7+w.offset*10)*(i%2?1:-1)*.48);});
        vehicles.forEach(o=>{const phase=(time*(o.truck?.52:.72)/o.length+o.offset)%(o.truck?2:1),u=o.truck?(phase<1?phase:2-phase):phase;locate(o.g,o.path,u);if(o.truck&&phase>1)o.g.rotation.y+=Math.PI;});
        boats.forEach(b=>{const p=(time*.016+b.offset)%2,u=p<1?p:2-p;locate(b.g,b.path,u,Math.sin(time*1.7)*.018);if(p>1)b.g.rotation.y+=Math.PI;});
        birds.forEach((b,i)=>{const a=time*.105+b.offset;b.g.position.set(Math.cos(a)*9,3.7+Math.sin(a*2)*.4,1+Math.sin(a)*7);b.g.rotation.y=-a;b.wings.forEach((w,j)=>w.rotation.z=Math.sin(time*5+i)*.35*(j?-1:1));});
        waves.forEach(w=>{w.g.position.x=Math.sin(time*.5+w.phase)*.08;});
        if(touring){const d=defaultPosition.clone().sub(fitTarget).length(),a=time*.045;camera.position.lerp(new THREE.Vector3(Math.sin(a)*.88,.45,Math.cos(a)*.88).normalize().multiplyScalar(d).add(fitTarget),.015);}
      }
      if(!paused&&!reduced)routeDots.forEach(o=>{o.dot.position.copy(o.path.getPointAt((time*.12+o.offset)%1));});
      controls.update();placeLabels();renderer.render(scene,camera);
    }
    walkers.forEach(w=>locate(w.g,w.path,w.offset%1));vehicles.forEach(o=>locate(o.g,o.path,o.offset));boats.forEach(o=>locate(o.g,o.path,o.offset));birds.forEach((b,i)=>b.g.position.set(-5+i*.7,4+i*.1,-4));
    select(districtMap.has('energy')?'energy':topics[0]?.id);raf=requestAnimationFrame(animate);onReady();
    return {select,connect,setPaused(value){paused=!!value;},setNight,setRoutes(value){showRoutes=!!value;routeGroup.visible=showRoutes;seaRoute.visible=showRoutes;},setReducedMotion(value){reduced=!!value;controls.enableDamping=!reduced;},resetView(){stopTour();controls.target.copy(fitTarget);camera.position.copy(defaultPosition);controls.update();},tour(value){touring=!!value;},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.removeEventListener('start',stopTour);controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointercancel',onCancel);labels.forEach(({el})=>el.remove());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();}};
  } catch(error){if(renderer){renderer.dispose();renderer.domElement.remove();}onError(error);throw error;}
}
