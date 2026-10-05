/* Browser download and Node verification share this pure workbook builder. */
(function(root, factory){
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrafficLightExport = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const LABELS = {green:'綠燈', amber:'黃燈', red:'紅燈', grey:'黑燈'};
  const HEADERS = ['來源序號','會員姓名','總分','燈號','出席得分','引薦得分','來賓得分',
    '一對一得分','教育得分','交易得分','計分週數','出席次數 P','缺席次數 A','遲到次數 L',
    '病假次數 Med','替代人次數 S','提供引薦 RG','收到引薦 RR','來賓人次 V','一對一次數',
    '教育單位 CEU','交易價值 TYFCB（元）','每週提供引薦','每4週來賓','每週一對一',
    '出席率（含替代人）'];
  const RAW_KEYS = ['weeks','P','A','L','Med','S','RG','RR','V','O2O','CEU','TYFCB'];
  const SCORE_KEYS = ['absent','ref','vis','o2o','ceu','tyfcb'];
  const numeric = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const text = v => v === null || v === undefined || v === '' ? '未提供' : String(v);

  function timestamp(value){
    if (!value) return '未提供';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '未提供';
    return date.toLocaleString('zh-TW', {timeZone:'Asia/Taipei', hour12:false});
  }

  function filename(chapter, version){
    const month = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(chapter.period || '');
    const dates = String(chapter.range || '').match(/\d{4}-\d{2}-\d{2}/g);
    const period = month ? month[1] + '-' + month[2].padStart(2,'0')
      : dates && dates.length >= 2 ? dates[dates.length-1].slice(0,7) : '月份未標';
    const safe = text(version).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_');
    return '華都更_會員紅綠燈_' + period + '_' + safe.replace(/\s+/g,'') + '.xlsx';
  }

  function memberRow(m){
    const w = numeric(m.weeks);
    const rate = (value, factor=1) => w !== null && numeric(value) !== null
      ? value / (w || 1) * factor : null;
    return [numeric(m.no),text(m.name),numeric(m.total),LABELS[m.light] || '未提供',
      ...SCORE_KEYS.map(k=>numeric(m.sc && m.sc[k])),
      ...RAW_KEYS.map(k=>numeric(m[k])),rate(m.RG),rate(m.V,4),rate(m.O2O),
      numeric(m.attend) === null ? null : m.attend / 100];
  }

  function buildTables(context){
    const members = context.members || [];
    if (!members.length) throw new Error('沒有可匯出的現任會員資料');
    const chapter = context.chapter || {};
    const version = text(context.version);
    const provisional = version.includes('暫定');
    const sum = key => members.some(m=>numeric(m[key]) === null) ? null
      : members.reduce((a,m)=>a+m[key],0);
    const summary = [
      ['華都更會員紅綠燈資料說明'],
      ['計分月份',text(chapter.period)],
      ['計分期間',text(chapter.range)],
      ['資料版本',version],
      ['資料更新時間（臺灣）',timestamp(context.updatedAt)],
      ['匯出時間（臺灣）',timestamp(context.exportedAt || new Date())],
      ['來源頁面',text(context.sourceUrl)],
      ['原始數據',text(context.dataUrl)],
      ['完整現任會員人數',members.length],
      ['匯出範圍','當前版本全部現任會員，不受姓名搜尋或燈號篩選影響。'],
      ['原始欄位','會員表 K:V 保留原始數值；C:J 沿用網頁得分，W:Z 為平均及出席率。'],
      ['出席率','含替代人，沿用網頁四捨五入後的整數百分比。'],
      [],
      ['燈號','會員人數'],
      ...Object.entries(LABELS).map(([key,label])=>[label,members.filter(m=>m.light===key).length]),
      ['合計',members.length],
      [],
      ['彙總項目','期間累計'],
      ...[['提供引薦','RG'],['收到引薦','RR'],['來賓人次','V'],['一對一會面','O2O'],
        ['教育單位','CEU'],['交易價值（元）','TYFCB']].map(([label,key])=>[label,sum(key)]),
      [],
      ['分會指標','數值','單位','得分','數據來源']
    ];
    for (const metric of context.metrics || []){
      const v = numeric(metric.v);
      const tier = v === null ? null : (metric.tiers || []).find(([th])=>
        metric.low ? v < th : v >= th - 1e-9);
      const inherited = /^(會員成長|保留率|轉換率)/.test(metric.k);
      summary.push([text(metric.k),v,text(metric.unit),v === null ? null : tier ? tier[1] : 0,
        provisional ? inherited ? '沿用官方版數值' : '由 PALMS 推算' : '官方版數值']);
    }
    summary.push(
      ['分會總分',numeric(chapter.score)],
      ['上一期分會得分',numeric(chapter.prevScore)],
      ['分會指標來源月份',text(chapter.chapterMonth)],
      ['分會指標取得時間（臺灣）',timestamp(chapter.chapterFetchedAt)],
      ['版本說明',chapter.provisional || (provisional
        ? 'PALMS 暫定換算版，正式分數以 LTnA 公布為準。' : 'LTnA 官方版，依當前頁面資料匯出。')],
      [],
      ['燈號門檻','綠燈 ≥70；黃燈 50–69；紅燈 30–49；黑燈 <30'],
      ['會員計分項目','出席、提供引薦、來賓、一對一、教育、交易價值，共 100 分。'],
      [],
      ['已標記退會（不列入現任會員）'],
      ...(context.leftMembers || []).map(name=>[String(name)])
    );
    return {filename:filename(chapter,version),sheets:[
      {name:'會員紅綠燈',rows:[HEADERS,...members.map(memberRow)],
        widths:[10,32,8,8,...Array(6).fill(12),...Array(11).fill(16),24,...Array(4).fill(20)]},
      {name:'分會指標與說明',rows:summary,widths:[32,100,10,10,25]}
    ]};
  }

  function createWorkbook(XLSX, context){
    const result = buildTables(context);
    const workbook = XLSX.utils.book_new();
    result.sheets.forEach((table,index)=>{
      const sheet = XLSX.utils.aoa_to_sheet(table.rows);
      sheet['!cols'] = table.widths.map(wch=>({wch}));
      if (index === 0){
        sheet['!autofilter'] = {ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:table.rows.length-1,c:25}})};
        for (let r=1;r<table.rows.length;r++) for (let c=0;c<26;c++){
          const cell = sheet[XLSX.utils.encode_cell({r,c})];
          if (cell && cell.t === 'n') cell.z = c === 25 ? '0%' : c >= 22 ? '0.00' : '#,##0';
        }
      }
      XLSX.utils.book_append_sheet(workbook,sheet,table.name);
    });
    return {workbook,filename:result.filename};
  }

  return {buildTables,createWorkbook};
});
