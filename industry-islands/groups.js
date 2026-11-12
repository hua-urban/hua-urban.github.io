// Public navigation registry. Add a group only after its content is ready.
export const sites={
 a:{name:'A組・地主改建整合鏈',url:'https://hua-urban.com/industry-islands/a/'},
 b:{name:'B組・老屋現金流升級鏈',url:'https://hua-urban.com/industry-islands/b/'},
 c:{name:'C組・高齡安居 × 資產傳承鏈',url:'https://hua-urban.com/industry-islands/c/'},
 d:{name:'D組・商用空間產業鏈',url:'https://hua-urban.com/industry-islands/d/'},
 e:{name:'E組・房產客戶成長鏈',url:'https://hua-urban.com/industry-islands/e/'}
};
export const routes=[
 {name:'家庭資產與風險盤點',c:'finance',e:'finance',desc:'從退休與傳承需求，接到生活風險與財務問題的整理。'},
 {name:'房產活化與使用',c:'rental',b:'assets',desc:'從家庭房屋的使用安排，接到老屋房源與使用需求的評估。'},
 {name:'地主共識與更新',c:'owners',a:'owners',desc:'從高齡安居與更新的需要，接到社區地主溝通及共識準備。'},
 {name:'安居空間與設計',c:'design',d:'design',desc:'從長輩與家人的日常動線，接到空間改善與設計條件的討論。'},
 {name:'工程物料與設備',c:'supply',e:'industry',desc:'從工程與循環材料供應，接到物料包裝、搬運及現場設備需求。'},
 {name:'改建前的老屋使用',a:'transition',b:'assets',desc:'改建規劃期間仍有使用或管理需求時，先與老屋評估專業釐清條件。'},
 {name:'改建工程與材料',a:'construction',d:'materials',desc:'由改建工程的需求與分工，接到材料、工法及施工條件的討論。'},
 {name:'資金安排與風險盤點',a:'funding',e:'finance',desc:'把改建期間的資金安排與生活風險放在一起盤點，再由相應專業確認。'},
 {name:'通風與設備',d:'energy',e:'industry',desc:'從商用空間環境改善，連到製造現場的送風與設備需求。'},
 {name:'廠房空間',d:'leasing',e:'land',desc:'從據點、資產與使用定位，連到土地廠房的經營需求。'},
 {name:'數位管理',d:'digital',e:'ai',desc:'從流程、系統與資料交接，連到 AI 商務架構與管理。'},
 {name:'房源與空間定位',b:'assets',d:'leasing',desc:'從老屋房源與使用需求，連到商用空間的據點與資產討論。'},
 {name:'修繕與材料',b:'renovation',d:'materials',desc:'從老屋改造的施工條件，連到材料、工法與工程協調。'},
 {name:'房務與數位管理',b:'operations',e:'ai',desc:'先整理租務資料與交接，再討論適合的數位工具與管理流程。'}
];
