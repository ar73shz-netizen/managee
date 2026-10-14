import { createLocalStore, createFirebaseStore, getFirebaseConfig, setFirebaseConfig, DEFAULT_BRANDS } from './store.js';

/* ---------- ابزارها ---------- */
const $ = (s, r = document) => r.querySelector(s);
const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const faNum = (n) => Number(n).toLocaleString('fa-IR', { useGrouping: false });
const fmtPrice = (n) => Number(n || 0).toLocaleString('fa-IR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fa2en = (s) => String(s).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const toNum = (s) => Number(fa2en(s).replace(/[^\d.]/g, '')) || 0;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function todayJalali() {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: g('year'), m: g('month'), d: g('day') };
}
const todayStr = () => { const t = todayJalali(); return `${t.y}/${String(t.m).padStart(2, '0')}/${String(t.d).padStart(2, '0')}`; };
function showDate(s, withYear = true) {
  if (!s) return '—';
  const [y, m, d] = s.split('/').map(Number);
  return `${faNum(d)} ${MONTHS[m - 1]}${withYear ? ' ' + faNum(y) : ''}`;
}

/* ---------- تعریف فیلدها ---------- */
const OWNERSHIP = ['ملک فروشگاه', 'امانی', 'شراکتی'];
const IPHONE_FIELDS = [
  { k: 'model', l: 'مدل', ph: 'مثلاً iPhone 15 Pro Max', req: 1 },
  { k: 'storage', l: 'حافظه', list: ['64', '128', '256', '512', '1TB'], suffix: true },
  { k: 'partNumber', l: 'پارت نامبر', ltr: 1, ph: 'MTUW3' },
  { k: 'battery', l: 'سلامت باتری (٪)', t: 'number' },
  { k: 'cycle', l: 'سایکل', t: 'number' },
  { k: 'series', l: 'سری' },
  { k: 'color', l: 'رنگ' },
  { k: 'desc', l: 'توضیحات گوشی', t: 'area' },
  { k: 'buyDate', l: 'تاریخ خرید', t: 'date' },
  { k: 'buyPrice', l: 'قیمت خرید (تومان)', t: 'price' },
  { k: 'sellPrice', l: 'قیمت فروش (تومان)', t: 'price' },
  { k: 'buyNote', l: 'توضیحات خرید', t: 'area' },
  { k: 'ownership', l: 'وضعیت مالکیت', t: 'select', opts: OWNERSHIP },
];
const OTHER_FIELDS = [
  { k: 'model', l: 'مدل', ph: 'مثلاً Galaxy S24 Ultra', req: 1 },
  { k: 'ram', l: 'رم', list: ['2', '3', '4', '6', '8', '12', '16'] },
  { k: 'storage', l: 'حافظه', list: ['32', '64', '128', '256', '512', '1TB'] },
  { k: 'color', l: 'رنگ' },
  { k: 'desc', l: 'توضیحات', t: 'area' },
  { k: 'buyDate', l: 'تاریخ خرید', t: 'date' },
  { k: 'buyNote', l: 'توضیحات خرید', t: 'area' },
  { k: 'buyPrice', l: 'قیمت خرید (تومان)', t: 'price' },
  { k: 'sellPrice', l: 'قیمت فروش (تومان)', t: 'price' },
];
const isIphone = (b) => b === 'آیفون';
const fieldsFor = (b) => (isIphone(b) ? IPHONE_FIELDS : OTHER_FIELDS);

/* ---------- وضعیت برنامه ---------- */
let store, state = { items: [], brands: DEFAULT_BRANDS };
let user = null;
const ui = { tab: 'in', entryBrand: null, brandFilter: 'all', minP: '', maxP: '', q: '', outYear: null, outMonth: null, editId: null };

