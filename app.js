'use strict';

const VERSION = '0.2';
const KEY = 'komora-v1';
const places = ['Холодильник', 'Морозилка', 'Крупы и шкаф', 'Специи', 'Другое'];
const units = ['шт', 'г', 'кг', 'мл', 'л', 'уп.'];

// ---------- state ----------

function loadState() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!s || !Array.isArray(s.items) || !Array.isArray(s.shop)) s = { items: [], shop: [] };
  if (!s.catalog || typeof s.catalog !== 'object') s.catalog = {};
  return s;
}

let state = loadState();
let filter = 'Все', editing = null, consuming = null, foundId = null;

const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = n => Math.round(n * 1000) / 1000;
const plural = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { alert('Не удалось сохранить данные — память браузера переполнена или недоступна.'); }
  render();
}

let toastTimer;
function toast(text) {
  let el = $('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(90px + env(safe-area-inset-bottom));background:#143d32;color:#fff;padding:11px 16px;border-radius:12px;font-size:14px;z-index:20;max-width:90vw;box-shadow:0 8px 30px #0003';
    document.body.append(el);
  }
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.hidden = true, 2600);
}

// ---------- expiry ----------

function days(date) {
  if (!date) return null;
  let today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(date + 'T00:00:00') - today) / 86400000);
}

function status(i) {
  let d = days(i.expiry);
  if (d === null) return ['Без срока', ''];
  if (d < 0) return ['Просрочено', 'late'];
  if (d <= 3) return [d === 0 ? 'Сегодня' : d === 1 ? 'Завтра' : `Осталось ${d} дн.`, 'soon'];
  return ['До ' + new Date(i.expiry + 'T00:00:00').toLocaleDateString('ru-RU'), ''];
}

// ---------- render ----------

function render() {
  let count = state.items.length;
  let soon = state.items.filter(i => { let d = days(i.expiry); return d !== null && d >= 0 && d <= 3; });
  let late = state.items.filter(i => { let d = days(i.expiry); return d !== null && d < 0; });

  $('stats').innerHTML =
    `<div class="stat"><b>${count}</b><span>Продуктов</span></div>` +
    `<div class="stat warn"><b>${soon.length}</b><span>Скоро истекут</span></div>` +
    `<div class="stat danger"><b>${late.length}</b><span>Просрочено</span></div>`;

  let names = list => list.map(i => esc(i.name)).join(', ');
  $('alerts').innerHTML =
    (late.length ? `<div class="alert late">⚠️ Просрочено: ${names(late)}</div>` : '') +
    (soon.length ? `<div class="alert">⏳ Скоро истекает: ${names(soon)}</div>` : '');
  if (navigator.setAppBadge) {
    let n = soon.length + late.length;
    (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }

  $('tabs').innerHTML = ['Все', ...places]
    .map(p => `<button class="tab ${p === filter ? 'active' : ''}" data-filter="${esc(p)}">${esc(p)}</button>`).join('');

  let q = $('search').value.trim().toLocaleLowerCase('ru');
  let items = state.items.filter(i =>
    (filter === 'Все' || i.place === filter) &&
    (String(i.name).toLocaleLowerCase('ru').includes(q) || (q && i.barcode === q)));

  $('list').innerHTML = items.length ? places.map(p => {
    let group = items.filter(i => i.place === p)
      .sort((a, b) => (days(a.expiry) ?? 99999) - (days(b.expiry) ?? 99999));
    if (!group.length) return '';
    return `<section class="group"><h2>${esc(p)}<small>${group.length} поз.</small></h2><div class="cards">${group.map(i => {
      let [label, cls] = status(i);
      return `<article class="item">
        <div class="itemtop"><strong>${esc(i.name)}</strong><span class="tag ${cls}">${esc(label)}</span></div>
        <div class="details">Осталось: <b>${esc(i.qty)} ${esc(i.unit)}</b>${i.barcode ? ' · ' + esc(i.barcode) : ''}</div>
        <div class="actions">
          <button class="secondary" data-use="${esc(i.id)}">− Использовать</button>
          <button class="ghost" data-edit="${esc(i.id)}">Изменить</button>
        </div>
      </article>`;
    }).join('')}</div></section>`;
  }).join('') : `<div class="empty"><div class="big">🥬</div><h3>Здесь пока пусто</h3><p>Добавь первый продукт или отсканируй штрихкод.</p></div>`;

  $('shopList').innerHTML = state.shop.length ? state.shop.map(s =>
    `<div class="shoprow ${s.done ? 'done' : ''}">
      <input type="checkbox" data-check="${esc(s.id)}" ${s.done ? 'checked' : ''}>
      <span class="name">${esc(s.name)}</span>
      <button class="ghost" data-remove="${esc(s.id)}">×</button>
    </div>`).join('') : '<div class="empty">🛒<p>Список покупок пуст.</p></div>';
  $('shopClearDone').classList.toggle('hidden', !state.shop.some(s => s.done));

  $('subtitle').textContent = `${count} ${plural(count, 'позиция', 'позиции', 'позиций')} на складе`;
}

$('tabs').onclick = e => {
  let b = e.target.closest('[data-filter]');
  if (b) { filter = b.dataset.filter; render(); }
};
$('search').oninput = render;

// ---------- barcode lookup ----------

// "1,5 л" -> {qty: 1.5, unit: 'л'}, "185g" -> {qty: 185, unit: 'г'}; packs like "6 x 0.5 l" are skipped
function parseQuantity(text) {
  if (!text || /[x×*]/i.test(text)) return null;
  let m = String(text).toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|кг|g|gr|г|гр|ml|мл|cl|l|л)(?![a-zа-яіїє])/);
  if (!m) return null;
  let qty = Number(m[1]);
  let unit = { kg: 'кг', кг: 'кг', g: 'г', gr: 'г', г: 'г', гр: 'г', ml: 'мл', мл: 'мл', l: 'л', л: 'л' }[m[2]];
  if (m[2] === 'cl') { qty *= 10; unit = 'мл'; }
  return qty > 0 && unit ? { qty, unit } : null;
}

