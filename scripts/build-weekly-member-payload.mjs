// Local preparation only: never sends HTTP requests or writes the source files.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {parsePalmsRows} from './member-period-palms.mjs';
import {buildWeeklyPayload} from './weekly-member-payload.mjs';
const [configPath,outputPath]=process.argv.slice(2);
if(!outputPath)throw new Error('Usage: node scripts/build-weekly-member-payload.mjs LOCAL_CONFIG_JSON NEW_OUTPUT_JSON');
const config=JSON.parse(await readFile(configPath,'utf8'));
const {sourcePath,policyPath,rosterPath,monthlyPath,commonPath,reportPaths}=config;
if(!Array.isArray(reportPaths))throw new Error('Missing member report paths');
if([configPath,sourcePath,policyPath,rosterPath,monthlyPath,commonPath,...reportPaths].some(p=>resolve(p)===resolve(outputPath)))throw new Error('Output must be a separate new file');
const XLSX=createRequire(import.meta.url)('../greenlight-test/vendor/xlsx.full.min.js');
async function report(path){const bytes=await readFile(path),wb=XLSX.read(bytes,{type:'buffer'});if(wb.SheetNames.length!==1)throw new Error('Expected one PALMS sheet');return {...parsePalmsRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null})),sha256:createHash('sha256').update(bytes).digest('hex')};}
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const payload=buildWeeklyPayload({...config,sourceBytes:await readFile(sourcePath),policy:await json(policyPath),roster:(await json(rosterPath)).members,monthly:await json(monthlyPath),common:await report(commonPath),reports:await Promise.all(reportPaths.map(report))});
await writeFile(outputPath,JSON.stringify(payload,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:outputPath,baseRevision:payload.baseRevision,asOf:payload.chapter.est.chapter.asOf,members:payload.chapter.est.members.length}));
