// 所有資料只存於本機 localStorage，本應用不會向任何伺服器傳送資料。
const STORE_KEY = 'justice-app-v1';

const state = load() || {
  region: Object.fromEntries([...REGION_FACTORS, ...CONTEXT_FACTORS].map(f => [f.id, 3])),
  personal: { speech: 'free', union: 'legal', coop: 'unsure', gender: 'na', job: 'employee', edu: 'sec',
              buffer: 'lt3', time: '2to5', tenant: 'rent', debt: 'no', dependents: 'no', discrim: [], risk: 2 },
  calc: {},
};

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};

// ---------- 評分 ----------

function injusticeIndex(r) {
  const vals = REGION_FACTORS.map(f => r[f.id]);
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length - 1) / 4 * 100);
}

function scoreStrategy(s, r, p) {
  const ws = Object.entries(s.factors);
  const max = ws.reduce((a, [, w]) => a + w * 4, 0);
  const got = ws.reduce((a, [f, w]) => a + w * (r[f] - 1), 0);
  const reasons = [];
  for (const [f, w] of ws) {
    if (w >= 2 && r[f] >= 4) {
      const def = [...REGION_FACTORS, ...CONTEXT_FACTORS].find(x => x.id === f);
      reasons.push(`你評估當地「${def.name}」偏高`);
    }
  }
  let boost = 0;
  for (const b of s.boosts || []) if (b.when(p)) { boost += b.add; reasons.push(b.why); }
  const penalty = s.penalty ? s.penalty(r) : 0;
  if (penalty) reasons.push('當地政治制度封閉，此策略效果可能受限');
  return { score: got / max * 10 + boost - penalty, reasons };
}

function intensity(s, p) {
  const eff = s.baseRisk
    + (p.speech === 'restricted' ? s.restrictedRisk : p.speech === 'partial' ? Math.ceil(s.restrictedRisk / 2) : 0)
    + (p.buffer === 'none' && s.baseRisk >= 2 ? 1 : 0)
    + (p.dependents === 'yes' && s.baseRisk >= 2 ? 1 : 0);
  const margin = p.risk - eff;
  let level;
  if (s.weak) level = { key: 'no', text: '不建議', note: '風險高於效果，見下方替代方案。' };
  else if (eff <= 1 || margin >= 2) level = { key: 'high', text: '高：可全力投入', note: '' };
  else if (margin >= 0) level = { key: 'mid', text: '中：穩定、持續地實踐', note: '' };
  else if (margin === -1) level = { key: 'low', text: '低：先小規模、低調試行', note: '風險略高於你願意承擔的程度。' };
  else level = { key: 'no', text: '暫不建議', note: '以你目前的處境與風險承受度，代價可能過高；可先從低風險策略累積實力。' };
  if (!s.weak && p.time === 'lt2' && s.scope !== '個人' && level.key !== 'no')
    level.note += ' 你每週時間有限，建議以參與者而非組織者身份加入。';
  return { ...level, eff };
}

function ranked() {
  const r = state.region, p = state.personal;
  const out = [], excluded = [];
  for (const s of STRATEGIES) {
    if (s.requires && !s.requires(p)) { excluded.push(s); continue; }
    const sc = scoreStrategy(s, r, p);
    out.push({ s, ...sc, lvl: intensity(s, p) });
  }
  const good = out.filter(x => !x.s.weak).sort((a, b) => b.score - a.score);
  const weak = out.filter(x => x.s.weak);
  return { good, weak, excluded };
}

// ---------- 畫面 ----------

function rangeRow(def, value, onChange) {
  const out = el('output', {}, String(value));
  const input = el('input', { type: 'range', min: def.min || 1, max: def.max || 5, step: 1, value,
    'aria-label': def.name,
    oninput: e => { out.textContent = e.target.value; onChange(+e.target.value); } });
  return el('div', { class: 'field' },
    el('div', { class: 'field-head' }, el('label', {}, def.name), out),
    input,
    el('div', { class: 'scale' }, el('span', {}, def.low), el('span', {}, def.high)),
    def.hint ? el('div', { class: 'hint' }, def.hint) : null);
}

function renderRegion() {
  const box = $('#region-fields'); box.replaceChildren();
  for (const f of REGION_FACTORS)
    box.append(rangeRow(f, state.region[f.id], v => { state.region[f.id] = v; save(); }));
  const ctx = $('#context-fields'); ctx.replaceChildren();
  for (const f of CONTEXT_FACTORS)
    ctx.append(rangeRow(f, state.region[f.id], v => { state.region[f.id] = v; save(); }));
}

function renderPersonal() {
  const box = $('#personal-fields'); box.replaceChildren();
  const p = state.personal;
  for (const f of PERSONAL_FIELDS) {
    if (f.type === 'range') { box.append(rangeRow(f, p[f.id], v => { p[f.id] = v; save(); })); continue; }
    if (f.type === 'select') {
      const sel = el('select', { 'aria-label': f.name, onchange: e => { p[f.id] = e.target.value; save(); } },
        f.options.map(([v, t]) => { const o = el('option', { value: v }, t); if (p[f.id] === v) o.selected = true; return o; }));
      box.append(el('div', { class: 'field' }, el('label', {}, f.name), sel));
    } else {
      const chips = f.options.map(([v, t]) => {
        const c = el('button', { type: 'button', class: 'chip' + (p[f.id].includes(v) ? ' on' : ''),
          onclick: () => {
            const i = p[f.id].indexOf(v);
            i >= 0 ? p[f.id].splice(i, 1) : p[f.id].push(v);
            c.classList.toggle('on'); save();
          } }, t);
        return c;
      });
      box.append(el('div', { class: 'field' }, el('label', {}, f.name), el('div', { class: 'chips' }, chips)));
    }
  }
}

