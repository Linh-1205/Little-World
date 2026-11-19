'use strict';
/* Tiện ích dùng chung: DOM, API, modal, toast, ngày tháng, xử lý ảnh */

// Bảng màu của website (đồng bộ với style.css)
const PALETTE = ['#FFF5F7', '#FFF0F4', '#FCE4EB', '#F3DCE4', '#F3D3DE', '#EBC0CF', '#E58BA2', '#D97996', '#C85F7D', '#A64F6B', '#FFFFFF', '#FFFCF7', '#E9E0D1', '#D7E5E8', '#C8D0D2', '#B2D1DF', '#A4C3D4', '#8999B2', '#71899F', '#68798A', '#536B87', '#303B49', '#59434D', '#9D8490'];

// khả năng của máy chủ: không có R2 thì ảnh lưu trong D1 (giới hạn nhỏ, không có video/nhạc)
const CAPS = { r2: true };

// replaceChildren/append mặc định biến null, false và mảng thành chữ "null", "[object ...]": lọc và trải phẳng
for (const m of ['replaceChildren', 'append', 'prepend']) {
  const orig = Element.prototype[m];
  Element.prototype[m] = function (...kids) {
    return orig.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false));
  };
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Tạo phần tử an toàn (dùng textContent, không dùng innerHTML cho dữ liệu người dùng)
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) (p.startsWith('--') ? el.style.setProperty(p, val) : (el.style[p] = val));
    } else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

/* ───── API ───── */
async function api(path, { method = 'GET', body, blob } = {}) {
  const opt = { method, headers: { 'x-lw': '1' }, credentials: 'same-origin' };
  if (blob) {
    opt.body = blob;
    opt.headers['content-type'] = blob.type;
  } else if (body !== undefined) {
    opt.body = JSON.stringify(body);
    opt.headers['content-type'] = 'application/json';
  }
  let r;
  try {
    r = await fetch('/api/' + path, opt);
  } catch {
    throw new Error('Không kết nối được máy chủ, kiểm tra mạng nhé.');
  }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== 'login' && typeof onLoggedOut === 'function') onLoggedOut();
  if (!r.ok) throw new Error((d.error || 'Có lỗi xảy ra') + (d.detail ? ` (${d.detail})` : ''));
  return d;
}
const mu = (key) => '/api/media/' + key;

/* ───── ngày tháng ───── */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const parseYmd = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const fmtDate = (s) => {
  if (!s) return '';
  const d = parseYmd(s);
  return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
};
const fmtShort = (s) => {
  const d = parseYmd(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const isoFromDay = (s) => (s ? parseYmd(s).toISOString() : null);
const dayFromIso = (iso) => (iso ? ymd(new Date(iso)) : '');
const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
const rnd = (a, b) => a + Math.random() * (b - a);
const seedRot = (id) => (((id * 9301 + 49297) % 233280) / 233280) * 6 - 3; // góc nghiêng ổn định theo id

/* ───── toast ───── */
function toast(msg, ms = 2800) {
  const t = h('div', { class: 'toast' }, msg);
  $('#toasts').append(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 500);
  }, ms);
  return t;
}

