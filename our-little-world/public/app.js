'use strict';
/* Our Little World — logic các khu vực */

const S = { me: null, settings: {}, timeline: [], memories: [], letters: [], songs: [], special_days: [], bucket: [], little: [], surprises: [] };
const SECTIONS = [
  ['story', '02', 'Our Story', 'Hành trình của chúng ta'],
  ['memories', '03', 'Memories', 'Kho kỷ niệm'],
  ['letters', '04', 'Love Letters', 'Những lá thư'],
  ['playlist', '05', 'Our Playlist', 'Âm nhạc của chúng ta'],
  ['days', '06', 'Special Days', 'Những ngày đặc biệt'],
  ['bucket', '07', 'Our Bucket List', 'Những điều muốn làm cùng nhau'],
  ['little', '08', 'Little Things', 'Những điều nhỏ bé'],
  ['surprise', '09', 'Surprise', 'Những bất ngờ'],
];
const QUOTES = [
  'Bên nhau, ngày thường cũng hóa thành kỷ niệm.',
  'Hạnh phúc là những điều nhỏ bé mình giữ cho nhau.',
  'Giữa muôn vàn người, mình vẫn chọn nhau mỗi ngày.',
  'Có người để nhớ, để thương — là một điều dịu dàng.',
  'Mỗi khoảnh khắc cùng nhau là một trang sách đẹp.',
  'Nhà không phải là một nơi chốn, mà là một người.',
  'Cảm ơn vì đã đến, và ở lại.',
  'Mình cùng nhau viết tiếp câu chuyện này nhé.',
  'Every day with you is a soft little miracle.',
  'You are my favorite place to rest my heart.',
  'Hôm nay cũng yêu hơn hôm qua một chút.',
  'Chỉ cần có nhau, mọi con đường đều đẹp.',
  'Some people are worth every sunrise we share.',
  'Một cái nắm tay, cả thế giới bỗng nhỏ lại vừa đủ cho hai ta.',
];
const KIND_ICON = { birthday: '🎂', anniversary: '💞', valentine: '💌', other: '🎀' };
const KIND_NAME = { birthday: 'Sinh nhật', anniversary: 'Kỷ niệm', valentine: 'Valentine', other: 'Ngày đặc biệt' };
const LITTLE = { funny: ['😆', 'Câu nói hài hước'], nickname: ['🐰', 'Biệt danh'], moment: ['🌷', 'Khoảnh khắc đáng yêu'], silly: ['🤪', 'Chuyện ngớ ngẩn'], like: ['💗', 'Điều thích ở nhau'], secret: ['🤫', 'Chỉ hai mình hiểu'] };

const nm = (w) => (w === 'A' ? S.settings.name_a || 'Người A' : S.settings.name_b || 'Người B');
const partner = () => (S.me === 'A' ? 'B' : 'A');
const startDate = () => (S.settings.start_date ? parseYmd(S.settings.start_date) : null);

/* ───── khởi động ───── */
let tickTimer = null;
function onLoggedOut() {
  $('#app').hidden = true;
  showGate(false);
}

async function boot() {
  buildShell();
  let me;
  try {
    me = await api('me');
  } catch (e) {
    return showGate('msg', e.message);
  }
  if (!me.ready) return showGate('msg', 'Website chưa được cấu hình xong (thiếu mật mã hoặc kết nối database/R2). Xem README để thiết lập nhé.');
  if (!me.auth) return showGate(me.shared);
  enter();
}

function showGate(shared, msg) {
  const g = $('#gate');
  g.hidden = false;
  $('#gateForm').hidden = shared === 'msg';
  if (shared === 'msg') {
    g.append(h('div', { class: 'gate-card glass', id: 'gateMsg' }, h('h1', null, 'Our Little World'), h('p', { class: 'muted' }, msg)));
    return;
  }
  $('#whoPick').hidden = !shared;
  $('#pw').value = '';
  $('#gateErr').textContent = '';
  setTimeout(() => $('#pw').focus(), 100);
}

