// 策略資料庫與評分維度。
// 原則：所有策略均為合法、非暴力；效果評估只提供「機制」與「可自行代入數據的公式」，
// 不提供任何未經查證的數字。時間尺度為粗略判斷，已明確標示。

const REGION_FACTORS = [
  { id: 'poverty',   name: '貧窮水平',         low: '極少貧窮', high: '貧窮普遍',
    hint: '可參考：世界銀行貧窮數據、當地統計部門的貧窮線報告' },
  { id: 'inequality',name: '財富／收入不均',   low: '相對平均', high: '極度集中',
    hint: '可參考：世界銀行或當地統計部門公布的堅尼系數' },
  { id: 'political', name: '政治制度封閉程度', low: '自由民主、問責強', high: '威權、無有效問責',
    hint: '可參考：V-Dem、Freedom House 的國家評級' },
  { id: 'culture',   name: '文化壓迫',         low: '平等包容', high: '嚴重歧視（性別／族群／階級等）',
    hint: '可參考：UNDP 性別不平等指數、當地平權機構報告' },
  { id: 'education', name: '教育機會不足',     low: '人人可得優質教育', high: '教育資源匱乏或極不平均',
    hint: '可參考：UNDP 人類發展指數中的教育部分、當地教育統計' },
  { id: 'mobility',  name: '向上流動困難',     low: '容易憑努力改善處境', high: '出身決定一生',
    hint: '可參考：OECD 或當地學術機構的社會流動研究' },
  { id: 'wages',     name: '薪資相對生活成本偏低', low: '薪資足以安穩生活', high: '全職仍難以維生',
    hint: '可參考：當地統計部門的行業薪資中位數，與租金、物價比較' },
];

// 不計入不正義指數、但影響策略選擇的地區背景
const CONTEXT_FACTORS = [
  { id: 'finance', name: '金融業在經濟中的主導程度', low: '不明顯', high: '高度主導' },
  { id: 'housing', name: '住房負擔',                 low: '容易負擔', high: '極難負擔' },
];

const PERSONAL_FIELDS = [
  { id: 'speech', name: '當地言論與集會的法律環境', type: 'select', options: [
      ['free', '大致自由'], ['partial', '部分受限'], ['restricted', '嚴重受限'] ] },
  { id: 'union', name: '工會在當地', type: 'select', options: [
      ['legal', '合法且常見'], ['rare', '合法但少見'], ['restricted', '受限或非法'] ] },
  { id: 'coop', name: '附近有信用合作社／合作銀行', type: 'select', options: [
      ['yes', '有'], ['unsure', '不確定'], ['no', '沒有'] ] },
  { id: 'gender', name: '性別', type: 'select', options: [
      ['f', '女'], ['m', '男'], ['x', '其他'], ['na', '不透露'] ] },
  { id: 'job', name: '就業狀況', type: 'select', options: [
      ['employee', '受僱'], ['self', '自僱／自由業'], ['unemployed', '待業'],
      ['student', '學生'], ['carer', '全職照顧家人'] ] },
  { id: 'edu', name: '最高學歷', type: 'select', options: [
      ['lt_sec', '中學以下'], ['sec', '中學'], ['tertiary', '大專／大學'], ['postgrad', '研究所'] ] },
  { id: 'buffer', name: '儲蓄可支撐生活多久', type: 'select', options: [
      ['none', '幾乎沒有'], ['lt3', '少於 3 個月'], ['3to12', '3–12 個月'], ['gt12', '超過 12 個月'] ] },
  { id: 'time', name: '每週可投入時間', type: 'select', options: [
      ['lt2', '少於 2 小時'], ['2to5', '2–5 小時'], ['5to10', '5–10 小時'], ['gt10', '超過 10 小時'] ] },
  { id: 'tenant', name: '居住狀況', type: 'select', options: [
      ['rent', '租屋'], ['own', '自置'], ['family', '與家人同住'] ] },
  { id: 'debt', name: '有高息債務（信用卡循環、私人貸款等）', type: 'select', options: [
      ['no', '沒有'], ['yes', '有'] ] },
  { id: 'dependents', name: '需要供養的家人', type: 'select', options: [
      ['no', '沒有'], ['yes', '有'] ] },
  { id: 'discrim', name: '你本人受哪些歧視影響（可多選）', type: 'multi', options: [
      ['gender', '性別'], ['ethnic', '族群／宗教'], ['lgbt', '性傾向／性別認同'],
      ['disability', '身心障礙'], ['migrant', '移民／居留身份'], ['class', '出身／階級'] ] },
  { id: 'risk', name: '你願意承擔的個人風險', type: 'range', min: 1, max: 5,
    low: '極低', high: '較高' },
];

