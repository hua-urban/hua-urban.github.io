// Local-only command. No network calls, uploads, policy copies, or in-place writes.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {buildMemberPeriodPalms,parsePalmsRows} from './member-period-palms.mjs';
const [policyPath,sourcePath,rosterPath,end,outputPath,...reportPaths]=process.argv.slice(2);
if(!outputPath || !reportPaths.length)throw new Error('Usage: node scripts/build-member-period-palms.mjs PRIVATE_POLICY SOURCE_JSON ROSTER_JSON END OUTPUT_JSON REPORT.xls ...');
if([policyPath,sourcePath,rosterPath,...reportPaths].some(p=>resolve(p)===resolve(outputPath)))throw new Error('Output must be a separate new file');
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const [policy,source,roster]=await Promise.all([readJson(policyPath),readJson(sourcePath),readJson(rosterPath)]);
const XLSX=createRequire(import.meta.url)('../greenlight-test/vendor/xlsx.full.min.js');
const reports=[];
for(const path of reportPaths){const bytes=await readFile(path);const wb=XLSX.read(bytes,{type:'buffer'});if(wb.SheetNames.length!==1)throw new Error('Expected one PALMS sheet');reports.push({...parsePalmsRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null})),sha256:createHash('sha256').update(bytes).digest('hex')});}
if(!source.chapter?.est?.chapter || !Array.isArray(source.chapter.est.members))throw new Error('Missing existing chapter.est baseline');
// Keep chapter-wide indicators and their original report period. Only personal
// metric rows use the effective period; do not recalculate chapter averages
// from a population whose members cover different periods.
if(source.chapter.est.chapter.asOf!==end)throw new Error('Baseline and batch must share the same asOf');
const result=buildMemberPeriodPalms({roster:roster.members,policy,reports,end,storedChapter:source.chapter.est.chapter,baselineMembers:source.chapter.est.members});
source.chapter.est.members=result.members;
source.chapter.est.chapter.memberPeriodEvidence=result.memberPeriodEvidence;
source.chapter.est.updatedAt=new Date().toISOString();
await writeFile(outputPath,JSON.stringify(source,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:outputPath,members:result.members.length,evidence:result.memberPeriodEvidence},null,2));
