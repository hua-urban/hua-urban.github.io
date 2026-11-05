import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';

// This pure layout is shared by rendered roads and headless connectivity checks.
export const ROAD_LAYOUT = {
  nodes: {finance:[-5.9,-2.2],rights:[-2.4,-4.3],rental:[5.1,-2.1],funding:[1.5,-4.5],owners:[-6.2,1.1],design:[6.25,1.2],care:[-2.15,6.45],supply:[7.8,7.15],west:[-4.8,-1.3],center:[0,-3.05],east:[4.3,-.95],westtip:[-5.6,3.2],easttip:[6.5,3.15]},
  links: [
    ['owners','finance',[[-7.5,1.1],[-7.6,-.7],[-7.2,-2.2]]], ['finance','rights',[[-4.65,-2.2],[-3.7,-3.85]]],
    ['rights','funding',[[-.5,-4.35]]], ['funding','rental',[[3,-4],[3.35,-2.3],[4,-2.1]]],
    ['rental','design',[[7,-2.05],[7.5,-.1],[7.5,1.2]]], ['owners','west',[[-4.95,1.1],[-5,-.4]]],
    ['west','center',[[-3.6,-2.6],[-1.8,-3]]], ['center','east',[[2,-2.8],[3.5,-1.85]]],
    ['east','design',[[5.25,-.1],[5.3,1.35],[6.1,1.6]]], ['finance','west',[]], ['rights','center',[[-1.4,-3.65]]],
    ['funding','center',[[.7,-3.8]]], ['rental','east',[]],
    ['owners','westtip',[[-5.9,2.25]]], ['westtip','care',[[-4.6,4.6],[-4,6.6],[-3,6.65]],true],
    ['design','easttip',[[6.6,2.25]]], ['easttip','supply',[[6.6,4.8],[6.1,6.6],[6.6,7.35]],true],
  ],
};
// Outlines are also exported for geometry checks without constructing a WebGL renderer.
export const COAST_LAYOUT = {
  main:[[-8,3.4],[-8.9,.4],[-8.4,-3.1],[-6.3,-5.3],[-2.6,-6.4],[1,-6.65],[4.9,-5.2],[7.4,-3.35],[8.5,-.8],[8.3,2],[7.5,4.1],[5.7,4.4],[4.9,2.5],[4.65,1],[3,-1.35],[0,-2.05],[-2.8,-1.45],[-3.9,.6],[-4.2,3.25],[-5.4,5],[-6.9,4.65]],
  service:[[5.9,6.35],[6.8,5.75],[8.5,5.9],[9.8,6.5],[10.1,7.6],[9.1,8.65],[7.4,8.85],[6.1,8],[5.8,7.2]],
  care:[[-4.55,6.15],[-3.8,5.1],[-2.15,4.9],[-.5,5.3],[.3,6.55],[-.2,7.75],[-1.7,8.25],[-3.3,7.9],[-4.4,7.15]],
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
    renderer.domElement.setAttribute('aria-label', 'C 組資產傳承與高齡安居花園海灣，可拖曳旋轉與點選街區');
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
    // C wraps a quiet garden bay; housing and material-port islets sit beyond its two arms.
    landscape.scale.set(1,1,1);landscape.rotation.y=0;
    landscape.updateMatrix();
    const mapPoint = point => point.clone().applyMatrix4(landscape.matrix);
    const geometries = new Set(), materials = new Set();
    const material = (color, opts={}) => { const m=new THREE.MeshStandardMaterial({color,roughness:.88,...opts}); materials.add(m); return m; };
    const P = {
      grass:material('#a6b89b'), grassLight:material('#d2d5bb'), deepGreen:material('#829c87'),
      sand:material('#e7d8b6'), wetSand:material('#c8ccb3'), rock:material('#a8aa99'),
      road:material('#92919a'), pavement:material('#eee5cf'), stripe:material('#f4e6be'),
      cream:material('#eae4d1'), white:material('#f6f1e4'), brick:material('#a493ba'), roof:material('#c6b3d6'),
      wood:material('#ae8960'), trunk:material('#846447'), leaf:material('#7e9e79'), leaf2:material('#a3b58d'),
      glass:material('#81adb2',{roughness:.3,metalness:.1}), dark:material('#41575a'),
      window:material('#d5e6df',{emissive:'#ffc875',emissiveIntensity:.04}),
      skin:material('#dcb38e'), gold:material('#dfb65e'), tile:material('#997a50'), moss:material('#759451'),
      water:material('#83b6b8',{roughness:.34,metalness:.12}), shallow:material('#b9d3c3',{roughness:.55}),
      foam:material('#d1e5ce',{transparent:true,opacity:.48,depthWrite:false}),
      route:material('#9980b6',{emissive:'#9176ad',emissiveIntensity:.2}),
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
    let seed=417;
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
    const mainCoast=COAST_LAYOUT.main,serviceCoast=COAST_LAYOUT.service,careCoast=COAST_LAYOUT.care;
    for(const outline of [mainCoast,serviceCoast,careCoast]) {
      coast(outline,1.065,-.435,.025,P.shallow);
      coast(outline,1.024,-.405,.17,P.rock);
      coast(outline,1.014,-.25,.12,P.wetSand);
      coast(outline,1,-.15,.18,P.sand);
      // Inset is around each island's centroid, so satellite beaches stay equally narrow.
      const cx=outline.reduce((s,p)=>s+p[0],0)/outline.length,cz=outline.reduce((s,p)=>s+p[1],0)/outline.length;
      coast(outline.map(([x,z])=>[cx+(x-cx)*.965,cz+(z-cz)*.965]),1,.025,.06,P.grass);
    }
    const landPolygons=[mainCoast,serviceCoast,careCoast].map(outline=>new THREE.CatmullRomCurve3(outline.map(([x,z])=>v(x,z)),true,'catmullrom',.3).getPoints(100).map(p=>[p.x,p.z]));
    const onLand=(x,z)=>landPolygons.some(poly=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [ax,az]=poly[i],[bx,bz]=poly[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;}return inside;});
    // The peninsula stays low and accessible; the bay is open water rather than a raised platform.
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
    const roadDistanceAt=(x,z)=>Math.min(...edges.map(e=>Math.min(...e.path.getPoints(40).map(p=>Math.hypot(p.x-x,p.z-z)))));
    function tree(x,z,s=1,y=.08) {if(roadDistanceAt(x,z)<.45+s*.35)return;if(![[0,0],[s*.4,0],[-s*.4,0],[0,s*.4],[0,-s*.4]].every(([dx,dz])=>onLand(x+dx,z+dz)))return;treeData.push({x,z,s,y,rot:random()*6.28});}
    function lamp(x,z) {cyl(landscape,x,.42,z,.027,.65,P.dark);ellipsoid(landscape,x,.78,z,.1,.08,.1,P.window);}
    function building(parent,x,z,w,d,h,kind='office',accent=P.cream) {
      buildingPlots.push({x:x+parent.position.x,z:z+parent.position.z,w,d});
      const g=new THREE.Group();g.position.set(x,.09,z);parent.add(g);
      box(g,0,.035,0,w+.13,.07,d+.13,P.pavement);
      const body=box(g,0,h/2+.06,0,w,h,d,accent);
      if(parent.userData.topicId){body.userData.topicId=parent.userData.topicId;pickables.push(body);}
      if(kind==='house') {
        const roof=mesh(coneGeo,P.roof,g,0,h+.18,0);roof.scale.set(w*.78,.3,d*.78);roof.rotation.y=Math.PI/4;
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
      if(topic.id==='finance') {
        // A family consultation pavilion and shaded table make inheritance planning approachable.
        building(root,-.25,-.87,1.75,.85,.95,'house',P.cream);
        box(root,.15,.17,.63,1.65,.09,.8,P.pavement);
        for(const a of [-.55,.8])cyl(root,a,.69,.62,.035,1.05,P.wood);
        box(root,.13,1.23,.62,1.6,.1,.85,P.roof);
        cyl(root,.1,.47,.64,.29,.08,P.wood);
        for(const a of [-.42,.62])box(root,a,.33,.64,.28,.08,.25,P.cream);
      } else if(topic.id==='rights') {
        building(root,-.18,-.88,1.7,.88,1.15,'house',P.white);
        box(root,.1,.18,.6,1.65,.16,.8,P.cream);
        // Parcel lines on a low display table identify the property and succession district.
        for(const a of [-.48,.05,.58])box(root,a,.27,.6,.025,.018,.76,P.gold);
        for(const b of [.4,.8])box(root,.1,.27,b,1.62,.018,.025,P.gold);
        tree(x-1.15,z+.15,.48);
      } else if(topic.id==='funding') {
        const hall=building(root,0,-.78,1.65,.85,1.2,'office',P.cream);
        box(hall,0,1.32,0,1.85,.15,1.02,P.roof);
        for(const a of [-.6,0,.6])cyl(root,a,.52,-.22,.035,.8,P.white);
        box(root,.15,.19,.6,1.5,.17,.65,P.pavement);
        for(let i=0;i<3;i++)box(root,-.35+i*.42,.35+i*.08,.6,.28,.2+i*.16,.35,i%2?P.brick:P.deepGreen);
      } else if(topic.id==='rental') {
        for(const a of [-.73,.64]){
          const home=building(root,a,-.82,.96,.9,1.02,'house',a<0?P.cream:P.white);
          box(home,0,.68,.49,.75,.06,.2,P.brick);
        }
        box(root,.05,.16,.57,1.85,.09,.72,P.sand);
        for(const a of [-.65,.72]){box(root,a,.28,.66,.45,.09,.24,P.wood);tree(x+a,z+1.12,.4);}
      } else if(topic.id==='owners') {
        const hall=building(root,-.1,-.85,1.9,.9,1.05,'house',P.cream);
        box(hall,0,.75,.5,1.9,.09,.3,P.brick);
        box(root,.1,.15,.62,1.8,.1,.85,P.pavement);
        cyl(root,.1,.46,.65,.38,.1,P.wood);
        for(const a of [-.62,.8])box(root,a,.3,.65,.3,.08,.3,P.deepGreen);
        tree(x-1.2,z+.65,.5);
      } else if(topic.id==='design') {
        const studio=building(root,.2,-1.2,.9,.95,1.2,'office',P.white);
        box(studio,.35,1.34,0,.65,.18,.8,P.deepGreen);
        box(root,.15,.34,.6,1.5,.38,.72,P.cream);
        for(const [a,b,h] of [[-.33,.45,.22],[.15,.5,.32],[.6,.65,.18]]){
          box(root,a,.55+h/2,b,.3,h,.26,P.brick);
          box(root,a,.56+h,b,.34,.04,.3,P.roof);
        }
      } else if(topic.id==='care') {
        // Residential courtyard, a transparent lift and a gentle ramp; no clinical imagery.
        for(const a of [-.9,.15])building(root,a,-.85,.8,.65,.82,'house',P.cream);
        const lift=building(root,1.15,-.25,.54,.62,1.85,'office',P.glass);
        for(const y of [.35,.9,1.45])box(lift,0,y,.32,.5,.035,.035,P.white);
        box(root,.95,.17,.7,.95,.14,.6,P.pavement);
        const ramp=box(root,.4,.29,.7,1.15,.09,.48,P.cream);ramp.rotation.z=.18;
        for(const side of [-1,1]){
          const rail=box(root,.4,.55,.7+side*.25,1.16,.025,.025,P.wood);rail.rotation.z=.18;
        }
        box(root,-.85,.18,.64,.6,.16,.5,P.deepGreen);
        tree(x-1.5,z+.6,.45);tree(x+.1,z+1.05,.43);
      } else if(topic.id==='supply') {
        building(root,-.05,-.65,1.2,.7,.82,'workshop',P.cream);
        box(root,-.05,.98,-.65,1.38,.12,.85,P.roof);
        // Sorted masonry, timber and pipes form a small, calm materials working harbor.
        for(let j=0;j<3;j++)for(let k=0;k<2;k++)box(root,.63+j*.28,.19+k*.15,.35,.24,.14,.48,j%2?P.white:P.brick);
        for(let j=0;j<4;j++)box(root,-.95+j*.19,.22,.67,.12,.18,.75,P.wood);
        for(let j=0;j<3;j++){const pipe=cyl(root,.8+j*.19,.25,-.65,.075,.65,P.rock);pipe.rotation.x=Math.PI/2;}
        box(root,0,-.01,1.5,1.55,.16,.95,P.wood);
        for(const a of [-.65,.65])cyl(root,a,.15,1.75,.045,.48,P.wood);
      }
      // Every public doorway and courtyard has a short footpath into its road node.
      ribbon(curve([[x,z-.42],[x+.12,z],[x,z+.65]]),.16,P.pavement,.015,24);
    }
    // Garden furniture sits on the crescent's inner bank and on the residential islet.
    for(const [x,z] of [[-5.25,.25],[-3.2,-2.65],[.4,-3.65],[4.8,-1.45],[6.9,2.4],[-2.1,7.5],[8.9,7.8]]){
      lamp(x,z);box(landscape,x+.2,.28,z,.42,.08,.18,P.wood);
    }
    const distToRoad=roadDistanceAt;
    const isClearPlot=(x,z)=>!buildingPlots.some(p=>Math.abs(x-p.x)<p.w/2+.36&&Math.abs(z-p.z)<p.d/2+.36);
    const inland=(x,z,margin=.38)=>[[0,0],[margin,0],[-margin,0],[0,margin],[0,-margin]].every(([dx,dz])=>onLand(x+dx,z+dz));
    for(let i=0;i<420;i++) {
      const x=-8.1+random()*17.5,z=-5.9+random()*14;
      if(!inland(x,z)||distToRoad(x,z)<.65||!isClearPlot(x,z))continue;
      tree(x,z,.36+random()*.35);
      if(i%7===0){
        box(landscape,x,.17,z,.42,.16,.35,P.cream);
        for(let j=0;j<3;j++)ellipsoid(landscape,x-.12+j*.12,.3,z,.1,.12,.1,j%2?P.brick:P.leaf2);
      }
    }
    // Wisteria shade pergolas punctuate the two landward promenades.
    for(const [x,z] of [[-4.55,-3.85],[3.5,-4.6]]){
      for(const a of [-.6,.6])for(const b of [-.25,.25])cyl(landscape,x+a,.6,z+b,.025,1.04,P.wood);
      for(let j=0;j<5;j++)box(landscape,x-.6+j*.3,1.15,z,.06,.07,.75,P.wood);
      for(let j=0;j<5;j++)ellipsoid(landscape,x-.52+j*.26,1.16,z,.21,.13,.33,P.brick);
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
    for(const [x,z,sx,sz] of [[-8.6,-1.5,1.4,2],[8.6,1.4,1,1.5],[-1,1,2.1,1.5],[-2.5,8.4,2,1],[8.1,9,2,1]]) {
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
      const x=-11+random()*22,z=-5+random()*16;if(onLand(x,z)||distToRoad(x,z)<1)continue;
      const path=curve([[x-.2,z,-.442],[x,z+.04,-.442],[x+.5,z,-.442]]);const w=tube(path,.012,P.foam);waves.push({g:w,phase:i*.6});
    }
    // Walkers cross the two bridges and the town, following precisely the same graph as routes.
    const trips=[['finance','rights'],['owners','design'],['rights','care'],['rental','supply'],['supply','owners'],['care','funding'],['finance','rental'],['rights','funding'],['design','care'],['supply','care']];
    trips.forEach(([a,b],i)=>{const p=person(i%3?P.brick:P.dark,.42);const path=routeCurve(shortest(a,b),i%2?.23:-.23,.16);if(path)walkers.push({...p,path,length:path.getLength(),offset:i*.083});});
    function vehicle(path,isTruck=false,offset=0) {
      const g=new THREE.Group();landscape.add(g);
      const color=isTruck?P.cream:P.brick;
      box(g,0,.17,0,.26,.18,isTruck?.64:.44,color);box(g,0,.32,isTruck?.2:0,.23,.16,.25,isTruck?P.brick:P.white);box(g,0,.34,.14,.19,.09,.025,P.glass);
      if(isTruck)box(g,0,.35,-.16,.25,.3,.36,P.cream);
      for(const x of [-.15,.15])for(const z of [-.16,.16]){const o=cyl(g,x,.1,z,.07,.04,P.dark);o.rotation.z=Math.PI/2;}
      vehicles.push({g,path,length:path.getLength(),offset,truck:isTruck});
    }
    const ringRoute=[...shortest('owners','finance'),...shortest('finance','rights'),...shortest('rights','funding'),...shortest('funding','rental'),...shortest('rental','design'),...shortest('design','east'),...shortest('east','center'),...shortest('center','west'),...shortest('west','owners')];
    const ringPath=routeCurve(ringRoute,.12,.16);vehicle(ringPath,false,.13);vehicle(ringPath,false,.59);
    vehicle(routeCurve(shortest('rental','supply'),-.1,.25),true,.1);
    // Boats approach the garden bay from its open southern mouth, clear of both bridges.
    const seaLane=curve([[3.5,10.5,-.35],[2.4,8.5,-.35],[1.7,6,-.35],[1.1,3.5,-.35],[.3,1.5,-.35],[-.6,.2,-.35]],false);
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
    let showRoutes=true, selected='owners', connected=null;
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
    function setNight(value){const night=!!value;hemi.intensity=night?1.1:2.35;sun.intensity=night?.65:2.6;fill.intensity=night?.7:1;sun.color.set(night?'#96b8e7':'#ffedce');hemi.color.set(night?'#8098c6':'#e7f5fb');P.water.color.set(night?'#204e65':'#83b6b8');P.shallow.color.set(night?'#39717c':'#b9d3c3');P.window.emissiveIntensity=night?2.2:.04;P.route.emissiveIntensity=night?1.1:.2;scene.fog.color.set(night?'#193c56':'#c7e3e4');renderer.toneMappingExposure=night?1:1.02;}
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
    select(districtMap.has('owners')?'owners':topics[0]?.id);raf=requestAnimationFrame(animate);onReady();
    return {select,connect,setPaused(value){paused=!!value;},setNight,setRoutes(value){showRoutes=!!value;routeGroup.visible=showRoutes;seaRoute.visible=showRoutes;},setReducedMotion(value){reduced=!!value;controls.enableDamping=!reduced;},resetView(){stopTour();controls.target.copy(fitTarget);camera.position.copy(defaultPosition);controls.update();},tour(value){touring=!!value;},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.removeEventListener('start',stopTour);controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointercancel',onCancel);labels.forEach(({el})=>el.remove());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();}};
  } catch(error){if(renderer){renderer.dispose();renderer.domElement.remove();}onError(error);throw error;}
}