/* ───── modal ───── */
function modal(title, body, o = {}) {
  const ov = h('div', { class: 'overlay' });
  const close = () => {
    document.removeEventListener('keydown', esc);
    ov.classList.remove('in');
    setTimeout(() => {
      ov.remove();
      if (!$('.overlay')) document.body.classList.remove('lock');
    }, 300);
    o.onClose && o.onClose();
  };
  const esc = (e) => {
    if (e.key === 'Escape' && ov === [...$$('.overlay')].pop() && !o.sticky) close();
  };
  const x = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', onclick: close }, '✕');
  const card = h('div', { class: 'sheet glass' + (o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' }, title ? h('div', { class: 'sheet-h' }, h('h3', null, title), x) : null, body);
  ov.append(card);
  if (!o.sticky) ov.addEventListener('pointerdown', (e) => e.target === ov && close());
  document.addEventListener('keydown', esc);
  document.body.append(ov);
  document.body.classList.add('lock');
  requestAnimationFrame(() => ov.classList.add('in'));
  return { el: card, close };
}

function confirmBox(msg, yes = 'Xoá') {
  return new Promise((res) => {
    let done = false;
    const fin = (v) => {
      if (!done) {
        done = true;
        res(v);
      }
    };
    const m = modal('', h('div', { class: 'confirm' }, h('p', null, msg), h('div', { class: 'form-actions' }, h('button', { class: 'btn ghost', onclick: () => (fin(false), m.close()) }, 'Để sau'), h('button', { class: 'btn primary', onclick: () => (fin(true), m.close()) }, yes))), { onClose: () => fin(false) });
  });
}

/* ───── form dùng chung ─────
   fields: {name,label,type:text|textarea|date|select|check|url|photo|hidden, options, required, hint, list, iso, min, ph, rows}
   Trả về modal; onSubmit(values) có thể ném lỗi để hiển thị toast. */
function formModal({ title, fields, values = {}, submit = 'Lưu', onSubmit, extra }) {
  const form = h('form', { class: 'form' });
  const getters = {};
  const wrap = (f, input, cls = '') => h('div', { class: 'fld ' + cls }, f.label && f.type !== 'check' ? h('label', null, f.label) : null, input, f.hint ? h('span', { class: 'hint' }, f.hint) : null);
  for (const f of fields) {
    const v = values[f.name];
    let el;
    if (f.type === 'textarea') {
      el = h('textarea', { rows: f.rows || 4, placeholder: f.ph || '', maxlength: 20000, required: f.required });
      el.value = v ?? '';
      getters[f.name] = () => el.value.trim();
      form.append(wrap(f, el));
    } else if (f.type === 'select') {
      el = h('select', null, f.options.map(([val, lab]) => h('option', { value: val }, lab)));
      el.value = v ?? f.options[0][0];
      getters[f.name] = () => el.value;
      form.append(wrap(f, el));
    } else if (f.type === 'check') {
      const id = 'c' + Math.random().toString(36).slice(2);
      el = h('input', { type: 'checkbox', id });
      el.checked = v == null ? !!f.def : !!v;
      getters[f.name] = () => el.checked;
      form.append(h('div', { class: 'fld chk' }, el, h('label', { for: id }, f.label)));
    } else if (f.type === 'photo') {
      const pf = photoField({ key: v, label: f.label, decorate: f.decorate !== false, small: f.small });
      getters[f.name] = () => pf.commit();
      form.append(wrap(f, pf.el));
    } else if (f.type === 'date') {
      el = h('input', { type: 'date', required: f.required, min: f.min });
      el.value = v ? (f.iso ? dayFromIso(v) : String(v).slice(0, 10)) : '';
      getters[f.name] = () => (el.value ? (f.iso ? isoFromDay(el.value) : el.value) : null);
      form.append(wrap(f, el));
    } else {
      const lid = f.list ? 'l' + Math.random().toString(36).slice(2) : null;
      el = h('input', { type: f.type === 'url' ? 'url' : 'text', placeholder: f.ph || '', required: f.required, maxlength: 300, list: lid });
      el.value = v ?? '';
      getters[f.name] = () => el.value.trim();
      form.append(wrap(f, el), lid ? h('datalist', { id: lid }, f.list.map((o) => h('option', { value: o }))) : null);
    }
  }
  const cancel = h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Đóng');
  const btn = h('button', { class: 'btn primary', type: 'submit' }, submit);
  form.append(h('div', { class: 'form-actions' }, extra || null, cancel, btn));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Đang lưu…';
    try {
      const out = {};
      for (const k of Object.keys(getters)) out[k] = await getters[k]();
      await onSubmit(out);
      m.close();
    } catch (err) {
      toast(err.message || 'Có lỗi xảy ra');
      btn.disabled = false;
      btn.textContent = label;
    }
  });
  const m = modal(title, form);
  const first = $('input:not([type=checkbox]),textarea', form);
  if (first && matchMedia('(hover:hover)').matches) setTimeout(() => first.focus(), 350);
  return m;
}

/* ───── ảnh ───── */
function loadImg(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Trình duyệt chưa đọc được ảnh này (HEIC?). Hãy thử ảnh JPG/PNG nhé.'));
    im.src = url;
  });
}
const toBlob = (cv, type = 'image/jpeg', q = 0.9) => new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Không xử lý được ảnh'))), type, q));

