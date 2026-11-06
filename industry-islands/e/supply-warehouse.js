// Miniature supply stock: filled FIBC bags, filter samples and a dispatch hand truck.
// Geometry stays below the pavilion fan; the elevated fascia is the only exception.
export function createSupplyWarehouse({THREE,pavilion,material,keep,mesh,showContents=true}) {
  const group=new THREE.Group();group.name='industry-supply-warehouse';pavilion.add(group);
  const cloth=material('#eee9dc',{roughness:.96});
  const webbing=material('#647f8a',{roughness:.92});
  const wood=material('#aa8961',{roughness:.9});
  const sage=material('#728880',{metalness:.3,roughness:.6});
  const panel=material('#d5dad3',{roughness:.67,metalness:.25});
  const metal=material('#b7c2bd',{metalness:.65,roughness:.42});
  const yellow=material('#d7ae4c',{roughness:.72});
  const rubber=material('#37413e',{roughness:.9});
  const boxes=new Map();
  function addBox(mat,x,y,z,w,h,d,name) {
    if(!boxes.has(mat))boxes.set(mat,[]);
    boxes.get(mat).push({x,y,z,w,h,d,name});
  }
  // A longer rear bay, with an actual aperture for the high outward exhaust.
  const rearZ=-3.355;
  addBox(panel,0,.915,rearZ,2.43,1.55,.04,'rear-wall-below-exhaust');
  addBox(panel,-.6575,2.205,rearZ,1.115,1.03,.04,'rear-wall-left-of-exhaust');
  addBox(panel,.9575,2.205,rearZ,.515,1.03,.04,'rear-wall-right-of-exhaust');
  addBox(panel,.30,2.615,rearZ,.80,.21,.04,'rear-wall-above-exhaust');
  for(const x of [-1.24,1.24])addBox(panel,x,1.43,-2.2,.04,2.59,2.28,'rear-bay-closed-side-wall');
  addBox(panel,-1.24,.51,0,.035,.76,1.83,'front-low-left-wall');
  // Exterior folded steel sheets: actual trapezoid relief rather than painted lines.
  const sheetPositions=[];
  function foldedSheet(axis,plane,start,end,bottom,top,sign=1){
    const pitch=.16,profile=[[0,0],[.025,0],[.05,.025],[.105,.025],[.13,0],[.16,0]];
    const point=(u,y,r)=>axis==='x'?[plane+sign*r,y,u]:[u,y,plane+sign*r];
    for(let u=start;u<end-.0001;u+=pitch)for(let i=0;i<profile.length-1;i++){
      const [a,ra]=profile[i],[b,rb]=profile[i+1];if(u+a>=end)continue;
      const ub=Math.min(u+b,end),rr=ra+(rb-ra)*(ub-u-a)/(b-a);
      const A=point(u+a,bottom,ra),B=point(ub,bottom,rr),C=point(ub,top,rr),D=point(u+a,top,ra);
      sheetPositions.push(...A,...B,...C,...A,...C,...D);
    }
  }
  for(const sign of [-1,1])foldedSheet('x',sign*1.265,-3.34,-1.06,.135,2.725,sign);
  foldedSheet('z',rearZ-.025,-1.215,1.215,.14,1.69,-1);
  foldedSheet('z',rearZ-.025,-1.215,-.1,1.69,2.72,-1);
  foldedSheet('z',rearZ-.025,.7,1.215,1.69,2.72,-1);
  foldedSheet('z',rearZ-.025,-.1,.7,2.51,2.72,-1);
  const sheetGeometry=keep(new THREE.BufferGeometry());
  sheetGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sheetPositions,3));sheetGeometry.computeVertexNormals();
  const sheetMaterial=material('#c6cfc7',{metalness:.38,roughness:.57,side:THREE.DoubleSide});
  const sheets=mesh(sheetGeometry,sheetMaterial,group);sheets.name='industry-warehouse-folded-metal-sheets';
  sheets.userData={role:'corrugated-metal-cladding',pitch:.16,relief:.025,orientation:'vertical'};
  // Narrow folded flashing closes the top and bottom edges of the side sheets.
  for(const x of [-1.27,1.27])for(const y of [.15,2.70])addBox(sage,x,y,-2.2,.075,.045,2.31,'side-sheet-flashing');
  for(const x of [-.115,.715])addBox(sage,x,2.1,rearZ,.035,.83,.075,'exhaust-window-jamb');
  for(const y of [1.685,2.515])addBox(sage,.30,y,rearZ,.865,.035,.075,'exhaust-window-transom');
  addBox(sage,0,2.68,rearZ,2.5,.075,.075,'rear-roof-wall-cap');

  const bags=new THREE.Group();bags.name='industry-fibc-stock';group.add(bags);
  const pallets=new THREE.Group();pallets.name='industry-stock-pallets';group.add(pallets);
  const stock=[[-.88,-.58],[-.88,.10],[-.88,.77],[-.25,-.60]];
  // A softly squared, bulging sack with a gathered top, rather than a rigid box.
  const vertices=[],indices=[],segments=24;
  const rings=[[0,.75],[.04,.92],[.14,1],[.34,1.03],[.48,.96],[.55,.77],[.59,.43]];
  for(const [y,r] of rings)for(let i=0;i<segments;i++) {
    const a=i/segments*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
    vertices.push(Math.sign(c)*Math.pow(Math.abs(c),.68)*.225*r,y,Math.sign(s)*Math.pow(Math.abs(s),.68)*.225*r);
  }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++) {
    const a=j*segments+i,b=j*segments+(i+1)%segments,c=a+segments,d=b+segments;
    indices.push(a,c,b,b,c,d);
  }
  const bottom=vertices.length/3;vertices.push(0,0,0);
  const top=vertices.length/3;vertices.push(0,.60,0);
  for(let i=0;i<segments;i++){indices.push(bottom,(i+1)%segments,i);indices.push(top,(rings.length-1)*segments+i,(rings.length-1)*segments+(i+1)%segments);}
  const sackGeometry=keep(new THREE.BufferGeometry());sackGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));sackGeometry.setIndex(indices);sackGeometry.computeVertexNormals();
  const bodies=new THREE.InstancedMesh(sackGeometry,cloth,stock.length);bodies.name='industry-fibc-bulging-bags';bodies.castShadow=true;bags.add(bodies);
  const loopGeometry=keep(new THREE.TorusGeometry(.046,.009,5,16));
  const loops=new THREE.InstancedMesh(loopGeometry,webbing,stock.length*4);loops.name='industry-fibc-four-lifting-loops';loops.castShadow=true;bags.add(loops);
  const transform=new THREE.Object3D(),seams=[];
  stock.forEach(([x,z],i)=>{
    transform.position.set(x,.225,z);transform.rotation.set(0,0,0);transform.scale.set(1,1,1);transform.updateMatrix();bodies.setMatrixAt(i,transform.matrix);
    // Five top slats and three lower runners give each pallet a readable forklift gap.
    for(let n=0;n<5;n++)addBox(wood,x-.24+n*.12,.197,z,.095,.045,.57,'pallet-top-slat');
    for(const dx of [-.22,0,.22]){addBox(wood,x+dx,.144,z,.075,.06,.51,'pallet-runner');}
    for(let k=0;k<4;k++){
      const dx=k%2? .15:-.15,dz=k<2?-.15:.15;
      transform.position.set(x+dx,.827,z+dz);transform.rotation.set(0,k%2?-.3:.3,0);transform.scale.set(.78,1.5,1);transform.updateMatrix();loops.setMatrixAt(i*4+k,transform.matrix);
      // Four corner stitches follow the changing profile of the filled fabric.
      for(let j=0;j<rings.length-1;j++){
        const [y1,r1]=rings[j],[y2,r2]=rings[j+1];
        seams.push(x+Math.sign(dx)*.18*r1,.225+y1,z+Math.sign(dz)*.18*r1,x+Math.sign(dx)*.18*r2,.225+y2,z+Math.sign(dz)*.18*r2);
      }
      addBox(webbing,x+dx,.74,z+dz,.025,.12,.014,'lifting-loop-anchor');
    }
    addBox(cloth,x,.831,z,.10,.026,.095,'gathered-bag-neck');
  });
  const seamGeometry=keep(new THREE.BufferGeometry());seamGeometry.setAttribute('position',new THREE.Float32BufferAttribute(seams,3));
  const seamMaterial=new THREE.LineBasicMaterial({color:'#c2b7a0'});
  const stitches=new THREE.LineSegments(seamGeometry,seamMaterial);stitches.name='industry-fibc-stitched-seams';bags.add(stitches);

  const filterRack=new THREE.Group();filterRack.name='industry-filter-sample-rack';group.add(filterRack);
  for(const x of [.48,1.12])addBox(sage,x,.65,-.69,.035,1.02,.035,'filter-rack-upright');
  for(const y of [.19,.64,1.16])addBox(sage,.8,y,-.69,.68,.03,.035,'filter-rack-crossbar');
  for(const x of [.48,1.12])addBox(sage,x,.16,-.65,.09,.045,.35,'filter-rack-foot');
  const screens=[[.64,.94,.115,.029,0],[.96,.94,.115,.047,Math.PI/4],[.64,.46,.115,.022,Math.PI/4]];
  const rimGeometry=keep(new THREE.TorusGeometry(.115,.009,5,24));
  const rims=new THREE.InstancedMesh(rimGeometry,metal,3);rims.name='industry-circular-filter-samples';filterRack.add(rims);
  const grid=[];
  screens.forEach(([x,y,r,pitch,angle],i)=>{
    transform.position.set(x,y,-.645);transform.rotation.set(0,0,0);transform.scale.set(1,1,1);transform.updateMatrix();rims.setMatrixAt(i,transform.matrix);
    for(let n=-Math.floor(r/pitch);n<=Math.floor(r/pitch);n++){
      const a=n*pitch,b=Math.sqrt(r*r-a*a);
      for(const vertical of [false,true]){
        const ends=vertical?[[a,-b],[a,b]]:[[-b,a],[b,a]];
        for(const [u,v] of ends)grid.push(x+u*Math.cos(angle)-v*Math.sin(angle),y+u*Math.sin(angle)+v*Math.cos(angle),-.644);
      }
    }
  });
  const sx=.96,sy=.46,sw=.225,sh=.25;
  for(const x of [sx-sw/2,sx+sw/2])addBox(metal,x,sy,-.645,.014,sh,.014,'screen-frame');
  for(const y of [sy-sh/2,sy+sh/2])addBox(metal,sx,y,-.645,sw,.014,.014,'screen-frame');
  for(let i=1;i<8;i++){const x=sx-sw/2+i*sw/8;grid.push(x,sy-sh/2,-.644,x,sy+sh/2,-.644);}
  for(let i=1;i<9;i++){const y=sy-sh/2+i*sh/9;grid.push(sx-sw/2,y,-.644,sx+sw/2,y,-.644);}
  const gridGeometry=keep(new THREE.BufferGeometry());gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));
  const gridMaterial=new THREE.LineBasicMaterial({color:'#788b86'});
  const sampleMesh=new THREE.LineSegments(gridGeometry,gridMaterial);sampleMesh.name='industry-distinct-filter-mesh-patterns';filterRack.add(sampleMesh);

  const dispatchZone=new THREE.Group();dispatchZone.name='industry-dispatch-zone';group.add(dispatchZone);
  for(const x of [.16,1.04])for(const z of [.84,1.37]){
    const dx=x<.5?1:-1,dz=z<1?1:-1;
    addBox(yellow,x+dx*.07,.135,z,.16,.009,.024,'dispatch-corner');
    addBox(yellow,x,.135,z+dz*.06,.024,.009,.14,'dispatch-corner');
  }
  // Compact two-wheel hand truck parked inside the loading bay.
  for(const x of [.49,.73])addBox(sage,x,.53,1.10,.025,.74,.025,'hand-truck-rail');
  for(const y of [.32,.58,.90])addBox(sage,.61,y,1.10,.26,.025,.025,'hand-truck-crossbar');
  addBox(sage,.61,.19,1.18,.32,.025,.23,'hand-truck-toe');
  addBox(rubber,.61,.92,1.10,.28,.035,.04,'hand-truck-grip');
  const wheelGeometry=keep(new THREE.CylinderGeometry(.065,.065,.038,12));
  const wheels=new THREE.InstancedMesh(wheelGeometry,rubber,2);wheels.name='industry-dispatch-hand-truck-wheels';dispatchZone.add(wheels);
  for(let i=0;i<2;i++){transform.position.set(.45+i*.32,.195,1.08);transform.rotation.set(0,0,Math.PI/2);transform.scale.set(1,1,1);transform.updateMatrix();wheels.setMatrixAt(i,transform.matrix);}
  const cube=keep(new THREE.BoxGeometry(1,1,1));
  for(const [mat,items] of boxes){
    const batch=new THREE.InstancedMesh(cube,mat,items.length);batch.name=`industry-warehouse-${mat===wood?'pallet-slats':mat===panel?'corrugated-walls':mat===yellow?'dispatch-markings':'fixtures'}`;batch.castShadow=true;batch.receiveShadow=true;
    // Public groups make QA bounds and stock counts directly inspectable.
    (mat===wood?pallets:mat===yellow?dispatchZone:group).add(batch);
    items.forEach((b,i)=>{transform.position.set(b.x,b.y,b.z);transform.rotation.set(0,0,0);transform.scale.set(b.w,b.h,b.d);transform.updateMatrix();batch.setMatrixAt(i,transform.matrix);});
  }
  bags.userData={count:4,loopsPerBag:4,stockPositions:stock};pallets.userData={count:4};
  filterRack.userData={circularSamples:3,rectangularSamples:1};dispatchZone.userData={role:'dispatch',equipment:'hand-truck',bounds:{minX:.148,maxX:1.052,minZ:.828,maxZ:1.382}};
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=320;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f1eee2';ctx.fillRect(0,0,1024,320);
  ctx.fillStyle='#344d44';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='700 190px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';ctx.fillText('中網網業',512,125);
  ctx.font='500 48px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';ctx.fillText('工業耗材・太空包供應倉',512,270);
  const signTexture=new THREE.CanvasTexture(canvas);signTexture.colorSpace=THREE.SRGBColorSpace;
  const signMaterial=new THREE.MeshBasicMaterial({map:signTexture,toneMapped:false,side:THREE.DoubleSide});
  const sign=mesh(keep(new THREE.PlaneGeometry(1.8,.528)),signMaterial,group,-1.315,1.85,-2.2);sign.rotation.y=-Math.PI/2;sign.name='industry-supply-warehouse-sign';sign.castShadow=false;
  sign.userData={role:'warehouse-sign',text:'中網網業',subtitle:'工業耗材・太空包供應倉',placement:'blank-side-wall'};
  if(!showContents)for(const child of [...group.children])if(!['industry-warehouse-corrugated-walls','industry-warehouse-folded-metal-sheets'].includes(child.name))group.remove(child);
  group.userData={exhaustOpening:{center:[.3,2.1,-3.355],width:.8,height:.82},showContents};
  group.traverse(o=>{o.userData.topicId='industry';});
  let disposed=false;
  return {group,bags,pallets,filterRack,dispatchZone,signs:[sign],dispose(){if(disposed)return;disposed=true;signTexture.dispose();signMaterial.dispose();seamMaterial.dispose();gridMaterial.dispose();}};
}
