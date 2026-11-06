const fs=require('node:fs'),assert=require('node:assert/strict');
const path=require('node:path');
for(const group of ['a','b','c','d','e']){
const file=path.resolve(__dirname,'../industry-islands',group,'scene.js');const src=fs.readFileSync(file,'utf8');const fn=src.slice(src.indexOf('    function placeLabels(){'),src.indexOf('    function animate(now)'));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const labels=[{anchor:{x:0,y:0,z:0},width:80,height:22,el:{dataset:{},style:{}}},{anchor:{x:.02,y:0,z:0},width:80,height:22,el:{dataset:{},style:{}}}];
const projected={copy(p){Object.assign(this,p);return this},project(){return this}};
const place=new Function('labels','projected','mapPoint','camera','THREE','width','height','fanRegions','standingCorners','screenBounds','container',fn+';return placeLabels') (labels,projected,x=>x,{}, {MathUtils:{clamp}},390,510,[],[],()=>null,{dataset:{}});
for(const amplitude of [.0005,.002]){
for(const l of labels)delete l.layout;
let last=null,maxJump=0;
for(let frame=0;frame<120;frame++){
 labels[0].anchor.y=frame%2?-amplitude:amplitude;place();
 const p=labels.map(l=>[parseFloat(l.el.style.left),parseFloat(l.el.style.top)]);
 if(last)for(let i=0;i<p.length;i++)maxJump=Math.max(maxJump,Math.hypot(p[i][0]-last[i][0],p[i][1]-last[i][1]));last=p;
}
console.log(JSON.stringify({file,maxJump,anchorStepPixels:amplitude*510,limit:4}));assert(maxJump<=4,'Labels jump despite slow anchor motion');
}

}

require('node:child_process').execFileSync(process.execPath,[path.resolve(__dirname,'check-label-camera-sweep.mjs')],{stdio:'inherit'});
