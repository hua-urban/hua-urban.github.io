import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const weekly = createRequire(import.meta.url)('../traffic-light/weekly-period.js');
export const RULE = 'member-period-v1';
const sha = value => createHash('sha256').update(value).digest('hex');
function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value) throw new Error('Invalid report date');
  return value;
}
export function effectiveStart(end, month) {
  date(end);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('Missing or invalid membership month');
  return [weekly.startFor(end), '2026-05-01', month+'-01'].sort().at(-1);
}
// Match the complete leading Chinese name, never a prefix or fuzzy name.
export function nameKey(name) { return String(name || '').replace(/\s/g,'').match(/^[\u3400-\u9fff]+/)?.[0] || String(name || '').trim().toLowerCase(); }
function reportDate(value) {
  if (typeof value === 'number') return new Date(Math.round((value-25569)*864e5)).toISOString().slice(0,10);
  const match = /^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})$/.exec(String(value || '').trim());
  if (!match) throw new Error('PALMS report has no readable date');
  return date(`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`);
}
export function parsePalmsRows(rows) {
  if (!rows.slice(0,4).some(r=>r?.some(v=>/PALMS/.test(String(v))))) throw new Error('Not a PALMS report');
  const hi = rows.findIndex(r=>r?.[0]==='姓氏' && r[1]==='名字');
  if (hi<0) throw new Error('Missing PALMS member header');
  const range = {};
  for (const r of rows.slice(0,hi)) {
    if (/^從/.test(r?.[0])) range.start=reportDate(r.slice(1).find(v=>v!==null && v!==''));
    if (/^至/.test(r?.[0])) range.end=reportDate(r.slice(1).find(v=>v!==null && v!==''));
  }
  date(range.start); date(range.end);
  const headers=rows[hi];
  const fields=['出席','缺席','遲到','病假','替代人','提供內部引薦','提供外部引薦','收到內部引薦','收到外部引薦','來賓','一對一會面','分會教育單位','交易價值'];
  const cols=fields.map(f=>{const c=headers.indexOf(f);if(c<0)throw new Error('Missing PALMS column: '+f);return c;});
  const members=[];
  let totals;
  for (const r of rows.slice(hi+1)) {
    if (!r?.[0] || ['BNI','來賓'].includes(String(r[0]).trim())) continue;
    const values=cols.map(c=>{const v=r[c];if(v===null || v==='' || !Number.isFinite(Number(v)) || Number(v)<0)throw new Error('Invalid PALMS metric');return Number(v);});
    const [p,a,l,med,s,rgi,rgo,rri,rro,v,o,ceu,ty]=values;
    if(String(r[0]).trim()==='總數'){if(totals)throw new Error('Duplicate PALMS totals');totals={p,a,med,s,rg:rgi+rgo,v};continue;}
    members.push([0,String(r[0]).trim()+String(r[1]||'').trim(),p+a+med+s,p,a,l,med,s,rgi+rgo,rri+rro,v,o,ceu,ty]);
  }
  return {range,members,totals};
}
export function buildMemberPeriodPalms({roster,policy,reports,end,storedChapter={},baselineMembers,now=new Date()}) {
  date(end);
  if (new Date(end+'T00:00:00Z').getUTCDay()!==3 || end>weekly.latestWednesday(now)) throw new Error('Report end must be a settled Wednesday');
  weekly.preventRollback({end},storedChapter);
  if (!Array.isArray(roster) || !roster.length || !Array.isArray(policy?.members)) throw new Error('Missing roster or private policy');
  const unique=(entries,key,label)=>{const m=new Map();for(const e of entries){const k=key(e);if(!k || m.has(k))throw new Error('Duplicate or invalid '+label);m.set(k,e);}return m;};
  const policies=unique(policy.members,m=>String(m.memberNo),'policy member');
  unique(roster,m=>String(m.no),'roster member'); unique(roster,m=>nameKey(m.name),'roster name');
  const byStart=unique(reports,r=>r.range.start,'report start');
  const needed=new Map(), evidence=[];
  const members=roster.map((m,i)=>{
    const p=policies.get(String(m.no));
    if (!p || nameKey(p.name)!==nameKey(m.name)) throw new Error('Policy match missing or changed for member '+m.no+'；請重新匯出 BNI Connect 會員會期報告並更新本機清冊，不可預填會期月份');
    // Recent chapter membership cycle is authoritative; cumulative membership
    // may predate this chapter. Never silently substitute the cumulative month.
    const start=effectiveStart(end,p.latestCycleMonth);
    if(start>end)throw new Error('Membership period starts after report end');
    const report=byStart.get(start);
    if(!report || report.range.end!==end || !/^[0-9a-f]{64}$/.test(report.sha256||'')) throw new Error('Missing verified report for '+start+' through '+end);
    if(!needed.has(start)) needed.set(start,unique(report.members,r=>nameKey(r[1]),'PALMS name'));
    const row=needed.get(start).get(nameKey(m.name));
    if(!row || row.length!==14 || row.slice(2).some(v=>!Number.isFinite(v)||v<0) || row[2]!==row[3]+row[4]+row[6]+row[7] || row[2]<=0) throw new Error('Missing or invalid PALMS member '+m.no);
    evidence.push({memberNo:String(m.no),reportStart:start});
    return [i+1,m.name,...row.slice(2)];
  });
  let output=members;
  if(baselineMembers){
    const baseline=unique(baselineMembers,r=>nameKey(r[1]),'baseline name');
    if(members.some(r=>!baseline.has(nameKey(r[1]))))throw new Error('Missing baseline member');
    const replacement=new Map(members.map(r=>[nameKey(r[1]),r]));
    // Preserve the original names, ranks, order and any non-roster rows.
    output=baselineMembers.map(r=>replacement.has(nameKey(r[1])) ? [...r.slice(0,2),...replacement.get(nameKey(r[1])).slice(2)] : r);
  }
  return {members:output,memberPeriodEvidence:{rule:RULE,end,rollingStart:weekly.startFor(end),foundationStart:'2026-05-01',reports:[...needed.keys()].sort().map(start=>({start,end,sha256:byStart.get(start).sha256,members:evidence.filter(e=>e.reportStart===start).length})),assignmentsSha256:sha(JSON.stringify(evidence)),metricsSha256:sha(JSON.stringify(output))}};
}