/* ---------- راه‌اندازی ---------- */
async function boot() {
  const cfg = getFirebaseConfig();
  if (cfg) {
    try {
      store = await createFirebaseStore(cfg);
      store.onAuth((u) => { user = u; if (!u) render(); else attach(); });
      render();
      return;
    } catch (e) { console.error(e); alert('اتصال آنلاین برقرار نشد؛ برنامه در حالت محلی باز می‌شود.'); }
  }
  store = createLocalStore();
  attach();
}
let attached = false;
function attach() {
  if (attached) return; attached = true;
  store.subscribe((s, changes) => {
    state = s;
    changes.forEach(announce);
    render();
  });
}
function announce(c) {
  const it = c.item; const name = `${it.brand} ${it.model || ''}`;
  const who = it.updatedBy ? ` (${it.updatedBy.split('@')[0]})` : '';
  if (c.type === 'added') toast(`📥 ورود جدید: ${name}${who}`, true);
  else if (c.type === 'removed') toast(`🗑 حذف شد: ${name}`, true);
  else toast(it.status === 'out' ? `📤 خروج کالا: ${name}${who}` : `✏️ ویرایش: ${name}${who}`, true);
}
function toast(msg, live) {
  const el = document.createElement('div');
  el.className = 'toast' + (live ? ' live' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ---------- رندر اصلی ---------- */
function render() {
  const app = $('#app');
  if (store.needsAuth && !user) return (app.innerHTML = loginView(), bindLogin());
  const inStock = state.items.filter((i) => i.status !== 'out');
  const titles = { in: 'ورود کالا', stock: 'کالاهای موجود', out: 'کالاهای خروجی', set: 'تنظیمات و پشتیبان' };
  app.innerHTML = `
    <header class="topbar"><h1>${titles[ui.tab]}</h1>
      <div class="status"><span class="dot ${store.mode === 'online' ? 'on' : ''}"></span>${store.mode === 'online' ? 'آنلاین' : 'محلی'}</div></header>
    <main class="wrap">${ui.tab === 'in' ? entryView() : ui.tab === 'stock' ? stockView(inStock) : ui.tab === 'out' ? outView() : settingsView()}</main>
    <nav class="nav">
      ${[['in', '➕', 'ورود کالا'], ['stock', '📦', 'موجود'], ['out', '📤', 'خروجی'], ['set', '⚙️', 'تنظیمات']]
        .map(([k, ic, l]) => `<button data-tab="${k}" class="${ui.tab === k ? 'act' : ''}"><span class="ic">${ic}</span>${l}${k === 'stock' && inStock.length ? `<span class="badge">${faNum(inStock.length)}</span>` : ''}</button>`).join('')}
    </nav>`;
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { ui.tab = b.dataset.tab; ui.editId = null; ui.outMonth = null; render(); window.scrollTo(0, 0); });
  if (ui.tab === 'in') bindEntry();
  if (ui.tab === 'stock') bindStock();
  if (ui.tab === 'out') bindOut();
  if (ui.tab === 'set') bindSettings();
}

/* ---------- ورود به سیستم ---------- */
function loginView() {
  return `<div class="login card"><h2 class="title">ورود کارکنان</h2>
    <label class="f"><span>ایمیل</span><input type="email" id="em" class="ltr" autocomplete="username"></label>
    <label class="f"><span>رمز عبور</span><input type="password" id="pw" class="ltr" autocomplete="current-password"></label>
    <button class="btn block" id="go">ورود</button>
    <p class="hint">حساب‌ها را مدیر در بخش Authentication فایربیس می‌سازد.</p>
    <button class="btn sec sm block" id="local">بازگشت به حالت محلی</button></div>`;
}
function bindLogin() {
  $('#go').onclick = async () => {
    try { await store.login($('#em').value.trim(), $('#pw').value); } catch { toast('ایمیل یا رمز عبور درست نیست'); }
  };
  $('#local').onclick = () => { setFirebaseConfig(null); location.reload(); };
}

/* ---------- فرم داینامیک ---------- */
function dateWidget(k, val) {
  const t = todayJalali();
  const [y, m, d] = (val || todayStr()).split('/').map(Number);
  const years = []; for (let i = t.y - 6; i <= t.y + 1; i++) years.push(i);
  return `<div class="dates" data-date="${k}">
    <select aria-label="روز">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === d ? 'selected' : ''}>${faNum(i + 1)}</option>`).join('')}</select>
    <select aria-label="ماه">${MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <select aria-label="سال">${years.map((yy) => `<option value="${yy}" ${yy === y ? 'selected' : ''}>${faNum(yy)}</option>`).join('')}</select></div>`;
}
function readDate(root, k) {
  const [d, m, y] = [...$(`[data-date="${k}"]`, root).querySelectorAll('select')].map((s) => Number(s.value));
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}
function fieldHtml(f, v) {
  const id = `f_${f.k}`;
  let inner;
  if (f.t === 'area') inner = `<textarea id="${id}">${esc(v)}</textarea>`;
  else if (f.t === 'select') inner = `<select id="${id}">${f.opts.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  else if (f.t === 'date') return `<label class="f"><span>${f.l}</span>${dateWidget(f.k, v)}</label>`;
  else if (f.t === 'price') inner = `<input type="text" inputmode="numeric" id="${id}" class="ltr price" value="${v ? Number(v).toLocaleString('en-US') : ''}">`;
  else if (f.t === 'number') inner = `<input type="number" inputmode="numeric" id="${id}" class="ltr" value="${esc(v)}">`;
  else inner = `<input type="text" id="${id}" class="${f.ltr ? 'ltr' : ''}" value="${esc(v)}" placeholder="${esc(f.ph || '')}" ${f.list ? `list="dl_${f.k}"` : ''}>${f.list ? `<datalist id="dl_${f.k}">${f.list.map((o) => `<option value="${o}">`).join('')}</datalist>` : ''}`;
  return `<label class="f"><span>${f.l}${f.req ? ' *' : ''}</span>${inner}</label>`;
}
function bindPriceInputs(root) {
  root.querySelectorAll('.price').forEach((el) => el.addEventListener('input', () => {
    const n = toNum(el.value); el.value = n ? n.toLocaleString('en-US') : '';
  }));
}
function readForm(root, brand) {
  const out = {};
  for (const f of fieldsFor(brand)) {
    if (f.t === 'date') out[f.k] = readDate(root, f.k);
    else if (f.t === 'price') out[f.k] = toNum($(`#f_${f.k}`, root).value);
    else out[f.k] = fa2en($(`#f_${f.k}`, root).value.trim());
  }
  return out;
}

/* ---------- ورود کالا ---------- */
function brandChips(selected, withAdd = true) {
  return `<div class="chips">${state.brands.map((b) => `<button class="chip ${b === selected ? 'act' : ''}" data-brand="${esc(b)}">${esc(b)}</button>`).join('')}${withAdd ? '<button class="chip add" id="addBrand">+ برند جدید</button>' : ''}</div>`;
}
function entryView() {
  if (ui.editId) return editView();
  const b = ui.entryBrand;
  return `<h2 class="title">برند کالا</h2>${brandChips(b)}
    ${b ? `<form id="entryForm" class="card">${fieldsFor(b).map((f) => fieldHtml(f, f.k === 'ownership' ? OWNERSHIP[0] : '')).join('')}
      <button class="btn tag block" type="submit">ثبت ورود ${esc(b)}</button></form>` : '<div class="empty">برند گوشی را انتخاب کنید تا فرم ورود باز شود.</div>'}`;
}
function editView() {
  const it = state.items.find((x) => x.id === ui.editId);
  if (!it) { ui.editId = null; return entryView(); }
  return `<h2 class="title">ویرایش ${esc(it.brand)} ${esc(it.model)}</h2>
    <form id="entryForm" class="card">${fieldsFor(it.brand).map((f) => fieldHtml(f, it[f.k])).join('')}
      <div class="row"><button class="btn tag" type="submit">ذخیره تغییرات</button>
      <button class="btn sec" type="button" id="cancelEdit">انصراف</button></div>
      <button class="btn danger sm block" type="button" id="delItem" style="margin-top:12px">حذف این گوشی</button></form>`;
}
async function addBrandFlow() {
  const name = (prompt('نام برند جدید را وارد کنید:') || '').trim();
  if (!name) return;
  if (state.brands.includes(name)) return toast('این برند قبلاً ثبت شده است');
  await store.saveBrands([...state.brands, name]);
  ui.entryBrand = name; render();
}
function bindEntry() {
  document.querySelectorAll('[data-brand]').forEach((b) => b.onclick = () => { ui.entryBrand = b.dataset.brand; render(); });
  $('#addBrand') && ($('#addBrand').onclick = addBrandFlow);
  const form = $('#entryForm'); if (!form) return;
  bindPriceInputs(form);
  $('#cancelEdit') && ($('#cancelEdit').onclick = () => { ui.editId = null; ui.tab = 'stock'; render(); });
  $('#delItem') && ($('#delItem').onclick = async () => {
    if (!confirm('این گوشی برای همیشه حذف شود؟')) return;
    await store.deleteItem(ui.editId); ui.editId = null; ui.tab = 'stock'; render();
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const existing = ui.editId && state.items.find((x) => x.id === ui.editId);
    const brand = existing ? existing.brand : ui.entryBrand;
    const vals = readForm(form, brand);
    if (!vals.model) return toast('مدل گوشی را وارد کنید');
    const item = existing ? { ...existing, ...vals } : { id: uid(), brand, status: 'in', sale: null, createdAt: Date.now(), ...vals };
    if (!existing || existing.sellPrice !== vals.sellPrice) item.sellPriceDate = todayStr();
    await store.saveItem(item);
    toast(existing ? '✅ تغییرات ذخیره شد' : '✅ گوشی وارد انبار شد');
    ui.editId = null;
    if (existing) ui.tab = 'stock'; else ui.entryBrand = brand;
    render();
  };
}

/* ---------- کارت مشخصات ---------- */
function specRows(it) {
  return fieldsFor(it.brand).filter((f) => !['model', 'sellPrice'].includes(f.k)).map((f) => {
    let v = it[f.k];
    if (v === '' || v == null || v === 0 && f.t !== 'number') return '';
    if (f.t === 'date') v = showDate(v);
    else if (f.t === 'price') v = fmtPrice(v) + ' تومان';
    else if (f.k === 'battery') v = faNum(v) + '٪';
    else if (['storage', 'ram'].includes(f.k) && /^\d+$/.test(v)) v = faNum(v) + ' گیگ';
    else if (f.k === 'cycle') v = faNum(v);
    else v = esc(v);
    return `<dt>${f.l.replace(' (٪)', '').replace(' (تومان)', '')}</dt><dd>${v}</dd>`;
  }).join('');
}
function phoneCard(it, mode) {
  const sale = it.sale;
  const profit = sale ? sale.finalPrice - (it.buyPrice || 0) : 0;
  const tag = mode === 'out'
    ? `<div class="lbl">قیمت نهایی</div><div class="price">${fmtPrice(sale.finalPrice)}</div><div class="unit">تومان</div><div class="when">${showDate(sale.date)}</div>`
    : `<div class="lbl">قیمت فروش</div><div class="price">${it.sellPrice ? fmtPrice(it.sellPrice) : '—'}</div><div class="unit">تومان</div><div class="when">آخرین تغییر قیمت<br>${showDate(it.sellPriceDate, false)}</div>`;
  return `<article class="phone ${mode === 'out' ? 'out' : ''}"><div class="body">
    <div class="head"><span class="brand">${esc(it.brand)}</span><span class="model">${esc(it.model)}</span></div>
    <dl class="kv">${specRows(it)}
      ${mode === 'out' ? `<dt>خریدار</dt><dd>${esc(sale.buyer)}</dd><dt>سود نقدی</dt><dd class="profit ${profit >= 0 ? 'pos' : 'neg'}">${fmtPrice(profit)} تومان</dd>` : ''}</dl>
    <div class="actions">${mode === 'stock'
      ? `<button class="btn sm sec" data-edit="${it.id}">ویرایش</button><button class="btn sm tag" data-exit="${it.id}">خروج کالا</button>`
      : `<button class="btn sm sec" data-undo="${it.id}">بازگشت به موجودی</button>`}</div>
  </div><div class="tagcol">${tag}</div></article>`;
}

/* ---------- کالاهای موجود ---------- */
function stockView(list) {
  const brands = [...new Set([...state.brands, ...list.map((i) => i.brand)])];
  const min = toNum(ui.minP), max = toNum(ui.maxP), q = ui.q.trim().toLowerCase();
  const shown = list.filter((i) =>
    (ui.brandFilter === 'all' || i.brand === ui.brandFilter) &&
    (!min || (i.sellPrice || 0) >= min) && (!max || (i.sellPrice || 0) <= max) &&
    (!q || `${i.model} ${i.color} ${i.partNumber || ''}`.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt - a.createdAt);
  return `<div class="chips"><button class="chip ${ui.brandFilter === 'all' ? 'act' : ''}" data-bf="all">همه</button>
      ${brands.map((b) => `<button class="chip ${ui.brandFilter === b ? 'act' : ''}" data-bf="${esc(b)}">${esc(b)}</button>`).join('')}</div>
    <div class="filters"><input type="text" inputmode="numeric" class="ltr price" id="minP" placeholder="قیمت فروش از" value="${ui.minP}">
      <input type="text" inputmode="numeric" class="ltr price" id="maxP" placeholder="تا" value="${ui.maxP}">
      <input type="text" class="full" id="q" placeholder="جستجوی مدل، رنگ یا پارت نامبر" value="${esc(ui.q)}"></div>
    <p class="hint">${faNum(shown.length)} گوشی از ${faNum(list.length)} گوشی موجود</p>
    ${shown.length ? shown.map((i) => phoneCard(i, 'stock')).join('') : '<div class="empty">گوشی‌ای با این فیلتر پیدا نشد.</div>'}`;
}
function bindStock() {
  document.querySelectorAll('[data-bf]').forEach((b) => b.onclick = () => { ui.brandFilter = b.dataset.bf; render(); });
  bindPriceInputs(document);
  const keep = (id, key) => { const el = $('#' + id); el.onchange = () => { ui[key] = el.value; render(); }; };
  keep('minP', 'minP'); keep('maxP', 'maxP'); keep('q', 'q');
  document.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => { ui.editId = b.dataset.edit; ui.tab = 'in'; render(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-exit]').forEach((b) => b.onclick = () => exitSheet(b.dataset.exit));
}

/* ---------- خروج کالا ---------- */
function openModal(html, center) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="overlay ${center ? 'mid' : ''}"><div class="sheet ${center ? 'center' : ''}">${html}</div></div>`;
  return root;
}
const closeModal = () => { $('#modal-root').innerHTML = ''; };
function exitSheet(id) {
  const it = state.items.find((x) => x.id === id); if (!it) return;
  const root = openModal(`<h3>خروج کالا: ${esc(it.brand)} ${esc(it.model)}</h3>
    <label class="f"><span>نام و نام خانوادگی خریدار *</span><input type="text" id="buyer"></label>
    <label class="f"><span>تاریخ فروش</span>${dateWidget('sdate', todayStr())}</label>
    <label class="f"><span>قیمت نهایی (تومان) *</span><input type="text" inputmode="numeric" id="final" class="ltr price" value="${it.sellPrice ? Number(it.sellPrice).toLocaleString('en-US') : ''}"></label>
    <div class="row"><button class="btn tag" id="next">ثبت خروج</button><button class="btn sec" id="cancel">انصراف</button></div>`);
  bindPriceInputs(root);
  $('#cancel', root).onclick = closeModal;
  $('#next', root).onclick = () => {
    const buyer = $('#buyer', root).value.trim(), finalPrice = toNum($('#final', root).value), date = readDate(root, 'sdate');
    if (!buyer || !finalPrice) return toast('نام خریدار و قیمت نهایی را وارد کنید');
    openModal(`<h3>آیا از خروج کالا مطمئن هستید؟</h3>
      <p>${esc(it.brand)} ${esc(it.model)} به <b>${esc(buyer)}</b> با قیمت <b>${fmtPrice(finalPrice)}</b> تومان</p>
      <div class="row"><button class="btn" id="yes">بله</button><button class="btn sec" id="no">خیر</button></div>`, true);
    $('#no').onclick = closeModal;
    $('#yes').onclick = async () => {
      await store.saveItem({ ...it, status: 'out', sale: { buyer, date, finalPrice } });
      closeModal(); toast('📤 گوشی به کالاهای خروجی منتقل شد');
    };
  };
}

/* ---------- کالاهای خروجی ---------- */
function outView() {
  const outs = state.items.filter((i) => i.status === 'out' && i.sale);
  if (!outs.length) return '<div class="empty">هنوز گوشی‌ای خارج نشده است.</div>';
  const years = [...new Set(outs.map((i) => i.sale.date.split('/')[0]))].sort().reverse();
  if (!ui.outYear || !years.includes(ui.outYear)) ui.outYear = years[0];
  const ofYear = outs.filter((i) => i.sale.date.startsWith(ui.outYear + '/'));
  const sum = (arr) => ({ n: arr.length, sales: arr.reduce((s, i) => s + i.sale.finalPrice, 0), profit: arr.reduce((s, i) => s + i.sale.finalPrice - (i.buyPrice || 0), 0) });
  const yearChips = `<div class="chips">${years.map((y) => `<button class="chip ${y === ui.outYear ? 'act' : ''}" data-oy="${y}">${faNum(y)}</button>`).join('')}</div>`;
  const box = (t) => `<div class="summary"><div class="card"><div class="n">${fmtPrice(t.sales)}</div><div class="l">جمع فروش (تومان)</div></div>
    <div class="card"><div class="n profit ${t.profit >= 0 ? 'pos' : 'neg'}">${fmtPrice(t.profit)}</div><div class="l">جمع سود نقدی (تومان)</div></div></div>`;

  if (ui.outMonth) {
    const arr = ofYear.filter((i) => Number(i.sale.date.split('/')[1]) === ui.outMonth).sort((a, b) => b.sale.date.localeCompare(a.sale.date));
    return `${yearChips}<button class="btn sec sm" id="backMonths">‹ ماه‌های ${faNum(ui.outYear)}</button>
      <h2 class="title" style="margin-top:12px">${MONTHS[ui.outMonth - 1]} ${faNum(ui.outYear)} — ${faNum(arr.length)} گوشی</h2>
      ${box(sum(arr))}${arr.map((i) => phoneCard(i, 'out')).join('')}`;
  }
  const months = MONTHS.map((n, i) => ({ n, m: i + 1, ...sum(ofYear.filter((x) => Number(x.sale.date.split('/')[1]) === i + 1)) })).filter((x) => x.n > 0 || x.sales).reverse();
  return `${yearChips}<h2 class="title">جمع سال ${faNum(ui.outYear)}</h2>${box(sum(ofYear))}
    <h2 class="title">ماه‌ها</h2>
    ${months.map((m) => `<button class="mrow" data-om="${m.m}"><span class="m">${m.n}</span><span>${faNum(m.n)} گوشی</span>
      <small>جمع فروش: ${fmtPrice(m.sales)}</small><small class="profit ${m.profit >= 0 ? 'pos' : 'neg'}">سود: ${fmtPrice(m.profit)}</small></button>`).join('')}`;
}
function bindOut() {
  document.querySelectorAll('[data-oy]').forEach((b) => b.onclick = () => { ui.outYear = b.dataset.oy; ui.outMonth = null; render(); });
  document.querySelectorAll('[data-om]').forEach((b) => b.onclick = () => { ui.outMonth = Number(b.dataset.om); render(); window.scrollTo(0, 0); });
  $('#backMonths') && ($('#backMonths').onclick = () => { ui.outMonth = null; render(); });
  document.querySelectorAll('[data-undo]').forEach((b) => b.onclick = async () => {
    if (!confirm('این گوشی به کالاهای موجود برگردد؟ اطلاعات فروش پاک می‌شود.')) return;
    const it = state.items.find((x) => x.id === b.dataset.undo);
    await store.saveItem({ ...it, status: 'in', sale: null }); toast('به موجودی برگشت');
  });
}

/* ---------- تنظیمات، پشتیبان و آنلاین ---------- */
function settingsView() {
  const cfg = getFirebaseConfig();
  return `<div class="card"><h2 class="title">پشتیبان‌گیری</h2>
      <p class="hint">قبل از هر آپدیت برنامه یک فایل پشتیبان بگیرید. با بازیابی، گوشی‌های فایل به اطلاعات فعلی اضافه می‌شوند.</p>
      <div class="row"><button class="btn" id="bk">دانلود پشتیبان</button><button class="btn sec" id="rs">بازیابی از فایل</button></div>
      <input type="file" id="file" accept="application/json,.json" hidden></div>
    <div class="card"><h2 class="title">همگام‌سازی آنلاین کارکنان</h2>
      ${store.mode === 'online' ? `<p>وضعیت: <b>متصل</b>${user ? ` — ${esc(user.email)}` : ''}</p>
        <div class="row"><button class="btn sec" id="logout">خروج از حساب</button><button class="btn danger" id="offline">قطع اتصال آنلاین</button></div>`
      : `<p class="hint">برای استفاده چندنفره، تنظیمات پروژه Firebase را اینجا بچسبانید (راهنما در فایل README).</p>
        <label class="f"><span>firebaseConfig</span><textarea id="cfg" class="ltr" placeholder='{ "apiKey": "...", "authDomain": "...", "projectId": "...", "appId": "..." }'></textarea></label>
        <button class="btn tag block" id="saveCfg">اتصال</button>`}</div>
    <p class="hint" style="text-align:center">تعداد کل رکوردها: ${faNum(state.items.length)}</p>`;
}
function bindSettings() {
  $('#bk').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'phone-manager', version: 1, exportedAt: todayStr(), ...store.exportAll() }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `phone-backup-${todayStr().replace(/\//g, '-')}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#rs').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.items)) throw 0;
      if (!confirm(`${faNum(d.items.length)} گوشی از فایل بازیابی شود؟`)) return;
      await store.importAll(d); toast('✅ بازیابی انجام شد');
    } catch { toast('فایل پشتیبان معتبر نیست'); }
    e.target.value = '';
  };
  if ($('#saveCfg')) $('#saveCfg').onclick = () => {
    const cfg = parseConfig($('#cfg').value);
    if (!cfg?.apiKey || !cfg?.projectId) return toast('تنظیمات معتبر نیست');
    setFirebaseConfig(cfg); location.reload();
  };
  if ($('#logout')) $('#logout').onclick = () => store.logout();
  if ($('#offline')) $('#offline').onclick = () => { if (confirm('به حالت محلی برگردیم؟')) { setFirebaseConfig(null); location.reload(); } };
}
function parseConfig(txt) {
  const m = txt.match(/\{[\s\S]*\}/); if (!m) return null;
  try { return JSON.parse(m[0]); } catch { /* ادامه */ }
  try { return JSON.parse(m[0].replace(/'/g, '"').replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/,\s*}/g, '}')); } catch { return null; }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