function calcBlock(s) {
  const c = s.calc; if (!c) return null;
  const vals = state.calc[s.id] || {};
  const result = el('p', { class: 'calc-out' });
  const update = () => {
    const v = {};
    for (const i of c.inputs) { const x = parseFloat(vals[i.id] ?? i.default); v[i.id] = isNaN(x) ? 0 : x; }
    result.textContent = c.compute(v);
  };
  const rows = c.inputs.map(i => el('label', { class: 'calc-row' }, i.label,
    el('input', { type: 'number', inputmode: 'decimal', value: vals[i.id] ?? i.default, placeholder: '請輸入',
      oninput: e => { (state.calc[s.id] ||= {})[i.id] = e.target.value; save(); update(); } })));
  update();
  return el('div', { class: 'calc' },
    el('h4', {}, c.title),
    el('p', { class: 'tag-assume' }, '公式模型：結果只反映你輸入的數字，數據請自行查證。'),
    rows, result);
}

function list(title, items, cls = '') {
  if (!items || !items.length) return null;
  return el('div', { class: 'sec ' + cls }, el('h4', {}, title), el('ul', {}, items.map(t => el('li', {}, t))));
}

function card({ s, reasons, lvl }, rank) {
  const sc = SCALING[s.scaling];
  return el('details', { class: 'card' + (s.weak ? ' weak' : '') },
    el('summary', {},
      el('div', { class: 'card-top' },
        rank ? el('span', { class: 'rank' }, String(rank)) : null,
        el('span', { class: 'cat' }, s.category),
        el('span', { class: 'lvl lvl-' + lvl.key }, '推薦程度：' + lvl.text)),
      el('h3', {}, s.name),
      el('p', {}, s.summary)),
    reasons.length ? el('div', { class: 'sec why' }, el('h4', {}, '為何推薦給你'), el('p', {}, reasons.join('；') + '。')) : null,
    lvl.note ? el('p', { class: 'note' }, lvl.note) : null,
    el('div', { class: 'sec' }, el('h4', {}, '運作機制'), el('p', {}, s.mechanism)),
    list('具體步驟', s.steps),
    el('div', { class: 'sec effect' },
      el('h4', {}, '效果評估'),
      el('dl', {},
        el('dt', {}, '影響層面'), el('dd', {}, s.scope),
        el('dt', {}, '每多一人參與'), el('dd', {}, `${sc.name}：${sc.text}`),
        el('dt', {}, '見效時間'), el('dd', {}, TIMEFRAME[s.timeframe] + '（粗略判斷，非數據預測）'),
        el('dt', {}, '證據狀況'), el('dd', {}, s.evidence))),
    calcBlock(s),
    list('潛在風險', s.risks, 'risk'),
    list('安全提示', s.safety, 'safety'),
    list('如何讓更多同路人加入', s.recruit));
}

function renderResults() {
  const r = state.region, idx = injusticeIndex(r);
  const { good, weak, excluded } = ranked();
  const bars = REGION_FACTORS.map(f => el('div', { class: 'bar-row' },
    el('span', {}, f.name),
    el('div', { class: 'bar' }, el('i', { style: `width:${(r[f.id] - 1) / 4 * 100}%` })),
    el('b', {}, String(r[f.id]))));
  const band = idx >= 75 ? '嚴重' : idx >= 50 ? '偏高' : idx >= 25 ? '中等' : '較低';
  $('#results').replaceChildren(...[
    el('section', { class: 'panel index' },
      el('div', { class: 'big' }, String(idx), el('small', {}, '/100')),
      el('div', {}, el('h2', {}, `不正義指數：${band}`),
        el('p', { class: 'tag-assume' }, '此指數是你自己評分的平均值換算，反映你的主觀評估，並非客觀測量。可參考各項提示中的公開數據來源校準。')),
      el('div', { class: 'bars' }, bars)),
    el('h2', { class: 'list-title' }, '為你推薦的策略'),
    el('p', { class: 'muted' }, '按與你所在地區及處境的相關程度排序。點擊展開詳情。'),
    good.map((x, i) => card(x, i + 1)),
    weak.length ? el('h2', { class: 'list-title' }, '常見想法檢驗') : null,
    weak.map(x => card(x)),
    excluded.length ? el('p', { class: 'muted' }, '因你的條件而不適用、未列出的策略：' + excluded.map(s => s.name).join('、') + '。') : null,
  ].flat().filter(Boolean));
}

// ---------- 導航與資料管理 ----------

function show(tab) {
  document.querySelectorAll('main > section.view').forEach(v => v.hidden = v.id !== 'view-' + tab);
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'results') renderResults();
  window.scrollTo(0, 0);
}

document.querySelectorAll('nav button, [data-go]').forEach(b =>
  b.addEventListener('click', () => show(b.dataset.tab || b.dataset.go)));

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'justice-app-data.json' });
  a.click(); URL.revokeObjectURL(a.href);
});
$('#wipe').addEventListener('click', () => {
  const btn = $('#wipe');
  if (btn.dataset.armed) {
    try { localStorage.removeItem(STORE_KEY); } catch {}
    location.reload();
  } else {
    btn.dataset.armed = '1'; btn.textContent = '再按一次確認清除';
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = '清除所有資料'; }, 4000);
  }
});

renderRegion();
renderPersonal();
show('region');

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
