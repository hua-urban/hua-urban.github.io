import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';

// This pure layout is shared by rendered roads and headless connectivity checks.
export const ROAD_LAYOUT = {
  nodes: {operations:[-4.6,-1.8],assets:[-1.4,-3.35],funding:[1.3,-1.85],renovation:[4.7,-2.3],leasing:[5,1.1],legal:[-5.2,1],center:[-.1,.9],west:[-3.35,2.7],east:[3.3,2.75],marketing:[-5.4,6.65],maintenance:[4.7,6.65]},
  links: [
    ['operations','assets',[[-3.5,-2.8]]], ['assets','renovation',[[.6,-3.4],[2.8,-3.3]]],
    ['renovation','leasing',[[5.7,-.8]]], ['leasing','east',[[4.4,2.4]]],
    ['east','west',[[1.8,2.9],[-.7,2.7]]], ['west','legal',[[-4.7,2.2]]],
    ['legal','operations',[[-5.8,-.3]]], ['assets','funding',[[0,-2.9]]],
    ['funding','renovation',[[3,-2.1]]], ['funding','center',[[1,-.5]]],
    ['center','legal',[[-2.4,.6]]], ['center','leasing',[[2.5,.65]]],
    ['center','west',[[-1.9,1.65]]], ['center','east',[[1.6,1.8]]],
    ['west','marketing',[[-3.7,3.7],[-4.4,5]],true],
    ['east','maintenance',[[3.6,4],[4.2,5.4]],true],
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
    renderer.domElement.setAttribute('aria-label', '暖磚老街中的 B 組老屋現金流升級群島，可拖曳旋轉與點選街區');
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
    // B opens as a diagonal neighborhood chain; one shared transform keeps all layers aligned.
    landscape.scale.set(1.12,1,.88);landscape.rotation.y=.34;
    landscape.updateMatrix();
    const mapPoint = point => point.clone().applyMatrix4(landscape.matrix);
    const geometries = new Set(), materials = new Set();
    const material = (color, opts={}) => { const m=new THREE.MeshStandardMaterial({color,roughness:.88,...opts}); materials.add(m); return m; };
    const P = {
      grass:material('#929b76'), grassLight:material('#b9bf96'), deepGreen:material('#687858'),
      sand:material('#e0cda7'), wetSand:material('#bdc8a7'), rock:material('#9ba189'),
      road:material('#a59180'), pavement:material('#d7c3a9'), stripe:material('#f4e6be'),
      cream:material('#eae4d1'), white:material('#f6f1e4'), brick:material('#b87359'), roof:material('#a8664e'),
      wood:material('#ae8960'), trunk:material('#846447'), leaf:material('#4f805c'), leaf2:material('#6a9567'),
      glass:material('#81adb2',{roughness:.3,metalness:.1}), dark:material('#41575a'),
      window:material('#d5e6df',{emissive:'#ffc875',emissiveIntensity:.04}),
      skin:material('#dcb38e'), gold:material('#dfb65e'), tile:material('#997a50'), moss:material('#759451'),
      water:material('#6aadb0',{roughness:.34,metalness:.12}), shallow:material('#a0cbbb',{roughness:.55}),
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
    let seed=291;
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
    const mainCoast=[[-8.3,.3],[-7.7,-2.8],[-6.3,-5.9],[-4.6,-7],[-1.5,-7.25],[1.7,-6.35],[4.9,-5.9],[6.4,-3.8],[7.1,-1.6],[7.8,.2],[7.4,2.3],[6,3.8],[3.7,4.3],[1.4,3.8],[-.9,3.55],[-3.1,3.9],[-5.6,3.6],[-7.6,2.5]];
    const serviceCoast=[[-8,6.6],[-7.3,5.65],[-6.1,5.15],[-4.75,5.4],[-3.65,5.95],[-3.2,7.35],[-3.75,8.65],[-5.2,8.8],[-7.4,8.15]];
    const careCoast=[[2.7,6.3],[3.3,5.4],[4.7,5.15],[6.5,5.4],[7.6,6.35],[7.7,7.8],[6.65,8.9],[5,9.15],[3.45,8.5],[2.8,7.5]];
    for(const outline of [mainCoast,serviceCoast,careCoast]) {
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
      const ridge=.55+.2*Math.sin(x*1.55)+.13*Math.cos(x*2.9+z*1.2);
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
    // One connected street graph supports route selection, pedestrians, cars and service deliveries.
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
        box(g,0,h+.1,0,w+.09,.12,d+.09,kind==='workshop'?P.brick:P.white);
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
      if(topic.id==='assets') {
        // A staggered old-street frontage and a shared courtyard for housing assessment.
        for(const [a,b,h] of [[-1.1,-.8,1.15],[-.34,-1.02,1.42],[.45,-.88,1.06],[1.12,-.64,1.25]]) {
          const house=building(root,a,b,.61,.7,h,'house',a<0?P.brick:P.cream);
          box(house,0,.52,.4,.67,.07,.28,P.wood);
        }
        building(root,-1.02,.57,.64,.62,.86,'house',P.white);
        box(root,.36,.12,.58,1.2,.07,.73,P.sand);
        for(const a of [-.2,.75]){box(root,a,.28,.65,.42,.08,.17,P.wood);tree(x+a,z+1,.43);}
      } else if(topic.id==='funding') {
        // A modest neighborhood funding desk, scaled to the surrounding homes.
        const desk=building(root,.05,-.82,1.12,.7,1.18,'office',P.cream);
        box(desk,0,.72,.43,1.22,.1,.32,P.deepGreen);
        for(const a of [-.43,.43])cyl(desk,a,.36,.49,.025,.65,P.wood);
        building(root,1.18,.25,.64,.67,1.07,'house',P.brick);
        building(root,-1.02,.12,.63,.69,.9,'house',P.white);
        tree(x-1.25,z-.82,.6);tree(x+.62,z+.85,.46);
      } else if(topic.id==='renovation') {
        // A small repair yard: scaffold, salvaged doors, timber and tile samples.
        const workshop=building(root,.12,-.85,1.15,.72,.9,'house',P.brick);
        for(const a of [-.58,0,.58])for(const b of [-.4,.42])cyl(workshop,a,.72,b,.018,1.4,P.dark);
        for(const y of [.48,.94,1.4])box(workshop,0,y,.43,1.25,.025,.035,P.wood);
        box(root,-.8,.13,.48,.88,.1,.84,P.pavement);
        for(let j=0;j<4;j++)box(root,-1.1+j*.19,.25,.46,.13,.18,.64,j%2?P.brick:P.cream);
        for(let j=0;j<3;j++)box(root,.45+j*.2,.3,.56,.13,.39,.42,P.wood);
        building(root,1.18,-.15,.52,.6,.58,'office',P.white);tree(x+.92,z-1.35,.5);
      } else if(topic.id==='leasing') {
        // Rental information windows open onto an intimate covered residential lane.
        const shop=building(root,.3,-.6,1.25,.83,1.18,'house',P.cream);
        box(shop,0,.75,.5,1.36,.09,.4,P.deepGreen);
        for(let j=0;j<3;j++)box(shop,-.35+j*.35,.48,.445,.24,.28,.025,P.white);
        building(root,-1.02,-.5,.64,.7,1.35,'house',P.brick);
        building(root,.98,.74,.62,.61,.92,'house',P.white);
        box(root,-.35,.18,.69,1.1,.16,.78,P.sand);
        for(const a of [-.8,.1])cyl(root,a,.65,.97,.025,1.1,P.wood);
        box(root,-.35,1.2,.97,1.25,.08,.45,P.wood);tree(x-1.3,z+.8,.6);
      } else if(topic.id==='operations') {
        // A residential management office with keys, noticeboard and delivery lockers.
        const office=building(root,-.15,-.65,1,.8,1.35,'house',P.white);
        box(office,0,.82,.49,1.1,.09,.35,P.brick);
        building(root,-1.1,.2,.63,.66,.94,'house',P.cream);
        building(root,.94,.32,.64,.69,1.12,'house',P.brick);
        for(let j=0;j<3;j++){box(root,-.55+j*.28,.43,.7,.24,.6,.28,P.deepGreen);box(root,-.55+j*.28,.49,.851,.13,.025,.02,P.gold);}
        box(root,.5,.64,-1.18,.46,.5,.05,P.wood);tree(x-1.35,z-.8,.6);
      } else if(topic.id==='legal') {
        // A quiet contract consultation courtyard and low-rise professional office.
        building(root,-.85,-.55,.72,.75,1.12,'house',P.cream);
        const office=building(root,.18,-.74,.82,.68,1.3,'office',P.brick);
        box(office,0,.85,.39,.92,.08,.28,P.white);
        building(root,1.02,.38,.6,.64,.84,'house',P.white);
        cyl(root,-.1,.14,.61,.53,.08,P.sand);cyl(root,-.1,.46,.61,.28,.08,P.wood);
        for(const a of [-1,1]){const p=person(a<0?P.dark:P.brick,.46);p.g.position.set(x-.1+a*.38,.16,z+.61);p.g.rotation.y=a<0?Math.PI/2:-Math.PI/2;}
        tree(x-1.2,z+.8,.7);tree(x+.8,z-1.25,.6);
      } else if(topic.id==='marketing') {
        // Community resources and brand materials arrive through a compact service pier.
        building(root,-.65,-.4,.9,.72,.95,'house',P.brick);
        const studio=building(root,.58,-.34,.76,.72,1.13,'house',P.cream);
        box(studio,0,.74,.44,.87,.09,.28,P.deepGreen);
        box(root,-.12,.12,.77,2.25,.1,.5,P.pavement);
        for(let j=0;j<3;j++){box(root,-.7+j*.45,.32,.68,.32,.3,.35,P.wood);box(root,-.7+j*.45,.5,.68,.34,.05,.38,P.cream);}
        for(const px of [-1.05,.75]){box(root,px,-.02,1.7,.28,.13,1.36,P.wood);for(const zz of [1.2,2.23])cyl(root,px,-.28,zz,.04,.6,P.wood);}
        box(root,-.12,.48,1.05,.46,.62,.06,P.deepGreen);tree(x-1.45,z-.7,.6);
      } else if(topic.id==='maintenance') {
        // Maintenance and care resources meet around a sheltered neighborhood service station.
        building(root,-.85,-.55,.74,.7,.9,'house',P.cream);
        const care=building(root,.46,-.56,.91,.74,1.02,'house',P.white);
        box(care,0,.69,.45,1.02,.08,.35,P.deepGreen);
        box(root,-.2,.13,.64,1.35,.08,1.1,P.sand);
        for(const a of [-.77,.38])for(const b of [.25,1.08])cyl(root,a,.68,b,.03,1.13,P.wood);
        box(root,-.2,1.25,.65,1.48,.09,1.18,P.wood);
        cyl(root,-.2,.48,.63,.3,.08,P.wood);
        for(const a of [-1,1]){const p=person(a<0?P.dark:P.brick,.44);p.g.position.set(x-.2+a*.4,.14,z+.63);p.g.rotation.y=a<0?Math.PI/2:-Math.PI/2;}
        for(let j=0;j<3;j++)box(root,1.12,.24,-.1+j*.27,.32,.3,.2,j%2?P.wood:P.deepGreen);
        for(const [a,b] of [[-1.4,.2],[1.25,.9],[.6,1.5],[-.9,1.4],[-1.2,-1.2]])tree(x+a,z+b,.6);
        ribbon(curve([[x-1,z-.5],[x-1.2,z+.5],[x,z+1.4],[x+1,z+.7]]),.19,P.sand,.005,30);
      }
    }
    // A shared tool cupboard beside the care island supports the resource connection.
    const cupboard=new THREE.Group();cupboard.position.set(6.25,.09,6.8);landscape.add(cupboard);
    box(cupboard,0,.42,0,.58,.8,.34,P.cream);box(cupboard,0,.87,0,.68,.09,.44,P.deepGreen);
    for(const xx of [-.13,.13]){box(cupboard,xx,.43,.18,.22,.6,.025,P.wood);cyl(cupboard,xx+.05,.45,.21,.025,.04,P.gold);}

    // A neighborhood square, repair stalls and benches link the old street courtyards.
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
      if(x>3&&z<-.15)continue; // repair yards and housing entrances stay legible
      tree(x,z,.34+random()*.38);urbanGreens.push([x,z]);
    }
    // Informal planting along the harbor shore avoids a decorative ring of identical trees.
    for(let i=0;i<14;i++){const x=-7.1+random()*.75,z=5.95+random()*1.9;if(isClearPlot(x,z))tree(x,z,.45+random()*.35);}
    for(const [x,z] of urbanGreens.filter((_,i)=>i%3===0)) {
      const planter=box(landscape,x+.18,.13,z,.35,.13,.27,P.rock);planter.rotation.y=random()*2;
      for(let j=0;j<3;j++)ellipsoid(landscape,x+.07+j*.1,.26,z,.12,.13,.12,j%2?P.leaf:P.leaf2);
      for(let j=0;j<2;j++)ellipsoid(landscape,x+.12+j*.14,.37,z,.035,.035,.035,j%2?P.gold:P.brick);
    }
    // Reclaimed paving and moss planters make a small shared residential courtyard.
    for(let i=0;i<9;i++){const x=-2.9+(i%3)*.45,z=-1.4+Math.floor(i/3)*.3;box(landscape,x,.12,z,.35,.07,.22,i%2?P.brick:P.cream);}
    for(const x of [-3.1,-1.7]){box(landscape,x,.2,-1.2,.23,.24,.9,P.rock);for(let j=0;j<4;j++)ellipsoid(landscape,x,.36,-1.5+j*.2,.13,.12,.14,P.leaf2);}
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
    for(const outline of [mainCoast,serviceCoast,careCoast]) {
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
    const trips=[['legal','funding'],['operations','renovation'],['assets','maintenance'],['leasing','marketing'],['marketing','operations'],['maintenance','legal'],['funding','leasing'],['assets','legal'],['renovation','maintenance'],['marketing','maintenance'],['operations','leasing'],['legal','assets']];
    trips.forEach(([a,b],i)=>{const p=person(i%3?P.brick:P.dark,.42);const path=routeCurve(shortest(a,b),i%2?.32:-.32,.16);if(path)walkers.push({...p,path,length:path.getLength(),offset:i*.083});});
    function vehicle(path,isTruck=false,offset=0) {
      const g=new THREE.Group();landscape.add(g);
      const color=isTruck?P.cream:P.brick;
      box(g,0,.17,0,.26,.18,isTruck?.64:.44,color);box(g,0,.32,isTruck?.2:0,.23,.16,.25,isTruck?P.brick:P.white);box(g,0,.34,.14,.19,.09,.025,P.glass);
      if(isTruck)box(g,0,.35,-.16,.25,.3,.36,P.cream);
      for(const x of [-.15,.15])for(const z of [-.16,.16]){const o=cyl(g,x,.1,z,.07,.04,P.dark);o.rotation.z=Math.PI/2;}
      vehicles.push({g,path,length:path.getLength(),offset,truck:isTruck});
    }
    const ringRoute=[...shortest('operations','assets'),...shortest('assets','renovation'),...shortest('renovation','leasing'),...shortest('leasing','east'),...shortest('east','west'),...shortest('west','legal'),...shortest('legal','operations')];
    const ringPath=routeCurve(ringRoute,.13,.16);vehicle(ringPath,false,.13);vehicle(ringPath,false,.59);
    vehicle(routeCurve(shortest('leasing','marketing'),-.1,.25),true,.1);
    // Curved sea lanes connect the service pier and care cove, staying south of both islands.
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
    let showRoutes=true, selected='assets', connected=null;
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
      controls.target.copy(fitTarget);const dir=new THREE.Vector3(.22,.82,1).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize();
      const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=22;
      function include(p,padX=12,padY=12){const r=p.clone().sub(fitTarget),depth=r.dot(dir),usableX=Math.max(.3,1-2*padX/width),usableY=Math.max(.3,1-2*padY/height);distance=Math.max(distance,depth+Math.abs(r.dot(right))/(tan*camera.aspect*usableX),depth+Math.abs(r.dot(up))/(tan*usableY));}
      // Natural shoreline and district labels are fitted together. UI bars get explicit breathing room.
      for(const [x,z] of [...mainCoast,...serviceCoast,...careCoast])include(mapPoint(v(x,z,.8)),20,82);
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
    function setNight(value){const night=!!value;hemi.intensity=night?1.1:2.35;sun.intensity=night?.65:2.6;fill.intensity=night?.7:1;sun.color.set(night?'#96b8e7':'#ffedce');hemi.color.set(night?'#8098c6':'#e7f5fb');P.water.color.set(night?'#204e65':'#6aadb0');P.shallow.color.set(night?'#39717c':'#a0cbbb');P.window.emissiveIntensity=night?2.2:.04;P.route.emissiveIntensity=night?1.1:.2;scene.fog.color.set(night?'#193c56':'#c7e3e4');renderer.toneMappingExposure=night?1:1.02;}
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
        if(touring){const d=defaultPosition.clone().sub(fitTarget).length(),a=time*.045;camera.position.lerp(new THREE.Vector3(Math.sin(a)*d*.45,d*.66,Math.cos(a)*d*.7).add(fitTarget),.015);}
      }
      if(!paused&&!reduced)routeDots.forEach(o=>{o.dot.position.copy(o.path.getPointAt((time*.12+o.offset)%1));});
      controls.update();placeLabels();renderer.render(scene,camera);
    }
    walkers.forEach(w=>locate(w.g,w.path,w.offset%1));vehicles.forEach(o=>locate(o.g,o.path,o.offset));boats.forEach(o=>locate(o.g,o.path,o.offset));birds.forEach((b,i)=>b.g.position.set(-5+i*.7,4+i*.1,-4));
    select(districtMap.has('assets')?'assets':topics[0]?.id);raf=requestAnimationFrame(animate);onReady();
    return {select,connect,setPaused(value){paused=!!value;},setNight,setRoutes(value){showRoutes=!!value;routeGroup.visible=showRoutes;seaRoute.visible=showRoutes;},setReducedMotion(value){reduced=!!value;controls.enableDamping=!reduced;},resetView(){stopTour();controls.target.copy(fitTarget);camera.position.copy(defaultPosition);controls.update();},tour(value){touring=!!value;},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.removeEventListener('start',stopTour);controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointercancel',onCancel);labels.forEach(({el})=>el.remove());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();}};
  } catch(error){if(renderer){renderer.dispose();renderer.domElement.remove();}onError(error);throw error;}
}