function setupGate() {
  let who = 'A';
  $$('#whoPick button').forEach((b) =>
    b.addEventListener('click', () => {
      who = b.dataset.who;
      $$('#whoPick button').forEach((x) => x.classList.toggle('on', x === b));
    }),
  );
  $('#gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#gateBtn');
    btn.disabled = true;
    $('#gateErr').textContent = '';
    try {
      await api('login', { method: 'POST', body: { password: $('#pw').value, who } });
      enter();
    } catch (err) {
      $('#gateErr').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

async function enter() {
  try {
    await load();
  } catch (e) {
    return toast(e.message);
  }
  $('#gate').hidden = true;
  $('#app').hidden = false;
  renderAll();
  initBgm();
  startTick();
  observeReveals();
  if (!S.settings.start_date && !sessionStorage.getItem('lw_setup')) {
    sessionStorage.setItem('lw_setup', '1');
    setTimeout(openSettings, 900);
  }
  checkAnniversary(true);
}

async function load() {
  Object.assign(S, await api('data'));
  CAPS.r2 = S.caps?.r2 !== false;
}

function buildShell() {
  const links = $('#links');
  links.append(h('a', { href: '#home' }, 'Home'));
  SECTIONS.forEach(([id, , t]) => links.append(h('a', { href: '#' + id }, t.replace('Our ', ''))));
  links.addEventListener('click', (e) => e.target.tagName === 'A' && links.classList.remove('open'));
  $('#menuBtn').addEventListener('click', () => links.classList.toggle('open'));
  document.addEventListener('pointerdown', (e) => !e.target.closest('#links,#menuBtn') && links.classList.remove('open'));
  const wrap = $('#sections');
  SECTIONS.forEach(([id, no, title, sub]) =>
    wrap.append(
      h('section', { class: 'sec', id },
        h('div', { class: 'wrap' },
          h('header', { class: 'sec-head reveal' }, h('span', { class: 'no' }, no), h('h2', null, title), h('p', null, sub)),
          h('div', { class: 'tools reveal', id: id + '-tools' }),
          h('div', { id: id + '-body' }),
        ),
      ),
    ),
  );
  $('#setBtn').addEventListener('click', openSettings);
  $('#setupBtn').addEventListener('click', openSettings);
  $('#bgmBtn').addEventListener('click', toggleBgm);
  setupGate();
  // làm nổi mục đang xem trên thanh điều hướng
  const spy = new IntersectionObserver(
    (en) => en.forEach((x) => x.isIntersecting && $$('#links a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + x.target.id))),
    { rootMargin: '-45% 0px -50% 0px' },
  );
  $$('main section').forEach((s) => spy.observe(s));
}

let revealIO;
function observeReveals() {
  revealIO ||= new IntersectionObserver((en) => en.forEach((x) => x.isIntersecting && (x.target.classList.add('in'), revealIO.unobserve(x.target))), { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
  $$('.reveal:not(.in)').forEach((el) => revealIO.observe(el));
}

function renderAll() {
  renderHero();
  renderStory();
  renderMemories();
  renderLetters();
  renderPlaylist();
  renderDays();
  renderBucket();
  renderLittle();
  renderSurprise();
  observeReveals();
}

/* thao tác dữ liệu chung */
const crud = {
  save: (t, id, data) => api(id ? `${t}/${id}` : t, { method: id ? 'PUT' : 'POST', body: data }),
  del: (t, id) => api(`${t}/${id}`, { method: 'DELETE' }),
};
async function refresh(fn) {
  await load();
  fn();
  observeReveals();
}
const rowActs = (onEdit, onDel) =>
  h('div', { class: 'acts' }, h('button', { class: 'link-btn', onclick: (e) => (e.stopPropagation(), onEdit()) }, 'Sửa'), h('button', { class: 'link-btn', onclick: (e) => (e.stopPropagation(), onDel()) }, 'Xoá'));
const addBtn = (label, fn) => h('button', { class: 'btn primary', onclick: fn }, label);
const empty = (msg) => h('p', { class: 'empty-note reveal' }, msg);

/* ═════ 01 · HOME ═════ */
let lastQuote = -1;
function renderHero() {
  const a = nm('A'), b = nm('B');
  $('#names').replaceChildren(a, h('em', null, '♡'), b);
  const sd = startDate();
  $('#since').textContent = sd ? `Bắt đầu yêu nhau từ ${fmtDate(S.settings.start_date)}` : 'Hãy thêm ngày bắt đầu yêu nhau để bắt đầu đếm nhé.';
  $('#setupBtn').hidden = !!(sd && S.settings.name_a && S.settings.name_b);
  const hp = $('#heroPhoto');
  hp.replaceChildren(
    S.settings.hero_key
      ? h('img', { src: mu(S.settings.hero_key), alt: `${a} và ${b}` })
      : h('div', { class: 'empty', onclick: openSettings }, h('b', null, '♡'), 'Thêm ảnh của hai bạn'),
  );
  // câu nói đổi theo mỗi lần truy cập (trộn thêm những điều mình đã viết)
  if (lastQuote < 0) {
    const pool = [...QUOTES, ...S.little.filter((l) => l.kind === 'like' || l.kind === 'moment').map((l) => l.body.slice(0, 140))];
    let i, tries = 0;
    const prev = +(localStorage.getItem('lw_q') || -1);
    do i = Math.floor(Math.random() * pool.length);
    while (i === prev && pool.length > 1 && ++tries < 8);
    try { localStorage.setItem('lw_q', i); } catch {}
    lastQuote = i;
    $('#quote').replaceChildren(h('span', null, `“${pool[i]}”`));
  }
  renderRemind();
  tick();
}

function renderRemind() {
  const soon = upcoming().filter((e) => e.days <= 14).slice(0, 3);
  $('#remind').replaceChildren(...soon.map((e) => h('span', null, `${e.icon} ${e.days === 0 ? 'Hôm nay' : 'Còn ' + e.days + ' ngày'}: ${e.title}`)));
}

function ymdDiff(a, b) {
  let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
  if (d < 0) { m--; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  return [y, m, d];
}

function startTick() {
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 1000);
}
function tick() {
  const sd = startDate();
  const now = new Date();
  if (sd && sd <= now) {
    const ms = now - sd;
    $('#cd').textContent = Math.floor(ms / 864e5).toLocaleString('vi-VN');
    $('#ch').textContent = Math.floor(ms / 36e5) % 24;
    $('#cm').textContent = Math.floor(ms / 6e4) % 60;
    $('#cs').textContent = Math.floor(ms / 1e3) % 60;
    const [y, m, d] = ymdDiff(sd, now);
    $('#ytd').textContent = [y && `${y} năm`, m && `${m} tháng`, `${d} ngày`].filter(Boolean).join(' ') + ' bên nhau';
  } else {
    ['cd', 'ch', 'cm', 'cs'].forEach((i) => ($('#' + i).textContent = '0'));
    $('#ytd').textContent = '';
  }
  const nx = $('#nextCd');
  if (nx && nx.dataset.t) {
    const left = Math.max(0, +nx.dataset.t - now);
    const v = [Math.floor(left / 864e5), Math.floor(left / 36e5) % 24, Math.floor(left / 6e4) % 60, Math.floor(left / 1e3) % 60];
    $$('b', nx).forEach((b, i) => (b.textContent = v[i]));
  }
}

/* ═════ 02 · OUR STORY ═════ */
const MILESTONES = ['Ngày đầu tiên gặp nhau', 'Ngày bắt đầu trò chuyện', 'Buổi hẹn đầu tiên', 'Ngày chính thức yêu nhau', 'Chuyến đi đáng nhớ', 'Một sự kiện đặc biệt'];
function openStoryForm(row) {
  formModal({
    title: row ? 'Sửa cột mốc' : 'Thêm cột mốc',
    values: row || { date: S.settings.start_date || todayStr() },
    fields: [
      { name: 'title', label: 'Tiêu đề', required: true, list: MILESTONES, ph: 'Ví dụ: Buổi hẹn đầu tiên' },
      { name: 'date', label: 'Ngày', type: 'date', required: true },
      { name: 'story', label: 'Câu chuyện', type: 'textarea', rows: 5, ph: 'Kể lại khoảnh khắc ấy…' },
      { name: 'photo_key', label: 'Ảnh', type: 'photo' },
    ],
    onSubmit: async (v) => { await crud.save('timeline', row?.id, v); await refresh(renderStory); },
  });
}
function renderStory() {
  const t = $('#story-tools'), b = $('#story-body');
  t.replaceChildren(addBtn('＋ Thêm cột mốc', () => openStoryForm()));
  if (!S.timeline.length) return b.replaceChildren(empty('Câu chuyện của hai bạn bắt đầu từ đây… hãy thêm cột mốc đầu tiên nhé.'));
  b.replaceChildren(
    h('div', { class: 'tl' },
      S.timeline.map((r) =>
        h('article', { class: 'tl-item reveal' },
          h('div', { class: 'tl-card glass' },
            r.photo_key ? h('div', { class: 'ph', onclick: () => lightbox([{ src: mu(r.photo_key), caption: r.title, date: r.date }], 0) }, h('img', { src: mu(r.photo_key), alt: r.title, loading: 'lazy' })) : null,
            h('div', { class: 'd' }, fmtDate(r.date)),
            h('h3', null, r.title),
            r.story ? h('p', { class: 's' }, r.story) : null,
            rowActs(() => openStoryForm(r), async () => (await confirmBox('Xoá cột mốc này?')) && (await crud.del('timeline', r.id), refresh(renderStory))),
          ),
        ),
      ),
    ),
  );
}

/* ═════ 03 · MEMORIES ═════ */
const MEM_TAGS = ['Hẹn hò', 'Du lịch', 'Sinh nhật', 'Ăn uống', 'Hằng ngày', 'Sự kiện'];
const mf = { q: '', month: '', tag: '', day: '' };
function renderMemories() {
  const t = $('#memories-tools');
  t.replaceChildren(addBtn('＋ Thêm kỷ niệm', () => openMemoryForm()), h('button', { class: 'btn ghost', onclick: () => openEditor({ onDone: (blob) => openMemoryForm([{ blob, type: 'image' }]) }) }, '✏️ Vẽ một bức tranh'));
  const b = $('#memories-body');
  if (!S.memories.length) return b.replaceChildren(empty('Chưa có kỷ niệm nào. Tải lên tấm ảnh đầu tiên của hai bạn nhé.'));
  const months = [...new Set(S.memories.map((m) => m.date.slice(0, 7)))];
  const tags = [...new Set(S.memories.map((m) => m.tag).filter(Boolean))];
  const list = S.memories.filter((m) => (!mf.day || m.date === mf.day) && (!mf.month || m.date.startsWith(mf.month)) && (!mf.tag || m.tag === mf.tag) && (!mf.q || (m.caption || '').toLowerCase().includes(mf.q.toLowerCase())));
  const rerender = () => renderMemories();
  const day = h('input', { type: 'date', value: mf.day, 'aria-label': 'Tìm theo ngày', onchange: (e) => ((mf.day = e.target.value), rerender()) });
  const mon = h('select', { 'aria-label': 'Tháng', onchange: (e) => ((mf.month = e.target.value), rerender()) }, h('option', { value: '' }, 'Mọi tháng'), months.map((m) => h('option', { value: m, selected: m === mf.month }, `Tháng ${+m.slice(5)}, ${m.slice(0, 4)}`)));
  const q = h('input', { type: 'search', placeholder: 'Tìm theo chú thích…', value: mf.q, 'aria-label': 'Tìm chú thích' });
  let tm;
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { mf.q = q.value; rerender(); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 350); });
  const chip = (val, lab) => h('button', { class: 'chip' + (mf.tag === val ? ' on' : ''), onclick: () => ((mf.tag = val), rerender()) }, lab);
  const hasFilter = mf.q || mf.month || mf.tag || mf.day;
  const grid = [];
  const groups = {};
  list.forEach((m) => (groups[m.date.slice(0, 7)] ||= []).push(m));
  Object.keys(groups).forEach((k) => {
    grid.push(h('div', { class: 'mhead reveal' }, `Tháng ${+k.slice(5)}, ${k.slice(0, 4)}`, h('small', null, `${groups[k].length} kỷ niệm`)));
    grid.push(
      h('div', { class: 'pol-grid' }, groups[k].map((m) => {
        const i = list.indexOf(m);
        const media = m.media_type === 'video' ? h('video', { src: mu(m.media_key) + '#t=0.1', muted: true, playsinline: true, preload: 'metadata' }) : h('img', { src: mu(m.media_key), alt: m.caption || 'Kỷ niệm', loading: 'lazy' });
        return h('button', { class: 'pol reveal', style: { '--r': seedRot(m.id) + 'deg' }, onclick: () => lightbox(list.map(memItem), i) },
          h('div', { class: 'im', style: m.w && m.h ? { aspectRatio: `${m.w}/${m.h}` } : {} }, media, m.media_type === 'video' ? h('span', { class: 'play' }, '▶') : null),
          h('div', { class: 'cap' }, m.caption || ''),
          h('div', { class: 'meta' }, h('span', null, fmtShort(m.date)), m.tag ? h('span', null, m.tag) : null));
      })),
    );
  });
  b.replaceChildren(
    h('div', { class: 'filters' }, h('div', { class: 'row' }, day, mon, q), tags.length ? h('div', { class: 'chips' }, chip('', 'Tất cả'), tags.map((x) => chip(x, x))) : null,
      hasFilter ? h('button', { class: 'link-btn', onclick: () => (Object.assign(mf, { q: '', month: '', tag: '', day: '' }), rerender()) }, 'Xoá bộ lọc') : null),
    list.length ? grid : empty('Không có kỷ niệm nào khớp với bộ lọc.'),
  );
}
const memItem = (m) => ({ id: m.id, src: mu(m.media_key), type: m.media_type, caption: m.caption, date: m.date, tag: m.tag, mem: m });

function openMemoryForm(preset) {
  const files = []; // {blob,type,w,h,url}
  const thumbs = h('div', { class: 'thumbs' });
  const input = h('input', { type: 'file', accept: CAPS.r2 ? 'image/*,video/mp4,video/webm,video/quicktime' : 'image/*', multiple: true, hidden: true });
  const paint = () => thumbs.replaceChildren(...files.map((f, i) =>
    h('div', { class: 'thumb' },
      f.type === 'video' ? h('video', { src: f.url, muted: true, playsinline: true }) : h('img', { src: f.url, alt: '' }),
      h('button', { type: 'button', class: 'x', 'aria-label': 'Bỏ', onclick: () => (files.splice(i, 1), paint()) }, '✕'),
      f.type === 'image' ? h('button', { type: 'button', class: 'dec', onclick: () => openEditor({ src: f.url, onDone: async (blob, w, hh) => (Object.assign(f, { blob, w, h: hh, url: URL.createObjectURL(blob) }), paint()) }) }, '🎨 Trang trí') : null)));
  const addFiles = async (list) => {
    for (const f of list) {
      try {
        if (f.type.startsWith('video/')) {
          if (!CAPS.r2) { toast('Video cần bật R2 — hiện chỉ lưu được ảnh'); continue; }
          if (f.size > 60 * 1024 * 1024) { toast(`“${f.name}” quá lớn (tối đa 60MB)`); continue; }
          files.push({ blob: f, type: 'video', url: URL.createObjectURL(f) });
        } else if (f.type.startsWith('image/')) {
          const p = await prepImage(f);
          files.push({ blob: p.blob, type: 'image', w: p.w, h: p.h, url: URL.createObjectURL(p.blob) });
        }
      } catch (e) { toast(e.message); }
    }
    paint();
  };
  input.addEventListener('change', async () => { const l = [...input.files]; input.value = ''; await addFiles(l); });
  const pickBtn = h('button', { type: 'button', class: 'btn ghost', onclick: () => input.click() }, CAPS.r2 ? '📷 Chọn ảnh / video' : '📷 Chọn ảnh');
  const m = formModal({
    title: 'Thêm kỷ niệm',
    values: { date: todayStr() },
    fields: [
      { name: 'date', label: 'Ngày xảy ra', type: 'date', required: true },
      { name: 'caption', label: 'Chú thích', type: 'textarea', rows: 2, ph: 'Viết vài dòng cho khoảnh khắc này…' },
      { name: 'tag', label: 'Phân loại / sự kiện', list: [...new Set([...MEM_TAGS, ...S.memories.map((x) => x.tag).filter(Boolean)])], ph: 'Hẹn hò, Du lịch, Sinh nhật…' },
    ],
    onSubmit: async (v) => {
      if (!files.length) throw new Error('Hãy chọn ít nhất một ảnh hoặc video nhé');
      const note = toast('Đang tải lên…', 60000);
      try {
        for (let i = 0; i < files.length; i++) {
          note.textContent = `Đang tải lên ${i + 1}/${files.length}…`;
          const f = files[i];
          const key = await uploadBlob(f.blob);
          await crud.save('memories', null, { ...v, media_key: key, media_type: f.type, w: f.w || null, h: f.h || null });
        }
      } finally { note.remove(); }
      await refresh(renderMemories);
      toast('Đã lưu kỷ niệm 💗');
    },
    extra: null,
  });
  const form = $('form', m.el);
  form.prepend(h('div', { class: 'fld' }, h('span', { class: 'lbl' }, 'Ảnh & video'), pickBtn, input, thumbs));
  if (preset) addFiles([]).then(async () => { for (const p of preset) files.push({ ...p, url: URL.createObjectURL(p.blob) }); paint(); });
}

function openMemoryEdit(mem, after) {
  const m = formModal({
    title: 'Sửa kỷ niệm',
    values: mem,
    fields: [
      { name: 'date', label: 'Ngày', type: 'date', required: true },
      { name: 'caption', label: 'Chú thích', type: 'textarea', rows: 3 },
      { name: 'tag', label: 'Phân loại', list: [...new Set([...MEM_TAGS, ...S.memories.map((x) => x.tag).filter(Boolean)])] },
    ],
    onSubmit: async (v) => { await crud.save('memories', mem.id, v); await refresh(renderMemories); after && after(); },
    extra: mem.media_type === 'image' ? h('button', { type: 'button', class: 'btn ghost', onclick: () => openEditor({ src: mu(mem.media_key), onDone: async (blob, w, hh) => {
      try {
        const key = await uploadBlob(blob);
        await crud.save('memories', mem.id, { media_key: key, w, h: hh, media_type: 'image' });
        await refresh(renderMemories); m.close(); after && after(); toast('Đã cập nhật ảnh');
      } catch (e) { toast(e.message); }
    } }) }, '🎨 Trang trí lại ảnh') : null,
  });
}

/* ───── lightbox ───── */
function lightbox(items, i) {
  const lb = h('div', { class: 'lb', role: 'dialog', 'aria-modal': 'true' });
  const stage = h('div', { class: 'stage' });
  const top = h('div', { class: 'top' });
  const bot = h('div', { class: 'bot' });
  const prev = h('button', { class: 'nv l', 'aria-label': 'Trước', onclick: () => go(-1) }, '‹');
  const next = h('button', { class: 'nv r', 'aria-label': 'Sau', onclick: () => go(1) }, '›');
  lb.append(top, stage, bot);
  const close = () => { document.removeEventListener('keydown', key); lb.classList.remove('in'); setTimeout(() => { lb.remove(); if (!$('.overlay')) document.body.classList.remove('lock'); }, 350); };
  const key = (e) => (e.key === 'Escape' ? close() : e.key === 'ArrowLeft' ? go(-1) : e.key === 'ArrowRight' ? go(1) : 0);
  function go(d) { i = (i + d + items.length) % items.length; show(); }
  function show() {
    const it = items[i];
    stage.replaceChildren(it.type === 'video' ? h('video', { src: it.src, controls: true, playsinline: true, autoplay: true }) : h('img', { src: it.src, alt: it.caption || '' }), items.length > 1 ? prev : null, items.length > 1 ? next : null);
    top.replaceChildren(h('span', null, `${it.date ? fmtDate(it.date) : ''}${it.tag ? ' · ' + it.tag : ''}${items.length > 1 ? `  (${i + 1}/${items.length})` : ''}`), h('button', { class: 'icon-btn', 'aria-label': 'Đóng', onclick: close }, '✕'));
    bot.replaceChildren(
      h('div', { class: 'cap' }, it.caption || ''),
      h('div', { class: 'chips' },
        h('a', { class: 'btn ghost sm', href: it.src, download: '' }, '⬇ Tải về'),
        it.mem ? h('button', { class: 'btn ghost sm', onclick: () => { close(); openMemoryEdit(it.mem); } }, 'Sửa') : null,
        it.mem ? h('button', { class: 'btn ghost sm danger', onclick: async () => { if (await confirmBox('Xoá kỷ niệm này?')) { await crud.del('memories', it.mem.id); close(); refresh(renderMemories); } } }, 'Xoá') : null),
    );
  }
  document.addEventListener('keydown', key);
  document.body.append(lb);
  document.body.classList.add('lock');
  show();
  requestAnimationFrame(() => lb.classList.add('in'));
  let sx = null;
  stage.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  stage.addEventListener('touchend', (e) => { if (sx != null && items.length > 1) { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); } sx = null; });
}

/* ═════ 04 · LOVE LETTERS ═════ */
let letterTab = 'inbox';
const isLocked = (r) => !!r.locked;
function openLetterForm(row) {
  formModal({
    title: row ? 'Sửa thư' : 'Viết thư',
    values: row || {},
    submit: row ? 'Lưu thư' : 'Gửi thư 💌',
    fields: [
      { name: 'title', label: 'Tiêu đề', ph: 'Gửi người thương…' },
      { name: 'body', label: 'Nội dung', type: 'textarea', rows: 9, required: true, ph: 'Những điều muốn nói…' },
      { name: 'is_private', label: 'Thư riêng tư — chỉ mình mình đọc được (những lời chưa từng nói)', type: 'check' },
      { name: 'unlock_at', label: 'Gửi bất ngờ: thư chỉ mở được từ ngày', type: 'date', iso: true, min: todayStr(), hint: 'Để trống nếu muốn người ấy đọc ngay.' },
    ],
    onSubmit: async (v) => { await crud.save('letters', row?.id, v); await refresh(renderLetters); toast(v.is_private ? 'Đã cất thư vào ngăn riêng 🤍' : 'Thư đã được gửi 💌'); },
  });
}
function renderLetters() {
  $('#letters-tools').replaceChildren(addBtn('✉ Viết thư mới', () => openLetterForm()));
  const mine = (r) => r.from_who === S.me;
  const tabs = {
    inbox: ['Thư nhận được', S.letters.filter((r) => !mine(r))],
    sent: ['Thư đã gửi', S.letters.filter((r) => mine(r) && !r.is_private)],
    private: ['Riêng tư', S.letters.filter((r) => mine(r) && r.is_private)],
  };
  const unread = tabs.inbox[1].filter((r) => !r.opened_at && !isLocked(r)).length;
  const b = $('#letters-body');
  const list = tabs[letterTab][1];
  b.replaceChildren(
    h('div', { class: 'filters' }, h('div', { class: 'chips' }, Object.entries(tabs).map(([k, [lab, arr]]) => h('button', { class: 'chip' + (letterTab === k ? ' on' : ''), onclick: () => ((letterTab = k), renderLetters()) }, `${lab} (${arr.length})${k === 'inbox' && unread ? ' ·' + unread + ' mới' : ''}`)))),
    list.length
      ? h('div', { class: 'env-grid' }, list.map((r) => {
          const lock = isLocked(r);
          const fresh = !mine(r) && !r.opened_at && !lock;
          return h('button', { class: 'env reveal' + (lock ? ' lockd' : ''), onclick: () => openLetter(r) },
            fresh ? h('span', { class: 'badge' }, 'mới') : null,
            h('div', { class: 'body' }, h('span', { class: 'seal' }, lock ? '🔒' : '♥'),
              h('h4', null, r.title || (lock ? 'Một lá thư bất ngờ' : 'Không đề')),
              h('div', { class: 'sub' }, lock ? `Mở được từ ${fmtDate(dayFromIso(r.unlock_at))}` : `${nm(r.from_who)} → ${nm(r.to_who)} · ${fmtShort(r.created_at.slice(0, 10))}`)));
        }))
      : empty(letterTab === 'inbox' ? 'Chưa có thư nào gửi đến. Có thể người ấy đang viết đấy…' : letterTab === 'sent' ? 'Bạn chưa gửi thư nào.' : 'Ngăn riêng tư đang trống — nơi để cất những lời chưa từng nói.'),
  );
}
async function openLetter(r) {
  if (isLocked(r)) return toast(`Lá thư này sẽ mở vào ${fmtDate(dayFromIso(r.unlock_at))} 💌`);
  const own = r.from_who === S.me;
  const anim = h('div', { class: 'env-anim' }, h('div', { class: 'back' }), h('div', { class: 'card' }), h('div', { class: 'flap' }), h('div', { class: 'front' }));
  const wrap = h('div', { class: 'letter-modal' }, anim);
  const m = modal(own ? (r.is_private ? 'Thư riêng tư' : 'Thư bạn đã gửi') : 'Bạn có một lá thư', wrap);
  setTimeout(() => anim.classList.add('open'), 250);
  setTimeout(() => {
    anim.style.height = '110px';
    wrap.append(
      h('div', { class: 'paper' },
        r.title ? h('h3', null, r.title) : null,
        h('div', { class: 'tx' }, r.body),
        h('div', { class: 'sig' }, `— ${nm(r.from_who)}`),
      ),
      own ? rowActs(() => (m.close(), openLetterForm(r)), async () => { if (await confirmBox('Xoá lá thư này?')) { await crud.del('letters', r.id); m.close(); refresh(renderLetters); } }) : null,
    );
  }, 1100);
  if (!own && !r.opened_at) { try { await api(`letters/${r.id}/open`, { method: 'POST' }); r.opened_at = new Date().toISOString(); renderLetters(); } catch {} }
}

/* ═════ 05 · PLAYLIST ═════ */
function embedUrl(u) {
  if (!u) return null;
  try {
    const x = new URL(u);
    if (x.hostname.includes('spotify.com')) { const p = x.pathname.replace(/^\/intl-[a-z-]+/, ''); if (/^\/(track|album|playlist|episode)\//.test(p)) return { src: 'https://open.spotify.com/embed' + p, yt: false }; }
    let id = null;
    if (x.hostname === 'youtu.be') id = x.pathname.slice(1);
    else if (x.hostname.endsWith('youtube.com')) id = x.searchParams.get('v') || (/^\/(embed|shorts)\//.test(x.pathname) ? x.pathname.split('/')[2] : null);
    if (id && /^[\w-]{6,15}$/.test(id)) return { src: `https://www.youtube-nocookie.com/embed/${id}`, yt: true };
  } catch {}
  return null;
}
function openSongForm(row) {
  formModal({
    title: row ? 'Sửa bài hát' : 'Thêm bài hát',
    values: row || {},
    fields: [
      { name: 'title', label: 'Tên bài hát', required: true },
      { name: 'artist', label: 'Ca sĩ' },
      { name: 'url', label: 'Link Spotify hoặc YouTube', type: 'url', ph: 'https://…' },
      { name: 'reason', label: 'Vì sao bài hát này có ý nghĩa?', type: 'textarea', rows: 3 },
      { name: 'memory', label: 'Gắn với kỷ niệm nào?', ph: 'Ví dụ: Lần đầu đi chơi cùng nhau' },
    ],
    onSubmit: async (v) => { await crud.save('songs', row?.id, v); await refresh(renderPlaylist); },
  });
}
function renderPlaylist() {
  $('#playlist-tools').replaceChildren(addBtn('♪ Thêm bài hát', () => openSongForm()));
  const hasBgm = S.settings.bgm_key || S.settings.bgm_url;
  const b = $('#playlist-body');
  b.replaceChildren(
    h('div', { class: 'bgm-card glass reveal' }, h('div', null, h('b', null, 'Nhạc nền của website'), h('div', { class: 'muted', style: { fontSize: '.88rem' } }, hasBgm ? 'Đã có nhạc nền — dùng nút ♪ trên thanh menu để bật/tắt.' : 'Chưa có nhạc nền. Tải một bản nhạc lên hoặc dán link.')), h('button', { class: 'btn ghost sm', onclick: openBgmForm }, hasBgm ? 'Đổi nhạc nền' : 'Chọn nhạc nền')),
    S.songs.length
      ? h('div', { class: 'songs' }, S.songs.map((s) => {
          const em = embedUrl(s.url);
          const card = h('article', { class: 'song glass reveal' });
          const slot = h('div');
          let open = false;
          const btn = em ? h('button', { class: 'btn ghost sm', onclick: () => { open = !open; card.classList.toggle('play', open); btn.textContent = open ? '⏸ Đóng trình phát' : '▶ Nghe tại đây'; slot.replaceChildren(open ? h('iframe', { src: em.src, class: em.yt ? 'yt' : '', allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true, loading: 'lazy', title: s.title }) : ''); } }, '▶ Nghe tại đây') : null;
          card.append(h('div', { class: 'disc' }), h('div', null,
            h('h4', null, s.title), s.artist ? h('div', { class: 'ar' }, s.artist) : null,
            s.reason ? h('p', { class: 'why' }, `“${s.reason}”`) : null,
            s.memory ? h('p', { class: 'mem' }, `💭 ${s.memory}`) : null,
            h('div', { class: 'acts' }, btn, s.url ? h('a', { class: 'btn ghost sm', href: s.url, target: '_blank', rel: 'noopener noreferrer' }, '↗ Mở link') : null, rowActs(() => openSongForm(s), async () => (await confirmBox('Xoá bài hát này?')) && (await crud.del('songs', s.id), refresh(renderPlaylist)))),
            slot));
          return card;
        }))
      : empty('Chưa có bài hát nào. Thêm bài hát đầu tiên của hai bạn nhé.'),
  );
}
function openBgmForm() {
  let file = null;
  const input = h('input', { type: 'file', accept: 'audio/*' });
  input.addEventListener('change', () => (file = input.files[0] || null));
  const m = formModal({
    title: 'Nhạc nền',
    values: { bgm_url: S.settings.bgm_url || '' },
    fields: [{ name: 'bgm_url', label: 'Dán link file nhạc (.mp3 trực tiếp)', type: 'url', ph: 'https://…/bai-hat.mp3' }],
    onSubmit: async (v) => {
      const body = {};
      if (file) {
        if (file.size > 25 * 1024 * 1024) throw new Error('File nhạc tối đa 25MB');
        body.bgm_key = await uploadBlob(file);
        body.bgm_url = '';
      } else body.bgm_url = v.bgm_url;
      await api('settings', { method: 'PUT', body });
      await refresh(() => { renderPlaylist(); }); initBgm(true);
    },
    extra: S.settings.bgm_key || S.settings.bgm_url ? h('button', { type: 'button', class: 'btn ghost danger', onclick: async () => { await api('settings', { method: 'PUT', body: { bgm_key: '', bgm_url: '' } }); await refresh(renderPlaylist); initBgm(true); m.close(); } }, 'Tắt nhạc nền') : null,
  });
  if (CAPS.r2) $('form', m.el).prepend(h('div', { class: 'fld' }, h('span', { class: 'lbl' }, 'Tải nhạc từ máy (tối đa 25MB)'), input));
}
function bgmSrc() { return S.settings.bgm_key ? mu(S.settings.bgm_key) : S.settings.bgm_url || ''; }
function initBgm(force) {
  const a = $('#bgm');
  const src = bgmSrc();
  if (force || a.dataset.src !== src) { a.pause(); a.dataset.src = src; if (src) a.src = src; else a.removeAttribute('src'); }
  $('#bgmBtn').classList.remove('playing');
  $('#bgmBtn').hidden = !src;
  if (!a.dataset.bound) {
    a.dataset.bound = '1';
    a.addEventListener('play', () => $('#bgmBtn').classList.add('playing'));
    a.addEventListener('pause', () => $('#bgmBtn').classList.remove('playing'));
    // trình duyệt chặn tự phát: thử lại ở lần chạm đầu tiên nếu lần trước đang bật
    document.addEventListener('pointerdown', () => { if (bgmSrc() && localStorage.getItem('lw_bgm') === '1' && a.paused && !a.dataset.user) a.play().catch(() => {}); }, { once: true });
  }
}
function toggleBgm() {
  const a = $('#bgm');
  a.dataset.user = '1';
  if (!bgmSrc()) return openBgmForm();
  if (a.paused) a.play().then(() => { try { localStorage.setItem('lw_bgm', '1'); } catch {} }).catch(() => toast('Không phát được nhạc này, thử nguồn khác nhé.'));
  else { a.pause(); try { localStorage.setItem('lw_bgm', '0'); } catch {} }
}

/* ═════ 06 · SPECIAL DAYS ═════ */
const DAY_SEEDS = [['Sinh nhật ' , 'birthday'], ['Valentine', 'valentine'], ['Kỷ niệm yêu nhau', 'anniversary']];
function nextOccurrence(dateStr, yearly) {
  const d = parseYmd(dateStr), t0 = startOfToday();
  if (!yearly) return d;
  let n = new Date(t0.getFullYear(), d.getMonth(), d.getDate());
  if (n < t0) n = new Date(t0.getFullYear() + 1, d.getMonth(), d.getDate());
  return n;
}
function upcoming() {
  const t0 = startOfToday();
  const out = [];
  S.special_days.forEach((r) => {
    const n = nextOccurrence(r.date, r.yearly);
    const days = Math.round((n - t0) / 864e5);
    if (days >= 0) out.push({ title: r.title, date: n, days, icon: KIND_ICON[r.kind] || '🎀', row: r, kind: r.kind, note: r.note });
  });
  const sd = startDate();
  if (sd) {
    const n = nextOccurrence(S.settings.start_date, true);
    if (n.getFullYear() > sd.getFullYear()) out.push({ title: `Kỷ niệm ${n.getFullYear() - sd.getFullYear()} năm yêu nhau`, date: n, days: Math.round((n - t0) / 864e5), icon: '💞', auto: true, kind: 'anniversary' });
    const done = Math.floor((t0 - sd) / 864e5);
    const ms = [100, 200, 300, 365, 400, 500, 600, 700, 800, 900, 1000, 1111, 1200, 1500, 2000, 2500, 3000, 3650, 5000].find((x) => x > done);
    if (ms) { const n2 = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate() + ms); out.push({ title: `Ngày thứ ${ms.toLocaleString('vi-VN')} bên nhau`, date: n2, days: ms - done, icon: '🎀', auto: true, kind: 'other' }); }
  }
  return out.sort((a, b) => a.date - b.date);
}
function openDayForm(row, preset) {
  formModal({
    title: row ? 'Sửa ngày đặc biệt' : 'Thêm ngày đặc biệt',
    values: row || preset || { kind: 'birthday', yearly: true },
    fields: [
      { name: 'title', label: 'Tên', required: true, ph: 'Ví dụ: Sinh nhật ' + nm('A') },
      { name: 'kind', label: 'Loại', type: 'select', options: Object.entries(KIND_NAME) },
      { name: 'date', label: 'Ngày', type: 'date', required: true },
      { name: 'yearly', label: 'Lặp lại hằng năm', type: 'check', def: true },
      { name: 'note', label: 'Ghi chú', type: 'textarea', rows: 2 },
    ],
    onSubmit: async (v) => { await crud.save('special_days', row?.id, v); await refresh(() => (renderDays(), renderHero())); },
  });
}
function renderDays() {
  $('#days-tools').replaceChildren(addBtn('＋ Thêm ngày đặc biệt', () => openDayForm()),
    ...DAY_SEEDS.filter(([t]) => !S.special_days.some((d) => d.title.startsWith(t.trim()))).map(([t, k]) => h('button', { class: 'chip', onclick: () => openDayForm(null, { title: t.trim() === 'Sinh nhật' ? 'Sinh nhật ' : t, kind: k, yearly: true, date: k === 'valentine' ? `${new Date().getFullYear()}-02-14` : todayStr() }) }, '＋ ' + t.trim())));
  const up = upcoming();
  const b = $('#days-body');
  const nx = up[0];
  const rows = [...up];
  S.special_days.forEach((r) => { if (!rows.some((x) => x.row === r)) rows.push({ title: r.title, date: parseYmd(r.date), days: -1, icon: KIND_ICON[r.kind] || '🎀', row: r, kind: r.kind, note: r.note }); });
  if (!rows.length) return b.replaceChildren(empty('Thêm sinh nhật, ngày kỷ niệm hay Valentine để website nhắc bạn nhé.'));
  b.replaceChildren(
    nx ? h('div', { class: 'next glass reveal' }, h('div', { class: 'lab' }, 'Sắp tới'), h('h3', null, `${nx.icon} ${nx.title}`), h('div', { class: 'muted', style: { marginBottom: '14px' } }, fmtDate(ymd(nx.date))),
      nx.days === 0 ? h('div', { class: 'gift-open', style: { fontSize: '3rem' } }, '🎉') : h('div', { class: 'cd', id: 'nextCd', 'data-t': nx.date.getTime() }, [['', 'ngày'], ['', 'giờ'], ['', 'phút'], ['', 'giây']].map(([, l]) => h('div', null, h('b', null, '0'), h('span', null, l))))) : null,
    h('div', { class: 'days' }, rows.map((e) => h('article', { class: 'day glass reveal' },
      h('div', { class: 'ic' }, e.icon),
      h('h4', null, e.title, e.row?.yearly ? h('span', { class: 'tag' }, 'hằng năm') : null),
      h('div', { class: 'dt' }, e.days < 0 ? fmtDate(e.row.date) + ' · đã qua' : fmtDate(ymd(e.date))),
      e.days >= 0 ? h('div', { class: 'left' }, e.days === 0 ? 'Hôm nay rồi! 🎉' : `Còn ${e.days} ngày`) : null,
      e.note ? h('p', { class: 'nt' }, e.note) : null,
      e.row ? rowActs(() => openDayForm(e.row), async () => (await confirmBox('Xoá ngày này?')) && (await crud.del('special_days', e.row.id), refresh(() => (renderDays(), renderHero())))) : h('div', { class: 'dt' }, '✦ tự động tính')))),
  );
  tick();
}

/* ═════ 07 · BUCKET LIST ═════ */
const BUCKET_SEEDS = ['Cùng đi du lịch', 'Xem bình minh cùng nhau', 'Nấu ăn cùng nhau', 'Chụp ảnh tại một địa điểm thật đẹp', 'Xem một bộ phim cùng nhau', 'Hoàn thành một mục tiêu chung'];
function openBucketForm(row) {
  formModal({
    title: row ? 'Sửa điều ước' : 'Thêm điều muốn làm',
    values: row || {},
    fields: [{ name: 'title', label: 'Điều muốn làm cùng nhau', required: true }, { name: 'note', label: 'Ghi chú', type: 'textarea', rows: 2 }],
    onSubmit: async (v) => { await crud.save('bucket', row?.id, v); await refresh(renderBucket); },
  });
}
function renderBucket() {
  $('#bucket-tools').replaceChildren(addBtn('＋ Thêm điều ước', () => openBucketForm()),
    S.bucket.length ? null : h('button', { class: 'btn ghost', onclick: async () => { for (const t of BUCKET_SEEDS) await crud.save('bucket', null, { title: t }); refresh(renderBucket); } }, '✨ Dùng gợi ý có sẵn'));
  const done = S.bucket.filter((x) => x.done).length;
  const b = $('#bucket-body');
  if (!S.bucket.length) return b.replaceChildren(empty('Hãy viết ra những điều hai bạn muốn làm cùng nhau.'));
  b.replaceChildren(
    h('div', { class: 'prog reveal' }, h('span', { class: 'muted' }, `${done}/${S.bucket.length} điều đã cùng nhau thực hiện`), h('div', { class: 'bar' }, h('i', { style: { width: `${(done / S.bucket.length) * 100}%` } }))),
    h('div', { class: 'bucket' }, S.bucket.map((r) => h('article', { class: 'bk glass reveal' + (r.done ? ' done' : '') },
      h('button', { class: 'ck', 'aria-label': r.done ? 'Bỏ đánh dấu' : 'Đánh dấu đã làm', 'aria-pressed': r.done ? 'true' : 'false', onclick: async () => { await crud.save('bucket', r.id, { done: !r.done, done_at: r.done ? null : todayStr() }); await refresh(renderBucket); if (!r.done) toast('Tuyệt quá, thêm một điều ước thành hiện thực 🌸'); } }, '✓'),
      h('div', null, h('h4', null, r.title), r.note ? h('p', { class: 'nt' }, r.note) : null, r.done && r.done_at ? h('div', { class: 'dn' }, `Hoàn thành ngày ${fmtDate(r.done_at)}`) : null,
        rowActs(() => openBucketForm(r), async () => (await confirmBox('Xoá điều ước này?')) && (await crud.del('bucket', r.id), refresh(renderBucket))))))),
  );
}

/* ═════ 08 · LITTLE THINGS ═════ */
let littleTab = '';
function openLittleForm(row) {
  formModal({
    title: row ? 'Sửa' : 'Thêm điều nhỏ bé',
    values: row || { kind: littleTab || 'moment' },
    fields: [
      { name: 'kind', label: 'Loại', type: 'select', options: Object.entries(LITTLE).map(([k, [i, n]]) => [k, `${i} ${n}`]) },
      { name: 'body', label: 'Nội dung', type: 'textarea', rows: 4, required: true, ph: 'Viết thật tự nhiên nhé…' },
    ],
    onSubmit: async (v) => { await crud.save('little', row?.id, v); await refresh(() => { renderLittle(); lastQuote = lastQuote; }); },
  });
}
function renderLittle() {
  $('#little-tools').replaceChildren(addBtn('＋ Thêm điều nhỏ bé', () => openLittleForm()));
  const list = S.little.filter((l) => !littleTab || l.kind === littleTab);
  const b = $('#little-body');
  b.replaceChildren(
    h('div', { class: 'filters' }, h('div', { class: 'chips' }, h('button', { class: 'chip' + (!littleTab ? ' on' : ''), onclick: () => ((littleTab = ''), renderLittle()) }, 'Tất cả'), Object.entries(LITTLE).map(([k, [i, n]]) => h('button', { class: 'chip' + (littleTab === k ? ' on' : ''), onclick: () => ((littleTab = k), renderLittle()) }, `${i} ${n}`)))),
    list.length
      ? h('div', { class: 'lt-grid' }, list.map((l) => h('article', { class: 'lt glass reveal' + (l.kind === 'nickname' ? ' nick' : '') },
          h('div', { class: 'k' }, `${LITTLE[l.kind]?.[0] || ''} ${LITTLE[l.kind]?.[1] || ''}`), h('p', null, l.body),
          h('div', { class: 'by' }, `${nm(l.from_who)} · ${fmtShort(l.created_at.slice(0, 10))}`),
          rowActs(() => openLittleForm(l), async () => (await confirmBox('Xoá mục này?')) && (await crud.del('little', l.id), refresh(renderLittle))))))
      : empty('Những điều nhỏ xíu nhưng đáng nhớ sẽ nằm ở đây.'),
  );
}

/* ═════ 09 · SURPRISE ═════ */
const SP_KINDS = {
  gift: ['🎁', 'Hộp quà bí mật', 'Một lời nhắn / bức ảnh chỉ hiện khi mở'],
  timed: ['⏳', 'Lời nhắn theo ngày', 'Tự mở khóa vào một ngày'],
  future: ['📮', 'Thư gửi tương lai', 'Niêm phong đến ngày hẹn'],
  hidden_photo: ['🫣', 'Ảnh ẩn', 'Ảnh bị làm mờ, chạm để xem'],
};
function openSurpriseKind() {
  const m = modal('Tạo một bất ngờ', h('div', { class: 'kinds' }, Object.entries(SP_KINDS).map(([k, [i, n, d]]) => h('button', { class: 'kind', onclick: () => (m.close(), setTimeout(() => openSurpriseForm(k), 320)) }, h('b', null, i), h('strong', null, n), h('span', null, d)))));
}
function openSurpriseForm(kind, row) {
  const needDate = kind === 'timed' || kind === 'future';
  const fields = [
    { name: 'title', label: 'Tiêu đề', ph: kind === 'future' ? 'Gửi chúng mình của năm sau' : 'Một điều bí mật…' },
    ...(kind !== 'hidden_photo' ? [{ name: 'content', label: 'Nội dung', type: 'textarea', rows: 6, required: kind !== 'gift' }] : []),
    ...(kind === 'gift' || kind === 'hidden_photo' ? [{ name: 'photo_key', label: 'Ảnh', type: 'photo' }] : []),
    ...(needDate ? [{ name: 'unlock_at', label: 'Mở khóa vào ngày', type: 'date', iso: true, required: true, min: todayStr(), hint: kind === 'future' ? 'Thư sẽ được niêm phong với cả bạn, đến ngày đó mới đọc được.' : 'Người ấy chỉ đọc được từ ngày này.' }] : []),
  ];
  formModal({
    title: row ? 'Sửa bất ngờ' : SP_KINDS[kind][1], values: row || {}, fields, submit: 'Cất đi 🎁',
    onSubmit: async (v) => {
      if (kind === 'hidden_photo' && !v.photo_key) throw new Error('Hãy chọn một tấm ảnh nhé');
      await crud.save('surprises', row?.id, { ...v, kind }); await refresh(renderSurprise);
    },
  });
}
function renderSurprise() {
  $('#surprise-tools').replaceChildren(addBtn('🎁 Tạo bất ngờ', openSurpriseKind));
  const b = $('#surprise-body');
  const sd = startDate();
  const next = sd ? nextOccurrence(S.settings.start_date, true) : null;
  const isDay = next && next.getTime() === startOfToday().getTime() && next.getFullYear() > sd.getFullYear();
  const cards = [];
  cards.push(h('article', { class: 'sp special glass reveal', onclick: () => (isDay ? showFest() : openFestInfo(next)) },
    h('div', { class: 'big' }, '🎆'), h('h4', null, S.settings.anniv_title || 'Trang kỷ niệm'),
    h('div', { class: 'st' }, !sd ? 'Hãy đặt ngày bắt đầu yêu nhau trong Cài đặt' : isDay ? 'Hôm nay rồi — chạm để mở! ✨' : `Mở vào ${fmtDate(ymd(next))} · còn ${Math.round((next - startOfToday()) / 864e5)} ngày`)));
  S.surprises.forEach((r) => {
    const own = r.from_who === S.me;
    const [icon, name] = SP_KINDS[r.kind] || ['🎁', ''];
    const lock = isLocked(r);
    const stat = lock ? `🔒 Mở ngày ${fmtDate(dayFromIso(r.unlock_at))}` : own ? `Bạn đã gửi${r.opened ? ' · đã được mở 💗' : ''}` : r.opened ? 'Đã mở' : `Từ ${nm(r.from_who)}`;
    const el = h('article', { class: 'sp glass reveal', onclick: () => openSurprise(r) },
      r.kind === 'hidden_photo' && r.photo_key ? h('div', { class: 'blur' }, h('img', { src: mu(r.photo_key), alt: '', loading: 'lazy' })) : h('div', { class: 'big' }, lock ? '🔒' : icon),
      h('h4', null, r.title || name), h('div', { class: 'st' }, stat),
      own ? rowActs(() => openSurpriseForm(r.kind, r), async () => (await confirmBox('Xoá bất ngờ này?')) && (await crud.del('surprises', r.id), refresh(renderSurprise))) : null);
    cards.push(el);
  });
  b.replaceChildren(h('div', { class: 'sp-grid' }, cards));
}
async function openSurprise(r) {
  if (isLocked(r)) return toast(`Chưa đến lúc đâu nhé, mở vào ${fmtDate(dayFromIso(r.unlock_at))} 🤫`);
  const own = r.from_who === S.me;
  const box = h('div', { class: 'reveal-box' },
    h('div', { class: 'gift-open' }, SP_KINDS[r.kind]?.[0] || '🎁'),
    r.title ? h('h3', null, r.title) : null,
    r.photo_key ? h('img', { src: mu(r.photo_key), alt: r.title || '' }) : null,
    r.content ? h('div', { class: 'msg' }, r.content) : null,
    h('div', { class: 'muted' }, `Từ ${nm(r.from_who)}`));
  modal('', box);
  if (!own && !r.opened) { try { await api(`surprises/${r.id}/open`, { method: 'POST' }); r.opened = 1; renderSurprise(); } catch {} }
}

/* ───── trang kỷ niệm ───── */
function festMarkup() {
  const sd = startDate();
  const years = sd ? new Date().getFullYear() - sd.getFullYear() : 0;
  return { years, title: S.settings.anniv_title || 'Happy Anniversary', msg: S.settings.anniv_message || 'Cảm ơn vì đã luôn ở bên nhau. Mong mình sẽ cùng nhau viết thêm thật nhiều trang nữa.' };
}
function showFest() {
  const { years, title, msg } = festMarkup();
  const f = h('div', { class: 'fest' });
  for (let i = 0; i < 26; i++) f.append(h('span', { class: 'petal', style: { left: rnd(0, 100) + '%', animationDuration: rnd(7, 14) + 's', animationDelay: -rnd(0, 12) + 's', fontSize: rnd(1, 2) + 'rem', '--dx': rnd(-80, 120) + 'px' } }, ['🌸', '💗', '✨', '🤍'][i % 4]));
  const close = () => { f.classList.remove('in'); setTimeout(() => f.remove(), 800); document.body.classList.remove('lock'); };
  f.append(h('div', { class: 'in-box' },
    h('div', { class: 'gate-mark' }, '♡'), h('h2', null, title),
    years > 0 ? h('div', { class: 'yrs' }, `${nm('A')} & ${nm('B')} · ${years} năm bên nhau`) : h('div', { class: 'yrs' }, `${nm('A')} & ${nm('B')}`),
    h('p', { class: 'msg' }, msg), h('button', { class: 'btn primary', onclick: close }, 'Tiếp tục khám phá')));
  document.body.append(f);
  document.body.classList.add('lock');
  requestAnimationFrame(() => f.classList.add('in'));
}
function openFestInfo() {
  const m = modal('Trang kỷ niệm', h('div', { class: 'form' }, h('p', null, 'Một trang đặc biệt sẽ tự mở vào đúng ngày kỷ niệm của hai bạn. Bạn có thể chỉnh lời nhắn trong Cài đặt.'), h('div', { class: 'form-actions' }, h('button', { class: 'btn ghost', onclick: () => (m.close(), setTimeout(showFest, 350)) }, 'Xem trước'), h('button', { class: 'btn primary', onclick: () => (m.close(), openSettings()) }, 'Chỉnh lời nhắn'))));
}
function checkAnniversary(auto) {
  const sd = startDate();
  if (!sd) return;
  const t = startOfToday();
  const hit = (sd.getMonth() === t.getMonth() && sd.getDate() === t.getDate() && sd.getFullYear() < t.getFullYear()) || S.special_days.some((r) => r.kind === 'anniversary' && parseYmd(r.date).getMonth() === t.getMonth() && parseYmd(r.date).getDate() === t.getDate());
  if (!hit) return;
  const k = 'lw_fest_' + todayStr();
  if (auto && localStorage.getItem(k)) return;
  try { localStorage.setItem(k, '1'); } catch {}
  setTimeout(showFest, 1200);
}

/* ═════ CÀI ĐẶT ═════ */
function openSettings() {
  formModal({
    title: 'Cài đặt',
    values: S.settings,
    fields: [
      { name: 'name_a', label: 'Tên của bạn / Người A', required: true, ph: 'Tên' },
      { name: 'name_b', label: 'Tên người ấy / Người B', required: true, ph: 'Tên' },
      { name: 'start_date', label: 'Ngày bắt đầu yêu nhau', type: 'date', required: true },
      { name: 'hero_key', label: 'Ảnh đại diện của hai người', type: 'photo' },
      { name: 'anniv_title', label: 'Tiêu đề trang kỷ niệm', ph: 'Happy Anniversary' },
      { name: 'anniv_message', label: 'Lời nhắn trong trang kỷ niệm', type: 'textarea', rows: 3 },
    ],
    onSubmit: async (v) => {
      v.hero_key = v.hero_key || '';
      await api('settings', { method: 'PUT', body: v });
      lastQuote = -1;
      await refresh(renderAll);
    },
    extra: h('div', { class: 'chips', style: { marginRight: 'auto' } },
      h('button', { type: 'button', class: 'btn ghost sm', onclick: openBgmForm }, '♪ Nhạc nền'),
      h('button', { type: 'button', class: 'btn ghost sm danger', onclick: async () => { await api('logout', { method: 'POST' }); location.reload(); } }, 'Đăng xuất')),
  });
}

boot();
