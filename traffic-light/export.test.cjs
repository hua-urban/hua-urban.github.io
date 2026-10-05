'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const {buildTables, createWorkbook} = require('./export.js');
const here = __dirname;
const data = JSON.parse(fs.readFileSync(path.join(here, 'data.json'), 'utf8'));
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

// Pull the page's actual scoring constants and functions into a small VM context.
// This keeps the fixture grounded in the page while avoiding DOM boot side effects.
const tierDeclaration = html.match(/const TIER = \{[\s\S]*?\n\};/);
assert.ok(tierDeclaration, 'could not locate page TIER declaration');
const scoreStart = html.indexOf('const scoreAbsent =');
const scoreEnd = html.indexOf('\nconst LIGHT', scoreStart);
assert.ok(scoreStart >= 0 && scoreEnd > scoreStart, 'could not locate page score functions');
const pageScoring = vm.runInNewContext(
  `${tierDeclaration[0]}\nconst GREEN = 70, AMBER = 50, RED = 30;\n`+
  `${html.slice(scoreStart, scoreEnd)}\n({scoreOf, lightOf})`
);

const chapterDeclaration = html.match(/const CHAPTER = \{[\s\S]*?\n\};/);
assert.ok(chapterDeclaration, 'could not locate page CHAPTER declaration');
const pageChapter = vm.runInNewContext(`${chapterDeclaration[0]}\nCHAPTER`);

const rawKeys = ['weeks','P','A','L','Med','S','RG','RR','V','O2O','CEU','TYFCB'];
const chapterMetricMap = [
  ['分會大小','size'], ['會員成長','growth'], ['保留率','retention'],
  ['會員每週引薦數','ref'], ['每週來賓數','vis'], ['轉換率','conv'], ['缺席率','absent']
];

function metricsFor(chapter){
  return JSON.parse(JSON.stringify(pageChapter.official)).map(metric => {
    const mapped = chapterMetricMap.find(([prefix]) => metric.k.startsWith(prefix));
    if (mapped && typeof chapter[mapped[1]] === 'number') metric.v = chapter[mapped[1]];
    return metric;
  });
}

function membersFromPageRows(rows, leftNames){
  const left = new Set(leftNames);
  return rows.map(row => {
    const member = {
      no:row[0], name:row[1], weeks:row[2], P:row[3], A:row[4], L:row[5],
      Med:row[6], S:row[7], RG:row[8], RR:row[9], V:row[10], O2O:row[11],
      CEU:row[12], TYFCB:row[13]
    };
    member.sc = pageScoring.scoreOf(member);
    member.total = Object.values(member.sc).reduce((sum, points) => sum + points, 0);
    member.light = pageScoring.lightOf(member.total);
    member.attend = Math.round((member.P + member.S) / (member.weeks || 1) * 100);
    return member;
  }).filter(member => !left.has(member.name))
    .sort((a, b) => b.total - a.total || a.no - b.no);
}

function realContext({provisional=false}={}){
  const chapter = provisional ? data.chapter.est.chapter : data.chapter;
  const rows = provisional ? data.chapter.est.members : data.members;
  return {
    // The browser export passes the page's current member array. The observed
    // provisional export contains its full 55-row estimate; the official M
    // contains 54 active members after applying the three departure marks.
    members:membersFromPageRows(rows, provisional ? [] : data.leftMembers),
    chapter,
    metrics:metricsFor(chapter),
    version:provisional ? 'PALMS 暫定換算版' : 'LTnA 官方版',
    sourceUrl:'https://example.invalid/traffic-light/',
    dataUrl:'https://example.invalid/traffic-light/data.json',
    updatedAt:provisional ? data.chapter.est.updatedAt : data.updatedAt,
    leftMembers:data.leftMembers
  };
}

function mainSheet(context){
  return buildTables(context).sheets.find(sheet => sheet.name === '會員紅綠燈');
}

function summarySheet(context){
  return buildTables(context).sheets.find(sheet => sheet.name === '分會指標與說明');
}