// xuất canvas ra JPEG; nếu không có R2 thì hạ chất lượng/kích thước cho đến khi ≤ ~1,2MB
async function fitCanvas(cv, q = 0.9) {
  const limit = CAPS.r2 ? 14 * 1024 * 1024 : 1200 * 1024;
  let c = cv, quality = q;
  let blob = await toBlob(c, 'image/jpeg', quality);
  for (let i = 0; blob.size > limit && i < 10; i++) {
    if (quality > 0.62) quality -= 0.1;
    else {
      const n = h('canvas', { width: Math.round(c.width * 0.85), height: Math.round(c.height * 0.85) });
      n.getContext('2d').drawImage(c, 0, 0, n.width, n.height);
      c = n;
    }
    blob = await toBlob(c, 'image/jpeg', quality);
  }
  return { blob, w: c.width, h: c.height };
}

// thu nhỏ ảnh lớn để tiết kiệm dung lượng, GIF giữ nguyên
async function prepImage(file, max = 2200) {
  if (file.type === 'image/gif') {
    if (!CAPS.r2 && file.size > 1500 * 1024) throw new Error('Ảnh GIF quá lớn (tối đa ~1,5MB)');
    const u = URL.createObjectURL(file);
    const im = await loadImg(u);
    return { blob: file, w: im.naturalWidth, h: im.naturalHeight };
  }
  const u = URL.createObjectURL(file);
  try {
    const im = await loadImg(u);
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * k), hh = Math.round(im.naturalHeight * k);
    const cv = h('canvas', { width: w, height: hh });
    const c = cv.getContext('2d');
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, hh);
    c.drawImage(im, 0, 0, w, hh);
    return await fitCanvas(cv, 0.88);
  } finally {
    URL.revokeObjectURL(u);
  }
}

async function uploadBlob(blob) {
  const { key } = await api('upload', { method: 'POST', blob });
  return key;
}

// Ô chọn ảnh có xem trước + trang trí; chỉ tải lên khi bấm Lưu (commit)
function photoField({ key = null, label = 'ảnh', decorate = true, small = false } = {}) {
  let cur = key || null; // key đã có trên máy chủ
  let local = null; // {blob,url}
  const pv = h('div', { class: 'pv' + (small ? ' sm' : '') });
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const draw = h('button', { type: 'button', class: 'btn ghost sm', onclick: edit }, '✎ Trang trí & vẽ');
  const del = h('button', { type: 'button', class: 'btn ghost sm', onclick: () => ((cur = null), (local = null), refresh()) }, 'Bỏ ảnh');
  const pick = h('button', { type: 'button', class: 'btn ghost sm', onclick: () => file.click() }, '＋ Chọn ảnh');
  const make = h('button', { type: 'button', class: 'btn ghost sm', onclick: () => edit(true) }, '✎ Vẽ mới');
  const acts = h('div', { class: 'chips' }, pick, decorate ? draw : null, decorate ? make : null, del);
  function refresh() {
    const src = local ? local.url : cur ? mu(cur) : null;
    pv.replaceChildren(src ? h('img', { src, alt: '' }) : h('span', null, 'Chưa có ảnh'));
    draw.hidden = !src;
    del.hidden = !src;
  }
  function edit(blank) {
    const src = blank === true ? null : local ? local.url : cur ? mu(cur) : null;
    openEditor({ src, onDone: (blob) => setLocal(blob) });
  }
  function setLocal(blob) {
    if (local) URL.revokeObjectURL(local.url);
    local = { blob, url: URL.createObjectURL(blob) };
    refresh();
  }
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    try {
      setLocal((await prepImage(f)).blob);
    } catch (e) {
      toast(e.message);
    }
  });
  refresh();
  return {
    el: h('div', { class: 'pick' }, pv, acts, file),
    commit: async () => (local ? await uploadBlob(local.blob) : cur),
  };
}
