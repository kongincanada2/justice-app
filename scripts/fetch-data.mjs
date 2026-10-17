// 從世界銀行開放數據 API 下載各國最新指標，輸出 data/region-data.json。
// 由 GitHub Actions 定期執行；本應用在手機上不會連線到任何外部伺服器。
import { writeFile } from 'node:fs/promises';

const API = 'https://api.worldbank.org/v2';
const INDICATORS = [
  'SI.POV.DDAY', 'SI.POV.LMIC', 'SI.POV.UMIC',   // 貧窮人口比例（不同貧窮線）
  'SI.POV.GINI', 'SI.DST.10TH.10',               // 堅尼系數、最高 10% 收入佔比
  'GOV_WGI_VA.SC', 'GOV_WGI_RL.SC',              // 話語權與問責、法治（0–100）
  'SG.LAW.INDX', 'SL.TLF.CACT.FM.ZS',            // 婦女、營商與法律指數；女男勞動參與率比
  'HD.HCI.LAYS', 'SE.TER.ENRR',                  // 學習調整後的受教育年數；高等教育入學率
  'SL.EMP.VULN.ZS', 'SL.UEM.TOTL.ZS',            // 弱勢就業比例；失業率
  'FS.AST.PRVT.GD.ZS', 'FR.INR.LNDP',            // 私人部門國內信貸；存貸利差
  'NY.GDP.PCAP.PP.CD',                           // 人均 GDP（購買力平價）
];

async function get(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      console.warn(`HTTP ${r.status} ${url}`);
    } catch (e) { console.warn(`${e.message} ${url}`); }
    await new Promise(res => setTimeout(res, 2000 * 2 ** i));
  }
  throw new Error('failed: ' + url);
}

const [, countryRows] = await get(`${API}/country?format=json&per_page=400`);
const countries = {};
for (const c of countryRows) {
  if (c.region.id === 'NA' || c.region.value === 'Aggregates') continue; // 排除區域合計
  countries[c.id] = { iso3: c.id, iso2: c.iso2Code, name: c.name, region: c.region.value,
                      income: c.incomeLevel.value, values: {} };
}

const indicators = {};
for (const code of INDICATORS) {
  const res = await get(`${API}/country/all/indicator/${code}?format=json&mrnev=1&per_page=20000`);
  if (!Array.isArray(res) || !res[1]) { console.warn(`skip ${code}: ${JSON.stringify(res).slice(0, 200)}`); continue; }
  const meta = await get(`${API}/indicator/${code}?format=json`);
  const m = meta[1]?.[0] || {};
  indicators[code] = { name: m.name || code, source: m.source?.value || '', note: (m.sourceNote || '').slice(0, 400) };
  let n = 0;
  for (const row of res[1]) {
    const c = countries[row.countryiso3code];
    if (c && row.value != null) { c.values[code] = [Math.round(row.value * 1000) / 1000, +row.date]; n++; }
  }
  console.log(`${code}: ${n} countries — ${indicators[code].name}`);
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'World Bank Open Data API (api.worldbank.org/v2)，各國取最新一年有數值的資料',
  indicators,
  countries: Object.values(countries).sort((a, b) => a.name.localeCompare(b.name)),
};
await writeFile('data/region-data.json', JSON.stringify(out));
console.log(`wrote ${out.countries.length} countries, ${Object.keys(indicators).length} indicators`);
