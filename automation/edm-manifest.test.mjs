import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const filename=process.env.EDM_HTML_PATH || path.resolve(here,'../guest/index.html');
const html=fs.readFileSync(filename,'utf8');
const start=html.indexOf('  function runDual() {');
const stop=html.indexOf('\n  function runManualOrDual()',start);
assert(start>=0 && stop>start,'EDM loader must exist');
const code=html.slice(start,stop);
const url='images/topic-card-2026-11-04-1-602fbb4c413f.png';
async function load({cards=[{url}],available=true,networkError=false}={}){
 const context={bustTag:'test',topicSec:{hidden:true},singleWrap:{hidden:true},dualWrap:{hidden:true},img1:{},img2:{},legacyCalls:0,singleCalls:0,fetch:()=>networkError?Promise.reject(new Error('offline')):Promise.resolve({ok:true,json:()=>Promise.resolve({cards})}),preload:()=>Promise.resolve(available),withBust:x=>x,runLegacyDual:()=>context.legacyCalls++,showSingle:()=>{context.singleCalls++;context.singleWrap.hidden=false;context.topicSec.hidden=false;}};
 vm.createContext(context);vm.runInContext(code+'\nrunDual();',context);
 await new Promise(resolve=>setImmediate(resolve));return context;
}
test('a missing single-card image cannot fall back to a mixed legacy pair',async()=>{
 const c=await load({available:false});assert.equal(c.legacyCalls,0);assert.equal(c.topicSec.hidden,true);
});
test('network failure cannot mix fixed-name images across meetings',async()=>{
 const c=await load({networkError:true});assert.equal(c.legacyCalls,0);assert.equal(c.topicSec.hidden,true);
});
test('valid two-card manifest displays the exact immutable pair',async()=>{
 const second='images/topic-card-2026-11-04-2-dc8f96ab658c.png';
 const c=await load({cards:[{url},{url:second}]});assert.equal(c.img1.src,url);assert.equal(c.img2.src,second);assert.equal(c.topicSec.hidden,false);assert.equal(c.legacyCalls,0);
});