const SCALING = {
  individual: { name: '個人型', text: '效果主要落在實踐者自己身上，不依賴他人加入；人數增加時，總效果大致按人數相加。' },
  linear:     { name: '線性累加型', text: '每多一人，效果大致按比例增加；但對大型機構而言，少數人的影響通常微不足道。' },
  threshold:  { name: '門檻型', text: '人數未達臨界多數前幾乎沒有議價力，一旦越過門檻（例如過半同事），效果會急劇上升。' },
  network:    { name: '網絡型', text: '價值來自成員之間的連結，人數增加時效果增長快於線性，但需要有人持續維繫。' },
};

const TIMEFRAME = { short: '短期（數週至數月）', mid: '中期（約 1–3 年）', long: '長期（5 年以上）' };

const STRATEGIES = [
  {
    id: 'credit_union',
    name: '把存款轉往信用合作社或合作銀行',
    category: '金融',
    summary: '不把錢留在只為股東牟利的大銀行，而是放進由存戶共同擁有、利潤回饋社員或在地社區的金融機構。',
    factors: { finance: 3, inequality: 2, poverty: 1 },
    requires: p => p.coop !== 'no',
    boosts: [
      { when: p => p.coop === 'yes', add: 2, why: '你附近有信用合作社可用' },
      { when: p => p.buffer === '3to12' || p.buffer === 'gt12', add: 1, why: '你有一定存款可以轉移' },
    ],
    baseRisk: 1, restrictedRisk: 0,
    scaling: 'linear', scope: '社群', timeframe: 'short',
    mechanism: '銀行的利潤很大部分來自存貸利差。把存款移往合作金融機構，等於把這部分利差從大銀行股東轉往社員與在地放貸；你自己仍保有存款保障與利息。',
    steps: [
      '查證該合作社是否受監管、是否有存款保險或同等保障（這一點非常重要）。',
      '比較其存款利率、手續費與網上服務，確認日常使用不會太不方便。',
      '先轉移部分存款或開立薪資戶口試用，再決定是否全面轉移。',
      '保留一個主流銀行帳戶以應付必要服務（如某些僱主或政府付款）。',
    ],
    calc: {
      title: '對大銀行的影響估算（以你自己查到的數據計算）',
      inputs: [
        { id: 'n', label: '一同轉移的人數', default: 1 },
        { id: 'amt', label: '每人平均轉移金額', default: '' },
        { id: 'nim', label: '該銀行的淨息差（%，見銀行年報）', default: '', fromData: 'FR.INR.LNDP',
          dataNote: '存貸利差與個別銀行的淨息差定義不同，只可作粗略參考；如有銀行年報數字，請改用年報數字。' },
        { id: 'profit', label: '該銀行年度淨利潤（選填，見年報）', default: '' },
      ],
      compute: v => {
        if (!v.amt || !v.nim) return '請輸入轉移金額與淨息差（數據請自行查閱銀行年報）。';
        const loss = v.n * v.amt * v.nim / 100;
        let s = `該銀行每年少賺的利差約為：${fmt(loss)}（= 人數 × 金額 × 淨息差）。`;
        if (v.profit) s += ` 約佔其年度淨利潤的 ${(loss / v.profit * 100).toPrecision(2)}%。`;
        s += ' 這是簡化模型：未計銀行可用其他資金來源補足、存款轉移後的連鎖效應等。';
        return s;
      },
    },
    risks: [
      '並非所有合作社都有政府存款保險，倒閉時可能損失存款，務必先查證。',
      '服務網點、網上銀行與國際匯款可能不如大銀行方便。',
      '對大銀行的整體衝擊通常很小，除非是大規模、有組織的轉移；主要價值在於壯大替代機構。',
    ],
    recruit: [
      '公開分享你的轉移經驗與實際比較（利率、手續費、方便程度）。',
      '在工會、教會、社區團體中組織「集體開戶日」，降低每個人的門檻。',
      '邀請合作社派人到社區講解保障與運作方式。',
    ],
    evidence: '機制（存貸利差）是銀行業的基本運作原理；個別或小規模轉移對大銀行利潤的實際影響，視乎銀行規模，通常可忽略。',
  },
  {
    id: 'cash_hoard',
    name: '把所有財產提出銀行改持現金（常見想法檢驗）',
    category: '金融',
    weak: true,
    summary: '這是常見的直覺想法，但經評估：風險高、對銀行的打擊極小，不建議作為主要策略。',
    factors: { finance: 3, inequality: 1 },
    boosts: [],
    baseRisk: 3, restrictedRisk: 0,
    scaling: 'linear', scope: '個人', timeframe: 'long',
    mechanism: '構想是減少銀行可放貸的存款，削弱其透過乘數效應賺取的利息。但現代銀行的放貸並非單純受存款數量限制，還可從央行、同業市場和債券市場取得資金；少數人提款幾乎不影響其利潤。',
    steps: [
      '如目的是不讓大銀行從你的存款獲利，請改看「轉往信用合作社」策略。',
      '如目的是對財富集中施壓，集體談判、稅務正義倡議通常更有槓桿。',
      '如擔心銀行倒閉，可分散存款於多間受保障的機構，而非持有大量現金。',
    ],
    risks: [
      '現金可被盜、遺失、因火災水災損毀，且通常沒有保險保障。',
      '現金在通脹下持續貶值，也失去存款利息與存款保險保障。',
      '大額現金交易在許多地區會觸發反洗錢審查，造成不便。',
      '對銀行的實際打擊：除非是極大規模、同時發生的擠提，否則接近零；而大規模擠提可能引發金融不穩，傷害的往往是普通存戶。',
    ],
    recruit: ['不建議招募他人實踐此策略。'],
    evidence: '關於「銀行先有存款才能放貸」的簡化理解，已被多國央行的公開解說修正（現代銀行放貸時同時創造存款）。請參閱你所在地央行對貨幣創造的官方說明。',
  },
  {
    id: 'union',
    name: '加入或組建工會，進行集體談判',
    category: '勞動',
    summary: '單一員工幾乎沒有議價力；過半員工團結時，才能有效爭取薪資與工作條件。',
    factors: { wages: 3, inequality: 2, poverty: 1 },
    requires: p => p.union !== 'restricted',
    boosts: [
      { when: p => p.job === 'employee', add: 2, why: '你是受僱人士，可直接參與' },
      { when: p => p.union === 'legal', add: 1, why: '工會在當地合法且常見' },
    ],
    baseRisk: 2, restrictedRisk: 2,
    scaling: 'threshold', scope: '社群', timeframe: 'mid',
    mechanism: '把原本流向股東與管理層的部分盈餘，透過集體議價轉回薪資。議價力來自「如果大家一起停止工作，僱主損失巨大」這個可信的集體選擇。',
    steps: [
      '先了解當地勞工法例：組織工會、集體談判、罷工的法定程序與保障。',
      '私下與信任的同事交流，找出大家最關心的一兩個具體問題（如加班費、薪資凍結）。',
      '聯絡現有的行業工會或勞工組織，取得法律與組織支援。',
      '以具體、可達成的訴求開始，爭取第一次小勝利，建立信任。',
    ],
    calc: {
      title: '集體談判帶來的薪資轉移（以你自己的假設計算）',
      inputs: [
        { id: 'n', label: '受惠員工人數', default: 10 },
        { id: 'wage', label: '平均月薪', default: '' },
        { id: 'pct', label: '爭取到的加薪幅度（%）', default: '' },
      ],
      compute: v => {
        if (!v.wage || !v.pct) return '請輸入平均月薪與目標加薪幅度。';
        const yr = v.n * v.wage * 12 * v.pct / 100;
        return `每年從僱主盈餘轉回員工的工資約為：${fmt(yr)}。注意：能否爭取到這個幅度，取決於參與比例是否達到足以影響營運的門檻，模型無法預測。`;
      },
    },
    risks: [
      '組織初期可能遭僱主針對（調職、不續約），即使違法也可能發生，需保留證據。',
      '若參與者不足，談判失敗可能打擊士氣。',
      '在法律受限地區，組織行為本身可能有法律風險，請先取得當地法律意見。',
    ],
    recruit: [
      '一對一傾談比群發訊息有效得多；先聽對方的困難，再談行動。',
      '從最多人共同受影響、最容易贏的問題開始。',
      '把每一次小勝利（即使只是更公平的排班）讓所有同事知道。',
    ],
    safety: [
      '早期組織時使用私人裝置與私人通訊，不要使用公司電郵或公司電腦。',
      '記錄所有不公平對待的日期、時間、見證人。',
    ],
    evidence: '集體談判提高工會會員薪資的現象有大量研究，但幅度因地區、行業、年代差異很大；本應用不提供具體數字，請查閱當地研究。',
  },
  {
    id: 'wage_transparency',
    name: '同業薪資透明：與同事、同行分享薪資資訊',
    category: '勞動',
    summary: '資訊不對稱讓僱主可以壓低薪資；分享薪資數據，讓每個人都知道自己是否被低估。',
    factors: { wages: 3, inequality: 1, culture: 1 },
    boosts: [
      { when: p => p.job === 'employee' || p.job === 'self', add: 1, why: '你正在就業市場中' },
      { when: p => (p.discrim || []).includes('gender'), add: 1, why: '薪資透明有助揭示性別薪酬差距' },
    ],
    baseRisk: 1, restrictedRisk: 1,
    scaling: 'network', scope: '社群', timeframe: 'short',
    mechanism: '當大家知道同職位的市場價，個人在求職與加薪談判時便有可靠依據，同時更容易發現性別或族群的薪酬差異。',
    steps: [
      '先確認當地法律與你的合約是否限制談論薪資（不少地區法律保障員工討論薪資的權利）。',
      '在信任的同行圈子中，建立匿名薪資分享表（職位、年資、薪資範圍）。',
      '利用公開的行業薪資統計作為比較基準。',
      '用這些資料準備下一次的加薪或求職談判。',
    ],
    risks: ['合約中的保密條款可能帶來糾紛，先了解法律保障。', '數據若非匿名，可能引起同事之間的矛盾。'],
    recruit: ['自己先分享，降低別人的顧慮。', '以「幫大家談判時有底氣」作為訴求，而不是比較誰賺得多。'],
    evidence: '薪資透明縮小性別薪酬差距的效果有研究支持，但幅度因制度設計而異；請查閱當地或國際勞工組織的研究。',
  },
  {
    id: 'women_independence',
    name: '女性財務獨立與學歷提升',
    category: '性別',
    summary: '在重男輕女的環境中，最根本的反制是讓自己不再需要依附父權結構才能生存：自己的收入、自己的帳戶、自己的學歷。',
    factors: { culture: 3, education: 1, mobility: 1 },
    requires: p => p.gender === 'f' || (p.discrim || []).includes('gender'),
    boosts: [
      { when: p => p.gender === 'f', add: 2, why: '你是女性' },
      { when: p => (p.discrim || []).includes('gender'), add: 1, why: '你受性別歧視影響' },
      { when: p => p.edu === 'lt_sec' || p.edu === 'sec', add: 1, why: '提升學歷對你仍有明顯空間' },
    ],
    baseRisk: 1, restrictedRisk: 0,
    scaling: 'individual', scope: '個人', timeframe: 'mid',
    mechanism: '經濟依賴是父權控制的主要槓桿之一。擁有獨立收入、獨立帳戶、可攜帶的資格與學歷，能讓個人在婚姻、家庭與職場中擁有離開的選項，從而擁有談判力。當越多女性如此，社會規範也會隨之改變。',
    steps: [
      '開立只有你本人可以使用的銀行帳戶，並逐步建立個人緊急儲備。',
      '了解當地有關繼承、婚姻財產、離婚、家暴的法律權利（可向法律援助或婦女團體查詢）。',
      '選擇市場需求高、可攜帶的資格或學位；善用獎學金、夜校、網上課程。',
      '建立女性互助與導師網絡，互相轉介工作與學習機會。',
      '保存好個人身份證明、學歷證書等重要文件的副本，放在安全的地方。',
    ],
    calc: {
      title: '提升學歷／資格的收入差額（以你自己查到的數據計算）',
      inputs: [
        { id: 'now', label: '目前月收入', default: '' },
        { id: 'target', label: '取得資格後的預期月收入（查閱行業統計）', default: '' },
        { id: 'cost', label: '進修總成本', default: '' },
      ],
      compute: v => {
        if (!v.now || !v.target) return '請輸入目前與預期月收入。';
        const gain = (v.target - v.now) * 12;
        let s = `每年收入增加約 ${fmt(gain)}。`;
        if (v.cost && gain > 0) s += ` 約 ${(v.cost / gain).toFixed(1)} 年可回本。`;
        return s + ' 預期收入應以當地官方行業薪資統計為準，而非招生廣告。';
      },
    },
    risks: [
      '在部分家庭中，追求獨立可能引起衝突，甚至暴力；如有危險，請優先聯絡當地婦女庇護或求助熱線。',
      '進修期間收入減少，需先規劃財務。',
      '在高度壓迫的環境中，獨立行動可能招致社會壓力，可先低調進行。',
    ],
    recruit: [
      '分享你的進修與求職資訊，尤其是獎學金與免費課程。',
      '組織女性讀書會或技能互助小組。',
      '支持其他女性開立個人帳戶、了解法律權利。',
    ],
    safety: [
      '如家中有人監控你的手機或財務，請使用安全的裝置查閱求助資訊，並清除瀏覽紀錄。',
      '本應用的資料只存在你的手機，如手機可能被他人查看，請使用「清除所有資料」功能。',
    ],
    evidence: '女性教育與勞動參與和家庭內議價力之間的關係有大量研究支持；具體效果因地區而異，請查閱 UNDP 或當地研究。',
  },
  {
    id: 'skills_mobility',
    name: '有系統地提升技能，轉往高薪行業',
    category: '流動',
    summary: '在流動困難的地區，個人層面最可控的槓桿是轉往議價力較高的技能與行業。',
    factors: { mobility: 3, wages: 2, education: 1 },
    boosts: [
      { when: p => p.job === 'employee' || p.job === 'unemployed' || p.job === 'student', add: 1, why: '你的職涯仍有調整空間' },
      { when: p => p.time !== 'lt2', add: 1, why: '你每週有時間可投入學習' },
    ],
    baseRisk: 1, restrictedRisk: 0,
    scaling: 'individual', scope: '個人', timeframe: 'mid',
    mechanism: '這不直接改變制度，但能提高你個人的議價力與儲蓄能力，讓你有餘裕參與其他集體策略。',
    steps: [
      '查閱當地官方行業薪資統計，找出薪資較高且入行門檻可跨越的行業。',
      '優先選擇免費或低成本的學習資源（公共圖書館、開放課程、政府資助培訓）。',
      '以作品集或可驗證的證書證明能力，而不只依賴學歷。',
      '透過行業聚會與網上社群建立人脈。',
    ],
    calc: {
      title: '轉行的收入差額（以官方統計計算）',
      inputs: [
        { id: 'now', label: '目前月收入', default: '' },
        { id: 'target', label: '目標行業月薪中位數（官方統計）', default: '' },
      ],
      compute: v => (!v.now || !v.target) ? '請輸入兩個數字。'
        : `如成功轉行，每年收入差額約 ${fmt((v.target - v.now) * 12)}。入行初期通常低於中位數。`,
    },
    risks: ['轉行期間可能收入不穩定。', '部分「速成課程」收費高昂而成效不明，報讀前查證就業率。'],
    recruit: ['把你走過的學習路徑整理成清單分享出去。', '組織互相督促的學習小組。'],
    evidence: '個人層面的效果取決於行業與地區；本應用不預測成功機率。',
  },
  {
    id: 'mutual_aid',
    name: '社區互助基金與互助網絡',
    category: '貧窮',
    summary: '讓社區成員在急需時互相支援，避免被迫借高利貸或接受剝削性條件。',
    factors: { poverty: 3, inequality: 1, wages: 1 },
    boosts: [
      { when: p => p.debt === 'yes', add: 2, why: '你有高息債務，互助基金可減少再借高利貸' },
      { when: p => p.buffer === 'none' || p.buffer === 'lt3', add: 1, why: '你的應急儲備有限' },
    ],
    baseRisk: 1, restrictedRisk: 1,
    scaling: 'network', scope: '社群', timeframe: 'short',
    mechanism: '高利貸與剝削性借貸的利潤來自窮人缺乏應急資金。小規模互助基金讓利息留在社區之內，也建立了日後集體行動所需的信任。',
    steps: [
      '從 5–15 位互相信任的人開始，訂立清晰的書面規則（供款、借款上限、還款期、誰管帳）。',
      '帳目公開透明，定期向所有成員報告。',
      '了解當地法律：集資、放貸是否需要牌照，避免觸犯金融監管規定。',
      '除了金錢，也可互助照顧小孩、交換技能、分享物資。',
    ],
    calc: {
      title: '互助基金規模與節省的利息',
      inputs: [
        { id: 'n', label: '成員人數', default: 10 },
        { id: 'monthly', label: '每人每月供款', default: '' },
        { id: 'loanRate', label: '成員原本會借的貸款年利率（%）', default: '' },
      ],
      compute: v => {
        if (!v.monthly) return '請輸入每月供款。';
        const fund = v.n * v.monthly * 12;
        let s = `一年後基金規模約 ${fmt(fund)}。`;
        if (v.loanRate) s += ` 如全數以零息借給成員，代替原本的貸款，一年約可節省 ${fmt(fund * v.loanRate / 100)} 利息（粗略上限）。`;
        return s;
      },
    },
    risks: ['管帳不善或有人不還款會破壞信任，需書面規則。', '在部分地區，未經許可集資或放貸可能違法。'],
    recruit: ['從已有的人際網絡（鄰居、宗教團體、同鄉會）開始。', '讓第一批受惠者分享經驗。'],
    evidence: '輪轉儲蓄與互助會（ROSCA）在世界各地有悠久歷史；成效取決於規則與信任。',
  },
  {
    id: 'debt_escape',
    name: '優先擺脫高息債務',
    category: '貧窮',
    summary: '高息債務是財富由窮人流向放貸者最直接的管道之一；先切斷它，才有餘力做其他事。',
    factors: { poverty: 2, inequality: 1 },
    requires: p => p.debt === 'yes',
    boosts: [{ when: p => p.debt === 'yes', add: 3, why: '你有高息債務' }],
    baseRisk: 1, restrictedRisk: 0,
    scaling: 'individual', scope: '個人', timeframe: 'short',
    mechanism: '每月支付的高額利息直接轉移到放貸者手中。先還利率最高的債務，或轉往較低息的貸款，能最快止血。',
    steps: [
      '列出所有債務的金額、年利率、最低還款額。',
      '優先償還利率最高的一筆（其他保持最低還款）。',
      '尋求免費、非牟利的債務諮詢服務；小心收費高昂的「債務重組」中介。',
      '了解當地的債務重組、破產或債務舒緩法律程序。',
    ],
    risks: ['小心「以債養債」的二次陷阱。', '部分債務重組會影響信貸紀錄，需了解後果。'],
    recruit: ['在互助網絡中分享可靠的免費諮詢渠道。'],
    evidence: '這是基本的財務原理；不涉及預測。',
  },
  {
    id: 'tenant_union',
    name: '組織租戶聯會',
    category: '住房',
    summary: '同一業主或同一屋苑的租客集體行動，爭取合理租金與維修。',
    factors: { housing: 3, inequality: 1, poverty: 1 },
    requires: p => p.tenant === 'rent',
    boosts: [{ when: p => p.tenant === 'rent', add: 2, why: '你是租客' }],
    baseRisk: 2, restrictedRisk: 2,
    scaling: 'threshold', scope: '社群', timeframe: 'mid',
    mechanism: '單一租客面對業主幾乎沒有議價力；當同一業主的大多數租客一起提出要求，業主更換所有租客的成本會變得很高。',
    steps: [
      '了解當地租務法例：加租限制、驅逐程序、維修責任。',
      '與鄰居交流，記錄共同的問題（失修、不合理加租）。',
      '以書面集體信件提出具體訴求。',
      '聯絡當地租客權益組織或法律援助。',
    ],
    risks: ['可能遭業主報復（不續租），需了解法律保障。', '租客流動性高，組織難以持續。'],
    recruit: ['從共同、具體的問題切入，例如一起要求修理電梯。', '以門口傳單或屋苑群組邀請鄰居。'],
    evidence: '效果高度取決於當地租務法例的保障程度。',
  },
  {
    id: 'legal_rights',
    name: '學習並使用法律權利（勞工、租務、平權）',
    category: '法律',
    summary: '許多不公平做法其實已經違法，只是受害者不知道或不敢追究。',
    factors: { wages: 1, culture: 2, poverty: 1, housing: 1 },
    boosts: [
      { when: p => (p.discrim || []).length > 0, add: 1, why: '你受歧視影響，平權法律可能適用' },
      { when: p => p.job === 'employee', add: 1, why: '勞工法例保障適用於你' },
    ],
    baseRisk: 1, restrictedRisk: 1,
    scaling: 'network', scope: '個人', timeframe: 'short',
    mechanism: '僱主或業主違法而不受追究，是因為追究成本由個人承擔。知道權利、保留證據、使用免費法律援助，能大幅降低追究成本；每一宗成功個案也會提高其他違法者的風險。',
    steps: [
      '找出當地的勞工處、平權機構、法律援助、大學法律診所。',
      '一旦遇到問題，立即以書面記錄（日期、對話、文件）。',
      '注意法律追討的時限。',
    ],
    risks: ['法律程序可能耗時，需評估自己的時間與壓力承受能力。'],
    recruit: ['在社區舉辦簡單的權利講座，邀請法律援助人員主講。', '製作一頁紙的權利懶人包分享出去。'],
    evidence: '效果取決於當地執法與司法獨立程度。',
  },
  {
    id: 'civic_participation',
    name: '有組織的公民參與：投票、地方議會、聯絡民意代表',
    category: '政治',
    summary: '在有選舉與問責機制的地方，有組織的選民是最直接的制度槓桿。',
    factors: { inequality: 2, poverty: 1, housing: 1, education: 1 },
    requires: p => p.speech !== 'restricted',
    boosts: [{ when: p => p.speech === 'free', add: 2, why: '當地政治參與較自由' }],
    penalty: r => r.political >= 4 ? 3 : 0,
    baseRisk: 1, restrictedRisk: 2,
    scaling: 'threshold', scope: '結構', timeframe: 'mid',
    mechanism: '政策傾向既得利益者，部分原因是他們有組織而普通人沒有。地方選舉投票率往往偏低，少量有組織的選民便能左右結果。',
    steps: [
      '確認自己已登記為選民，並了解地方選區與代表。',
      '參加地方議會、公聽會，就具體政策（最低工資、租務、稅務）提出意見。',
      '與同樣關注的人組織起來，以團體名義聯絡代表並公開其立場與投票紀錄。',
    ],
    risks: ['短期內未必見到成果，容易令人氣餒。'],
    recruit: ['在選舉前組織資訊分享會。', '以具體議題而不是黨派動員。'],
    evidence: '效果取決於選舉制度的公平程度。',
  },
  {
    id: 'tax_justice',
    name: '支持稅務正義與財富透明倡議',
    category: '政治',
    summary: '財富極度集中的地區，往往伴隨對資本與遺產的低稅率和避稅漏洞。',
    factors: { inequality: 3, poverty: 1 },
    requires: p => p.speech !== 'restricted',
    penalty: r => r.political >= 4 ? 2 : 0,
    boosts: [{ when: p => p.time !== 'lt2', add: 1, why: '你有時間參與倡議' }],
    baseRisk: 1, restrictedRisk: 2,
    scaling: 'threshold', scope: '結構', timeframe: 'long',
    mechanism: '稅制是社會財富分配的主要工具；推動累進稅、堵塞避稅漏洞、公開實益擁有人資料，可直接改變分配結構。',
    steps: [
      '了解當地稅制：薪俸稅、資本增值稅、遺產稅、物業稅的稅率與豁免。',
      '加入或支持現有的稅務正義、財政透明組織。',
      '在公共諮詢中提交意見書。',
    ],
    risks: ['需要長期投入，個人難以見到直接成果。'],
    recruit: ['用簡單的比較（如：打工收入與資產收益的稅率差異）讓人理解問題。'],
    evidence: '屬長期結構性倡議，無法預測時程。',
  },
  {
    id: 'consumer_shift',
    name: '把消費轉向合作社、在地與公平企業',
    category: '經濟',
    summary: '把日常支出由壟斷性大企業，部分轉往合作社、在地小店與善待員工的企業。',
    factors: { inequality: 2, wages: 1 },
    boosts: [{ when: p => p.buffer !== 'none', add: 1, why: '你有一定消費選擇空間' }],
    baseRisk: 1, restrictedRisk: 0,
    scaling: 'linear', scope: '社群', timeframe: 'long',
    mechanism: '個人消費轉移對大企業的影響極小；其真正價值是讓替代性企業（合作社、社企）得以存活與壯大。',
    steps: [
      '找出你最大的幾項開支（食物、電訊、日用品），逐項尋找替代選擇。',
      '優先選擇員工擁有或消費者擁有的合作社。',
      '量力而為：不要因此令自己的生活陷入困難。',
    ],
    risks: ['替代選擇可能較貴；低收入者不應為此犧牲基本需要。'],
    recruit: ['製作在地替代商店地圖，與社區分享。'],
    evidence: '對大企業的影響通常微不足道；對小型替代企業的影響則可能顯著。',
  },
  {
    id: 'study_circle',
    name: '讀書會與公共教育：媒體識讀、經濟常識、權利知識',
    category: '教育',
    summary: '既得利益者的優勢之一是資訊與敘事；讓更多人看懂制度怎樣運作，是所有集體行動的基礎。',
    factors: { education: 3, culture: 2, political: 1 },
    boosts: [{ when: p => p.edu === 'tertiary' || p.edu === 'postgrad', add: 1, why: '你的學歷有助帶領學習' }],
    baseRisk: 1, restrictedRisk: 2,
    scaling: 'network', scope: '社群', timeframe: 'mid',
    mechanism: '提升群體的分析能力與共同語言，並在過程中建立信任網絡。',
    steps: [
      '從 4–8 人的小組開始，每次討論一個具體主題（如：薪資單怎樣看、租約條款、新聞如何查證）。',
      '使用公共圖書館與開放教育資源。',
      '每次以「我們可以做什麼」作結。',
    ],
    risks: ['在言論受限地區，討論某些議題可能有法律風險；可聚焦於理財、法律權利等較少爭議的實用主題。'],
    recruit: ['邀請參與者每人帶一位朋友。', '選擇與生活直接相關的題目。'],
    safety: ['在受限環境中，不要保存參與者名單於未加密的地方。'],
    evidence: '屬能力建設，效果難以量化。',
  },
  {
    id: 'open_learning',
    name: '善用免費與開放教育資源自學',
    category: '教育',
    summary: '在教育資源匱乏的地區，免費網上課程與公共圖書館可以部分彌補差距。',
    factors: { education: 3, mobility: 2 },
    boosts: [
      { when: p => p.edu === 'lt_sec' || p.edu === 'sec', add: 2, why: '你的正規學歷有提升空間' },
      { when: p => p.time !== 'lt2', add: 1, why: '你每週有學習時間' },
    ],
    baseRisk: 1, restrictedRisk: 0,
    scaling: 'individual', scope: '個人', timeframe: 'mid',
    mechanism: '降低知識取得成本，讓出身不再完全決定能力。',
    steps: [
      '設定一個具體目標（如：取得某證書、學會某技能）。',
      '尋找公共圖書館、大學公開課程、政府資助課程。',
      '固定每週學習時間，並找學習夥伴互相督促。',
    ],
    risks: ['自學證書的認受性可能不及正規學歷，選擇前查證僱主是否承認。'],
    recruit: ['分享優質免費資源清單。'],
    evidence: '個人層面效果取決於持續投入。',
  },
  {
    id: 'narrative',
    name: '以文化與敘事挑戰歧視規範',
    category: '文化',
    summary: '文化壓迫靠「大家都覺得理所當然」維持；公開講述被壓迫者的經驗，能鬆動這些規範。',
    factors: { culture: 3, education: 1 },
    requires: p => p.speech !== 'restricted',
    boosts: [{ when: p => (p.discrim || []).length > 0, add: 1, why: '你有親身經驗可分享' }],
    baseRisk: 2, restrictedRisk: 2,
    scaling: 'network', scope: '結構', timeframe: 'long',
    mechanism: '社會規範的改變往往由少數人公開表態開始，當足夠多人表態，原本沉默的大多數會發現自己並不孤單。',
    steps: [
      '從身邊開始：在家庭與朋友間溫和地挑戰歧視言論。',
      '以寫作、藝術、影像記錄真實經驗（注意保護當事人私隱）。',
      '支持被壓迫社群的創作者與組織。',
    ],
    risks: ['公開表態可能招致網絡攻擊或社交壓力。', '在受限地區，部分言論可能觸犯法律。'],
    recruit: ['邀請身邊人分享他們的經驗，而不是說教。'],
    safety: ['公開發表前考慮是否需要匿名，並保護當事人身份。'],
    evidence: '社會規範轉變屬長期、難以量化的過程。',
  },
  {
    id: 'digital_safety',
    name: '數位安全與私隱保護（任何集體行動的基礎）',
    category: '安全',
    summary: '在受監控或受限的環境中，任何組織行動之前，先保護自己和同伴的資料。',
    factors: { political: 3 },
    boosts: [
      { when: p => p.speech === 'partial', add: 1, why: '當地言論部分受限' },
      { when: p => p.speech === 'restricted', add: 3, why: '當地言論嚴重受限，安全措施優先' },
    ],
    baseRisk: 0, restrictedRisk: 0,
    scaling: 'network', scope: '個人', timeframe: 'short',
    mechanism: '保護自己與同伴不因合法行動而受報復。這是降低其他策略風險的前置工作。',
    steps: [
      '為重要帳戶開啟雙重認證，使用不同的強密碼。',
      '使用有端對端加密的通訊工具，並了解其限制。',
      '不在公開平台張貼可識別他人身份的資料。',
      '定期檢查手機的應用程式權限。',
    ],
    risks: ['數位工具並非萬無一失；在高風險環境中，面對面溝通仍然重要。'],
    recruit: ['在小組中舉辦數位安全工作坊。'],
    evidence: '屬防護措施，不直接改變制度。',
  },
  {
    id: 'restricted_safe_path',
    name: '受限環境中的低風險路線：先壯大自己與互信網絡',
    category: '安全',
    summary: '在公開組織有法律風險的地方，優先投入不涉及政治表態、但能累積實力的行動。',
    factors: { political: 3, poverty: 1, education: 1 },
    requires: p => p.speech !== 'free',
    boosts: [{ when: p => p.speech === 'restricted', add: 3, why: '當地言論嚴重受限' }],
    baseRisk: 0, restrictedRisk: 0,
    scaling: 'network', scope: '個人', timeframe: 'long',
    mechanism: '在無法公開挑戰制度時，提升個人與社群的經濟獨立、知識與互信，能為日後條件改變時保留行動能力，同時減少對既得利益結構的依賴。',
    steps: [
      '優先：財務獨立、學歷與技能、擺脫高息債務。',
      '參與合法的互助、文化、宗教、專業團體，建立互信。',
      '了解當地法律紅線，向可信的律師或組織查詢，不要越線。',
    ],
    risks: ['進展緩慢，需要耐心。'],
    recruit: ['以生活互助而非政治理念連結他人。'],
    evidence: '屬保守策略；本應用無法評估你所在地的具體法律風險，請尋求當地法律意見。',
  },
];

function fmt(n) {
  if (!isFinite(n)) return '—';
  return Math.round(n).toLocaleString('zh-Hant');
}