async function lookupOpenFoodFacts(code) {
  let ctrl = new AbortController();
  let timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    let url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_uk,product_name_ru,brands,quantity`;
    let res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    let p = (await res.json()).product;
    if (!p) return null;
    let name = (p.product_name_uk || p.product_name_ru || p.product_name || '').trim();
    if (!name) return null;
    let brands = String(p.brands || '').split(',').map(b => b.trim()).filter(Boolean);
    let lower = name.toLocaleLowerCase();
    if (brands.length && !brands.some(b => lower.includes(b.toLocaleLowerCase()))) {
      name = `${brands.find(b => /[а-яіїєґ]/i.test(b)) || brands[0]} ${name}`;
    }
    return { name: name.slice(0, 90), ...parseQuantity(p.quantity) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let lookupSeq = 0;
async function fillFromBarcode(code) {
  let form = $('form'), st = $('lookupStatus');
  code = String(code || '').trim();
  if (!/^\d{6,14}$/.test(code)) { st.textContent = ''; return; }
  let seq = ++lookupSeq;
  let known = state.catalog[code];
  if (known) {
    applyProductInfo(known);
    st.textContent = '✓ Этот товар уже встречался — данные подставлены.';
    return;
  }
  if (!navigator.onLine) { st.textContent = 'Нет интернета — впиши название вручную.'; return; }
  st.textContent = 'Ищу товар в Open Food Facts…';
  let info = await lookupOpenFoodFacts(code);
  if (seq !== lookupSeq || form.elements.barcode.value.trim() !== code) return;
  if (info) {
    applyProductInfo(info);
    st.textContent = '✓ Найдено в Open Food Facts. Проверь название.';
  } else {
    st.textContent = 'Товар не найден. Впиши название — Комора запомнит его для этого штрихкода.';
    form.elements.name.focus();
  }
}

function applyProductInfo(info) {
  let f = $('form').elements;
  if (!f.name.value.trim() && info.name) f.name.value = info.name;
  if (info.qty) f.qty.value = info.qty;
  if (info.unit && units.includes(info.unit)) f.unit.value = info.unit;
  if (info.place && places.includes(info.place)) f.place.value = info.place;
}

// ---------- editor ----------

function edit(id, barcode) {
  editing = id;
  lookupSeq++;
  let i = state.items.find(x => x.id === id);
  let form = $('form');
  form.reset();
  $('lookupStatus').textContent = '';
  $('formTitle').textContent = i ? 'Изменить продукт' : 'Добавить продукт';
  if (i) for (let key of ['name', 'qty', 'unit', 'place', 'expiry', 'barcode']) form.elements[key].value = i[key] ?? '';
  else if (filter !== 'Все') form.elements.place.value = filter;
  $('deleteItem').classList.toggle('hidden', !i);
  $('editor').showModal();
  if (!i && barcode) {
    form.elements.barcode.value = barcode;
    fillFromBarcode(barcode);
  }
}

$('addBtn').onclick = () => edit(null);
$('cancel').onclick = () => $('editor').close();
$('form').elements.barcode.onchange = e => {
  if (!$('form').elements.name.value.trim()) fillFromBarcode(e.target.value);
};
$('formScan').onclick = () => startScan(code => {
  $('form').elements.barcode.value = code;
  fillFromBarcode(code);
});

$('form').onsubmit = e => {
  e.preventDefault();
  let f = new FormData(e.target);
  let item = {
    id: editing || uid(),
    name: String(f.get('name')).trim(),
    qty: round(Number(f.get('qty'))),
    unit: f.get('unit'),
    place: f.get('place'),
    expiry: f.get('expiry'),
    barcode: String(f.get('barcode')).trim(),
  };
  if (!item.name || !Number.isFinite(item.qty) || item.qty < 0) return;
  let old = state.items.find(x => x.id === editing);
  if (item.barcode && (!state.catalog[item.barcode] || !old)) {
    state.catalog[item.barcode] = { name: item.name, qty: item.qty, unit: item.unit, place: item.place };
  } else if (item.barcode) {
    Object.assign(state.catalog[item.barcode], { name: item.name, unit: item.unit, place: item.place });
  }
  if (old) state.items = state.items.map(x => x.id === editing ? item : x);
  else state.items.push(item);
  $('editor').close();
  save();
};

$('deleteItem').onclick = () => {
  if (confirm('Удалить этот продукт?')) {
    state.items = state.items.filter(x => x.id !== editing);
    $('editor').close();
    save();
  }
};

// ---------- consume ----------

function openConsume(id) {
  let i = state.items.find(x => x.id === id);
  if (!i) return;
  consuming = id;
  $('consumeInfo').textContent = `${i.name} · осталось ${i.qty} ${i.unit}`;
  $('consumeQty').value = ['г', 'мл'].includes(i.unit) ? Math.min(100, i.qty) : Math.min(1, i.qty);
  $('consumeQty').max = i.qty;
  $('consumeDialog').showModal();
}

$('list').onclick = e => {
  let b = e.target.closest('[data-edit],[data-use]');
  if (!b) return;
  if (b.dataset.edit) edit(b.dataset.edit);
  else openConsume(b.dataset.use);
};

$('consumeCancel').onclick = () => $('consumeDialog').close();
$('consumeAll').onclick = () => {
  let i = state.items.find(x => x.id === consuming);
  if (i) $('consumeQty').value = i.qty;
};
$('consumeSave').onclick = () => {
  let i = state.items.find(x => x.id === consuming), q = Number($('consumeQty').value);
  if (!i || !Number.isFinite(q) || q <= 0 || q > i.qty) { alert('Укажи количество не больше остатка'); return; }
  i.qty = round(i.qty - q);
  $('consumeDialog').close();
  if (i.qty === 0) {
    state.items = state.items.filter(x => x.id !== i.id);
    if (confirm(`«${i.name}» закончился. Добавить в покупки?`)) state.shop.push({ id: uid(), name: i.name, done: false });
  }
  save();
};

// ---------- scanned an existing product ----------

function openFound(item) {
  foundId = item.id;
  let pack = state.catalog[item.barcode]?.qty || 1;
  $('foundTitle').textContent = item.name;
  $('foundInfo').textContent = `Дома: ${item.qty} ${item.unit} · ${item.place}`;
  $('foundBought').textContent = `＋ Купил ещё (${pack} ${item.unit})`;
  $('foundDialog').showModal();
}

$('foundBought').onclick = () => {
  let i = state.items.find(x => x.id === foundId);
  if (!i) return;
  let pack = state.catalog[i.barcode]?.qty || 1;
  i.qty = round(i.qty + pack);
  $('foundDialog').close();
  save();
  toast(`${i.name}: теперь ${i.qty} ${i.unit}`);
};
$('foundUse').onclick = () => { $('foundDialog').close(); openConsume(foundId); };
$('foundEdit').onclick = () => { $('foundDialog').close(); edit(foundId); };
$('foundClose').onclick = () => $('foundDialog').close();

// ---------- pages ----------

document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => {
  let p = b.dataset.page;
  document.querySelectorAll('[data-page]').forEach(x => x.classList.toggle('on', x === b));
  for (let id of ['inventory', 'shopping', 'settings']) $(id).classList.toggle('hidden', id !== p);
  $('heading').textContent = { inventory: 'Мои продукты', shopping: 'Список покупок', settings: 'Настройки' }[p];
  $('addBtn').classList.toggle('hidden', p !== 'inventory');
  $('subtitle').classList.toggle('hidden', p !== 'inventory');
});

// ---------- shopping ----------

function addShop() {
  let n = $('shopInput').value.trim();
  if (!n) return;
  state.shop.push({ id: uid(), name: n, done: false });
  $('shopInput').value = '';
  save();
}
$('shopAdd').onclick = addShop;
$('shopInput').onkeydown = e => { if (e.key === 'Enter') addShop(); };
$('shopList').onchange = e => {
  let id = e.target.dataset.check;
  let s = id && state.shop.find(x => x.id === id);
  if (s) { s.done = e.target.checked; save(); }
};
$('shopList').onclick = e => {
  let id = e.target.dataset.remove;
  if (id) { state.shop = state.shop.filter(x => x.id !== id); save(); }
};
$('shopClearDone').onclick = () => { state.shop = state.shop.filter(s => !s.done); save(); };

// ---------- settings ----------

$('export').onclick = () => {
  let blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'komora-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('import').onclick = () => $('importFile').click();
$('importFile').onchange = async e => {
  let file = e.target.files[0];
  if (!file) return;
  try {
    let obj = JSON.parse(await file.text());
    if (!Array.isArray(obj.items) || !Array.isArray(obj.shop)) throw Error();
    if (confirm('Заменить текущие данные содержимым файла?')) {
      state = { items: obj.items, shop: obj.shop, catalog: obj.catalog && typeof obj.catalog === 'object' ? obj.catalog : {} };
      save();
    }
  } catch {
    alert('Не удалось прочитать файл Коморы');
  }
  e.target.value = '';
};
$('clear').onclick = () => {
  if (confirm('Удалить ВСЕ продукты и покупки? Это нельзя отменить.')) {
    state = { items: [], shop: [], catalog: state.catalog };
    save();
  }
};
$('version').textContent = `Комора v${VERSION}`;

// ---------- scanner ----------

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
let detectorPromise = null, stream = null, scanning = false, onScan = null;

// Native BarcodeDetector where it exists (Android Chrome), otherwise the bundled zxing-wasm one (iPhone Safari)
function getDetector() {
  if (!detectorPromise) detectorPromise = (async () => {
    if ('BarcodeDetector' in window) {
      try {
        let supported = await window.BarcodeDetector.getSupportedFormats();
        if (supported.includes('ean_13')) return new window.BarcodeDetector({ formats: FORMATS });
      } catch {}
    }
    let api = window.BarcodeDetectionAPI;
    if (!api) throw Error('сканер не загрузился');
    api.prepareZXingModule({
      overrides: { locateFile: (path, prefix) => path.endsWith('.wasm') ? new URL('vendor/' + path, location.href).href : prefix + path },
      fireImmediately: true,
    });
    return new api.BarcodeDetector({ formats: FORMATS });
  })();
  detectorPromise.catch(() => detectorPromise = null);
  return detectorPromise;
}

async function startScan(callback) {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Этот браузер не даёт доступ к камере. Штрихкод можно ввести вручную.');
    return;
  }
  onScan = callback;
  $('scanStatus').textContent = 'Включаю камеру…';
  $('scanner').showModal();
  try {
    let [detector, s] = await Promise.all([
      getDetector(),
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
    ]);
    if (!$('scanner').open) { s.getTracks().forEach(t => t.stop()); return; }
    stream = s;
    let video = $('camera');
    video.srcObject = stream;
    await video.play().catch(() => {});
    $('scanStatus').textContent = 'Наведи камеру на штрихкод — держи его на линии.';
    scanning = true;
    scanLoop(detector, video);
  } catch (err) {
    stopScan();
    let msg = err?.name === 'NotAllowedError'
      ? 'Нет доступа к камере. Разреши его: Настройки iPhone → Safari → Камера.'
      : 'Не удалось запустить сканер: ' + (err?.message || err);
    alert(msg);
  }
}

async function scanLoop(detector, video) {
  if (!scanning) return;
  try {
    if (video.readyState >= 2) {
      let codes = await detector.detect(video);
      if (scanning && codes.length) {
        let code = codes[0].rawValue, cb = onScan;
        stopScan();
        if (navigator.vibrate) navigator.vibrate(60);
        cb?.(code);
        return;
      }
    }
  } catch {}
  setTimeout(() => scanLoop(detector, video), 150);
}

function stopScan() {
  scanning = false;
  onScan = null;
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  $('camera').srcObject = null;
  if ($('scanner').open) $('scanner').close();
}

$('scanClose').onclick = stopScan;
$('scanner').onclose = stopScan;
$('scanner').oncancel = stopScan;

$('scanBtn').onclick = () => startScan(code => {
  let found = state.items.find(i => i.barcode === code);
  if (found) openFound(found);
  else edit(null, code);
});

// ---------- start ----------

render();
setInterval(render, 60 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
