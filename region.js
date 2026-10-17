// 地區選擇：把世界銀行公開數據換算成 1–5 分。
// 方法：每個指標按全球各國排名換算百分位（越差越高），再分成五等份。
// 換算結果是「相對全球其他國家」的位置，不是絕對標準，使用者可以隨時手動修改。

const DATA_MAP = {
  poverty:    [{ code: 'SI.POV.UMIC', worse: 'high' }, { code: 'SI.POV.DDAY', worse: 'high' }],
  inequality: [{ code: 'SI.POV.GINI', worse: 'high' }, { code: 'SI.DST.10TH.10', worse: 'high' }],
  political:  [{ code: 'GOV_WGI_VA.SC', worse: 'low' }],
  culture:    [{ code: 'SG.LAW.INDX', worse: 'low' }, { code: 'SL.TLF.CACT.FM.ZS', worse: 'low', proxy: true }],
  education:  [{ code: 'HD.HCI.LAYS', worse: 'low' }, { code: 'SE.TER.ENRR', worse: 'low' }],
  mobility:   [],
  wages:      [{ code: 'SL.EMP.VULN.ZS', worse: 'high', proxy: true }, { code: 'SL.UEM.TOTL.ZS', worse: 'high', proxy: true }],
  finance:    [{ code: 'FS.AST.PRVT.GD.ZS', worse: 'high' }],
  housing:    [],
};

const NO_DATA_NOTE = {
  mobility: '世界銀行沒有提供可跨國比較的社會流動 API 數據，請自行評估（可參考當地學術研究）。',
  housing: '世界銀行沒有提供可跨國比較的住房負擔數據，請自行評估（可比較當地租金中位數與收入中位數）。',
};

const INDICATOR_ZH = {
  'SI.POV.DDAY': '極端貧窮人口比例',
  'SI.POV.LMIC': '貧窮人口比例（中低收入國家貧窮線）',
  'SI.POV.UMIC': '貧窮人口比例（中高收入國家貧窮線）',
  'SI.POV.GINI': '堅尼系數',
  'SI.DST.10TH.10': '最高 10% 人口的收入佔比',
  'GOV_WGI_VA.SC': '話語權與問責分數（0–100）',
  'GOV_WGI_RL.SC': '法治分數（0–100）',
  'SG.LAW.INDX': '婦女、營商與法律指數',
  'SL.TLF.CACT.FM.ZS': '女性與男性勞動參與率之比（替代指標，只反映性別面向）',
  'HD.HCI.LAYS': '學習調整後的受教育年數',
  'SE.TER.ENRR': '高等教育毛入學率',
  'SL.EMP.VULN.ZS': '弱勢就業佔總就業比例（替代指標）',
  'SL.UEM.TOTL.ZS': '失業率（替代指標）',
  'FS.AST.PRVT.GD.ZS': '私人部門國內信貸佔 GDP 比例',
  'FR.INR.LNDP': '存貸利差（貸款利率減存款利率）',
  'NY.GDP.PCAP.PP.CD': '人均 GDP（購買力平價，國際元）',
};

let REGION_DATA = null;

async function loadRegionData() {
  if (REGION_DATA) return REGION_DATA;
  try {
    const r = await fetch('data/region-data.json');
    if (!r.ok) throw new Error(r.status);
    REGION_DATA = await r.json();
  } catch { REGION_DATA = null; }
  return REGION_DATA;
}

function countryLabel(c) {
  try {
    const zh = new Intl.DisplayNames(['zh-Hant'], { type: 'region' }).of(c.iso2);
    if (zh && zh !== c.iso2) return `${zh}（${c.name}）`;
  } catch {}
  return c.name;
}

// 該指標在全球中的「不正義百分位」：0 = 最好，1 = 最差
function percentile(code, value, worse) {
  const vals = REGION_DATA.countries.map(c => c.values[code]?.[0]).filter(v => v != null).sort((a, b) => a - b);
  if (vals.length < 20) return null;
  const below = vals.filter(v => v < value).length, equal = vals.filter(v => v === value).length;
  const p = (below + equal / 2) / vals.length;
  return worse === 'high' ? p : 1 - p;
}

// 回傳 { factorId: { score, evidence: [{code, name, value, year, pct, proxy}] } }
function scoreCountry(iso3) {
  const c = REGION_DATA.countries.find(x => x.iso3 === iso3);
  if (!c) return null;
  const out = {};
  for (const [fid, specs] of Object.entries(DATA_MAP)) {
    const evidence = [];
    for (const s of specs) {
      const v = c.values[s.code];
      if (!v) continue;
      const pct = percentile(s.code, v[0], s.worse);
      if (pct == null) continue;
      evidence.push({ code: s.code, name: INDICATOR_ZH[s.code] || REGION_DATA.indicators[s.code]?.name || s.code,
                      value: v[0], year: v[1], pct, proxy: !!s.proxy });
    }
    if (!evidence.length) { out[fid] = { score: null, evidence }; continue; }
    const avg = evidence.reduce((a, e) => a + e.pct, 0) / evidence.length;
    // 只有替代指標時，只作參考，不自動套用
    out[fid] = { score: Math.min(5, 1 + Math.floor(avg * 5)), evidence, proxyOnly: evidence.every(e => e.proxy) };
  }
  return { country: c, factors: out };
}

// 按「話語權與問責」分數粗略推定言論環境，僅作預設值
function suggestSpeech(c) {
  const va = c.values['GOV_WGI_VA.SC']?.[0];
  if (va == null) return null;
  return va < 30 ? 'restricted' : va < 60 ? 'partial' : 'free';
}

function fmtVal(v) {
  return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('zh-Hant') : String(Math.round(v * 10) / 10);
}