function excelColumn(index){
  let n = index + 1;
  let label = '';
  while (n > 0){
    const digit = (n - 1) % 26;
    label = String.fromCharCode(65 + digit) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function simpleMember(overrides={}){
  return {
    no:1, name:'測試會員', weeks:4, P:4, A:0, L:0, Med:0, S:0,
    RG:2, RR:1, V:3, O2O:4, CEU:2, TYFCB:800000,
    sc:{absent:20,ref:5,vis:10,o2o:10,ceu:5,tyfcb:10},
    total:60, light:'amber', attend:100,
    ...overrides
  };
}

test('real page data retains official 54 and provisional 55 member rows', () => {
  const official = realContext();
  const provisional = realContext({provisional:true});
  const officialTable = mainSheet(official);
  const provisionalTable = mainSheet(provisional);

  assert.equal(data.members.length, 57);
  assert.equal(data.leftMembers.length, 3);
  assert.equal(official.members.length, 54, 'official page M is 57 source rows minus 3 marked departures');
  assert.equal(data.chapter.est.members.length, 55, 'PALMS source contains 55 rows');
  assert.equal(provisional.members.length, 55, 'provisional export preserves all 55 estimate rows');
  assert.equal(officialTable.rows.length - 1, official.members.length);
  assert.equal(provisionalTable.rows.length - 1, provisional.members.length);
  assert.equal(officialTable.rows[0].length, 26);
  assert.ok(officialTable.rows.slice(1).every(row => row.length === 26));

  for (const [context, table] of [[official,officialTable],[provisional,provisionalTable]]){
    context.members.forEach((member, index) => {
      const row = table.rows[index + 1];
      assert.equal(row[0], member.no);
      assert.equal(row[1], member.name);
      assert.equal(row[2], member.total);
      assert.equal(row[3], ({green:'綠燈',amber:'黃燈',red:'紅燈',grey:'黑燈'})[member.light]);
      assert.deepEqual(row.slice(4, 10), [member.sc.absent,member.sc.ref,member.sc.vis,
        member.sc.o2o,member.sc.ceu,member.sc.tyfcb]);
      assert.deepEqual(row.slice(10, 22), rawKeys.map(key => member[key]));
      assert.ok(row.slice(10, 22).every(value => typeof value === 'number'),
        `member ${member.no} raw cells K:V must stay numeric`);
      assert.equal(row[22], member.RG / member.weeks);
      assert.equal(row[23], member.V / member.weeks * 4);
      assert.equal(row[24], member.O2O / member.weeks);
      assert.equal(row[25], member.attend / 100);
    });
  }

  assert.equal(officialTable.rows[1][2], official.members[0].total,
    'the source ordering remains page M ordering');
  for (const context of [official, provisional]){
    const rows = summarySheet(context).rows;
    for (const [key,label] of Object.entries({green:'綠燈',amber:'黃燈',red:'紅燈',grey:'黑燈'})){
      const row = rows.find(candidate => candidate[0] === label);
      assert.ok(row, `missing ${label} count`);
      assert.equal(row[1], context.members.filter(member => member.light === key).length);
    }
  }
});

test('version labels and filenames follow supplied period or range, not a fixed month', () => {
  const official = realContext();
  const provisional = realContext({provisional:true});
  const specialPeriod = {...official, chapter:{period:'2031 年 3 月'}};
  const rangeOnly = {...provisional, chapter:{range:'2032-04-01 – 2032-04-30'}};

  assert.match(buildTables(official).filename, /_LTnA官方版\.xlsx$/);
  assert.match(buildTables(provisional).filename, /_PALMS暫定換算版\.xlsx$/);
  assert.match(buildTables(specialPeriod).filename, /_2031-03_LTnA官方版\.xlsx$/);
  assert.match(buildTables(rangeOnly).filename, /_2032-04_PALMS暫定換算版\.xlsx$/);
  assert.equal(summarySheet(official).rows.find(row => row[0] === '資料版本')[1], 'LTnA 官方版');
  assert.equal(summarySheet(provisional).rows.find(row => row[0] === '資料版本')[1], 'PALMS 暫定換算版');
});

test('member scores are taken verbatim from sc, total, and light; extra filter properties do not filter rows', () => {
  const memberA = simpleMember({no:7, name:'會員甲', sc:{absent:1,ref:2,vis:3,o2o:4,ceu:5,tyfcb:6}, total:987, light:'red'});
  const memberB = simpleMember({no:8, name:'會員乙', light:'green'});
  const result = buildTables({
    members:[memberA,memberB], chapter:{period:'2030 年 1 月'}, metrics:[],
    version:'LTnA 官方版', leftMembers:[], filter:'green'
  });
  assert.equal(result.sheets[0].rows.length, 3);
  assert.deepEqual(result.sheets[0].rows[1].slice(2, 10),
    [987,'紅燈',1,2,3,4,5,6]);
  assert.equal(result.sheets[0].rows[2][1], '會員乙');
});

test('missing source values stay unprovided instead of becoming zero', () => {
  const member = simpleMember({
    no:undefined, name:'缺欄位會員', weeks:undefined, P:0, A:undefined, RG:3,
    RR:undefined, V:undefined, O2O:undefined, CEU:undefined, TYFCB:undefined,
    sc:{absent:undefined}, total:undefined, light:'grey', attend:undefined
  });
  const context = {
    members:[member], chapter:{}, metrics:[{k:'未提供指標',unit:'%',tiers:[[10,5]],low:1}],
    version:'LTnA 官方版', leftMembers:[]
  };
  const table = mainSheet(context);
  const row = table.rows[1];
  assert.equal(row[0], null);
  assert.equal(row[2], null);
  assert.equal(row[4], null);
  assert.equal(row[10], null, 'an omitted week count stays blank');
  assert.equal(row[11], 0, 'an explicitly supplied zero remains zero');
  assert.equal(row[12], null, 'an omitted raw field remains blank');
  assert.equal(row[16], 3, 'a supplied raw value remains numeric');
  assert.equal(row[17], null);
  assert.equal(row[18], null);
  assert.equal(row[19], null);
  assert.equal(row[20], null);
  assert.equal(row[21], null);
  assert.equal(row[22], null, 'a weekly rate is blank when its denominator is zero');
  assert.equal(row[23], null);
  assert.equal(row[24], null);
  assert.equal(row[25], null);

  const summary = summarySheet(context).rows;
  for (const label of ['資料更新時間（臺灣）','分會總分','上一期分會得分',
    '分會指標來源月份','分會指標取得時間（臺灣）']){
    const cell = summary.find(candidate => candidate[0] === label);
    assert.ok(cell, `missing ${label}`);
    assert.ok(cell[1] === '未提供' || cell[1] === null,
      `${label} must not be silently supplied as a value`);
  }
  const exportTime = summary.find(candidate => candidate[0] === '匯出時間（臺灣）');
  assert.ok(exportTime && exportTime[1] && exportTime[1] !== '未提供',
    'the optional export timestamp is populated at workbook creation time');
  const metricRow = summary.find(candidate => candidate[0] === '未提供指標');
  assert.ok(metricRow);
  assert.equal(metricRow[1], null);
  assert.equal(metricRow[3], null);
  assert.equal(buildTables({...context, chapter:{}}).filename.includes('月份未標'), true);
});

test('SheetJS serialization uses only the provided utility interface and keeps formula-like text literal', () => {
  const maliciousName = '=HYPERLINK("https://example.invalid","點我")';
  const context = {
    members:[simpleMember({name:maliciousName})], chapter:{period:'2033 年 5 月'}, metrics:[],
    version:'LTnA 官方版', leftMembers:[], sourceUrl:'=1+1', dataUrl:'data.json',
    updatedAt:'2033-05-30T00:00:00Z', exportedAt:'2033-05-31T00:00:00Z'
  };
  const encodeCell = ({r,c}) => `${excelColumn(c)}${r + 1}`;
  const mock = {
    utils:{
      book_new:() => ({SheetNames:[],Sheets:{}}),
      aoa_to_sheet(rows){
        const sheet = {};
        rows.forEach((values,r)=>values.forEach((value,c)=>{
          if (value === null || value === undefined) return;
          sheet[encodeCell({r,c})] = typeof value === 'number'
            ? {t:'n',v:value} : {t:'s',v:String(value)};
        }));
        return sheet;
      },
      book_append_sheet(book,sheet,name){
        book.SheetNames.push(name);
        book.Sheets[name] = sheet;
      },
      encode_cell:encodeCell,
      encode_range:({s,e}) => `${encodeCell(s)}:${encodeCell(e)}`
    }
  };
  const {workbook,filename} = createWorkbook(mock, context);
  assert.match(filename, /_2033-05_LTnA官方版\.xlsx$/);
  assert.deepEqual(workbook.SheetNames, ['會員紅綠燈','分會指標與說明']);
  const sheet = workbook.Sheets['會員紅綠燈'];
  assert.equal(sheet['B2'].v, maliciousName);
  assert.equal(sheet['B2'].t, 's');
  assert.equal(sheet['B2'].f, undefined);
  assert.equal(sheet['A2'].z, '#,##0');
  assert.equal(sheet['W2'].z, '0.00');
  assert.equal(sheet['Z2'].z, '0%');
  assert.equal(sheet['!autofilter'].ref, 'A1:Z2');
  assert.equal(sheet['!cols'].length, 26);
  assert.equal(workbook.Sheets['分會指標與說明']['!cols'].length, 5,
    'mock serialization validates the API shape only; it does not produce an XLSX file');
});
