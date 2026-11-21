'use strict';
/* Cuốn sổ: chia trang, dán ảnh tự do, chữ tự né ảnh */

const NB = (() => {
  const LINE = 32; // chiều cao một dòng kẻ
  const FONT = '500 21px "Cormorant Garamond","Playfair Display",Georgia,serif';
  const MIN_SEG = 56; // khoảng trống hẹp hơn mức này thì bỏ qua
  const PAD = 12; // khoảng cách giữa chữ và ảnh
  const MAX_PAGES = 40;
  const mctx = document.createElement('canvas').getContext('2d');
  const W = (t) => ((mctx.font = FONT), mctx.measureText(t).width);

  const st = {}; // trạng thái từng chương
  const docs = {}; // dữ liệu trang tự do từng chương
  let order = [];
  let active = null;
  let M = {};
  let frame, view, rings, indic, prevB, nextB, writer, area, saveNote, bar;
  let raf = 0;

  const uid = () => Math.random().toString(36).slice(2, 10);

  /* ───── dựng khung sổ ───── */
  function build(host, chapters) {
    order = chapters.map((c) => c[0]);
    frame = h('div', { class: 'nb-frame', id: 'nbFrame' });
    rings = h('div', { class: 'nb-rings', 'aria-hidden': 'true' });
    view = h('div', { class: 'nb-view' });
    prevB = h('button', { class: 'nb-arrow l', type: 'button', 'aria-label': 'Trang trước', onclick: () => turn(-1) }, '‹');
    nextB = h('button', { class: 'nb-arrow r', type: 'button', 'aria-label': 'Trang sau', onclick: () => turn(1) }, '›');
    const paper = h('div', { class: 'nb-paper' });
    ['tl', 'tr', 'bl', 'br'].forEach((c) => paper.append(Deco.html(Deco.corner(c))));
    frame.append(paper, rings, view, prevB, nextB);
    chapters.forEach(([id, no, title, sub]) => {
      const flow = h('div', { class: 'nb-flow' },
        h('header', { class: 'sec-head' }, h('span', { class: 'no' }, no), h('h2', null, title), Deco.divider(), h('p', null, sub)),
        h('div', { class: 'tools', id: id + '-tools' }),
        h('div', { id: id + '-body' }),
      );
      const track = h('div', { class: 'nb-track' }, flow);
      const el = h('div', { class: 'nb-chap', 'data-ch': id }, track);
      view.append(el);
      st[id] = { id, el, track, flow, N: 1, cur: 0, pages: [], pe: new Map(), sel: null, timer: 0, dirty: false };
      new MutationObserver(() => schedule()).observe(flow, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
      flow.addEventListener('load', schedule, true);
    });

    indic = h('span', { class: 'nb-ind' }, '');
    saveNote = h('span', { class: 'nb-save muted' }, '');
    bar = h('div', { class: 'nb-bar' },
      h('div', { class: 'nb-bar-l' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => openWriter(true) }, '✎ Viết chữ'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: pickPhoto }, '＋ Dán ảnh'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: addPage }, '＋ Thêm trang'),
      ),
      h('div', { class: 'nb-bar-r' }, saveNote, indic),
    );
    area = h('textarea', { class: 'nb-area', rows: 5, placeholder: 'Viết gì đó vào trang sổ… Chữ sẽ tự chạy quanh những tấm ảnh bạn dán.', maxlength: 30000 });
    area.addEventListener('input', onType);
    writer = h('div', { class: 'nb-write glass', hidden: true },
      h('div', { class: 'nb-write-h' }, h('b', null, 'Viết vào trang sổ'), h('button', { class: 'btn primary sm', type: 'button', onclick: () => openWriter(false) }, 'Xong')),
      area,
      h('p', { class: 'hint' }, 'Mẹo: bấm vào một dòng chữ trên trang để viết tiếp ngay chỗ đó. Kéo ảnh đi đâu, chữ sẽ chạy theo.'),
    );
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, id: 'nbFile' });
    file.addEventListener('change', async () => { const l = [...file.files]; file.value = ''; for (const f of l) await addPhoto(f); });
    host.append(h('div', { class: 'nb-wrap' }, frame, bar, writer, file));

    // lật trang bằng vuốt ngang / bàn phím
    let sx = 0, sy = 0, tracking = false;
    view.addEventListener('pointerdown', (e) => { tracking = e.pointerType === 'touch' && !e.target.closest('.nb-pi,a,button,input,textarea,select,.nb-fp-x'); sx = e.clientX; sy = e.clientY; });
    view.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
    });
    document.addEventListener('keydown', (e) => {
      if ($('#book')?.hidden || !active || document.querySelector('.overlay')) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
      if (!typing && e.key === 'ArrowLeft') turn(-1);
      else if (!typing && e.key === 'ArrowRight') turn(1);
      else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && st[active]?.sel) removePhoto(st[active], st[active].sel);
    });
    window.addEventListener('resize', () => schedule(true));
    document.addEventListener('visibilitychange', () => document.hidden && flush());
    document.fonts?.ready.then(() => schedule(true));
  }

  /* ───── kích thước & chia trang ───── */
  function metrics() {
    frame.style.height = Math.max(470, Math.min(800, innerHeight - 214)) + 'px';
    const Wd = frame.clientWidth, H = frame.clientHeight;
    const spread = Wd >= 860;
    const pw = spread ? Wd / 2 : Wd;
    const px = Math.round(Math.min(36, Math.max(18, pw * 0.07)));
    const py = 30;
    M = { W: Wd, H, spread, pw, px, py, cw: pw - 2 * px, ch: H - 2 * py, per: spread ? 2 : 1 };
    frame.classList.toggle('spread', spread);
    const n = Math.floor((H - 40) / 26);
    if (rings.childElementCount !== n) rings.replaceChildren(...Array.from({ length: n }, () => h('i')));
  }

  function schedule(full) {
    if (full === true) schedule.full = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!frame || !frame.clientWidth) return;
      metrics();
      Object.values(st).forEach((s) => relayout(s));
      if (active) refresh(st[active]);
      schedule.full = false;
    });
  }

  function relayout(s) {
    const { px, py, cw, ch, pw } = M;
    s.flow.style.cssText = `left:${px}px;top:${py}px;width:${cw}px;height:${ch}px;column-width:${cw}px;column-gap:${2 * px}px`;
    s.N = Math.max(1, Math.round((s.flow.scrollWidth + 2 * px) / pw));
    buildFree(s);
  }

  const total = (s) => s.N + (docOf(s.id).pages.length || 0);
  const spreads = (s) => Math.max(1, Math.ceil(total(s) / M.per));

  function refresh(s) {
    s.cur = Math.min(s.cur, spreads(s) - 1);
    s.track.style.transform = `translateX(${-s.cur * M.per * M.pw}px)`;
    const T = total(s), a = s.cur * M.per + 1, b = Math.min(T, a + M.per - 1);
    indic.textContent = M.per === 2 && b > a ? `Trang ${a}–${b} / ${T}` : `Trang ${a} / ${T}`;
    prevB.disabled = s.cur <= 0;
    nextB.disabled = s.cur >= spreads(s) - 1;
  }

  function turn(d) {
    const s = st[active];
    if (!s) return;
    const n = Math.min(spreads(s) - 1, Math.max(0, s.cur + d));
    if (n !== s.cur) showSpread(s, n);
  }
  function showSpread(s, n) {
    s.track.classList.add('out');
    setTimeout(() => {
      s.cur = n;
      refresh(s);
      s.track.classList.remove('out');
    }, 140);
  }

  /* ───── trang tự do ───── */
  const docOf = (id) => (docs[id] ||= { text: '', pages: [] });

  function buildFree(s) {
    const doc = docOf(s.id);
    layoutText(s, doc); // có thể tự thêm trang khi chữ dài
    s.pages.forEach((p) => p.el.remove());
    s.pages = doc.pages.map((pg, i) => {
      const el = h('div', { class: 'nb-fp', style: { left: (s.N + i) * M.pw + 'px', width: M.pw + 'px', height: M.H + 'px' } },
        h('div', { class: 'nb-rule', style: { left: M.px + 'px', right: M.px + 'px', top: M.py + 'px', height: Math.floor(M.ch / LINE) * LINE + 'px' } }),
        h('div', { class: 'nb-txt' }),
        h('button', { class: 'nb-fp-x', type: 'button', title: 'Xoá trang này', 'aria-label': 'Xoá trang này', onclick: () => delPage(s, i) }, '✕'),
        h('span', { class: 'nb-fp-n' }, String(s.N + i + 1)),
      );
      el.addEventListener('pointerdown', (e) => { if (!e.target.closest('.nb-pi')) select(s, null); });
      s.track.append(el);
      return { el, pg };
    });
    const live = new Set();
    s.pages.forEach(({ el, pg }, i) => pg.photos.forEach((ph) => {
      live.add(ph.id);
      let pe = s.pe.get(ph.id);
      if (!pe) s.pe.set(ph.id, (pe = makePhoto(s, ph)));
      el.append(pe);
      placePhoto(pe, ph);
    }));
    [...s.pe.keys()].forEach((k) => !live.has(k) && (s.pe.get(k).remove(), s.pe.delete(k)));
    paintText(s);
    if (s.sel && !live.has(s.sel)) s.sel = null;
    [...s.pe].forEach(([k, pe]) => pe.classList.toggle('sel', k === s.sel));
  }

  function rectOf(ph) {
    const w = ph.w * M.pw, hh = w * ph.ar, r = (ph.r * Math.PI) / 180;
    const bw = Math.abs(w * Math.cos(r)) + Math.abs(hh * Math.sin(r));
    const bh = Math.abs(w * Math.sin(r)) + Math.abs(hh * Math.cos(r));
    const cx = ph.x * M.pw + w / 2, cy = ph.y * M.H + hh / 2;
    return { x: cx - bw / 2 - M.px, y: cy - bh / 2 - M.py, w: bw, h: bh };
  }

  /* chia chữ thành các dòng, né các vùng có ảnh */
  function layoutText(s, doc) {
    const { cw, ch } = M;
    const L = Math.max(1, Math.floor(ch / LINE));
    const obs = doc.pages.map((pg) => pg.photos.map(rectOf));
    const out = doc.pages.map(() => []);
    s.over = false;
    const segs = (p, line) => {
      const top = line * LINE, bot = top + LINE;
      const bl = (obs[p] || []).filter((r) => r.y < bot && r.y + r.h > top).map((r) => [r.x - PAD, r.x + r.w + PAD]).sort((a, b) => a[0] - b[0]);
      const res = [];
      let cur = 0;
      for (const [a, b] of bl) {
        if (a > cur) res.push([cur, Math.min(a, cw)]);
        cur = Math.max(cur, b);
      }
      if (cur < cw) res.push([cur, cw]);
      return res.filter(([a, b]) => b - a >= MIN_SEG);
    };
    let p = 0, line = 0, si = 0, list = null;
    const runs = new Map();
    const ensure = () => {
      while (p >= doc.pages.length) {
        if (doc.pages.length >= MAX_PAGES) return false;
        doc.pages.push({ photos: [] });
        obs.push([]);
        out.push([]);
        s.grew = true;
      }
      list ||= segs(p, line);
      return true;
    };
    const nextLine = () => {
      line++;
      if (line >= L) { p++; line = 0; }
      list = null;
      si = 0;
    };
    const text = doc.text || '';
    if (text.trim()) {
      let off = 0, first = true, stop = false;
      for (const para of text.split('\n')) {
        if (stop) break;
        if (!first) nextLine();
        first = false;
        const re = /\S+/g;
        let m;
        while ((m = re.exec(para))) {
          let word = m[0], wo = off + m.index;
          for (;;) {
            if (!ensure()) { stop = true; s.over = true; break; }
            const seg = list[si];
            if (!seg) { nextLine(); continue; }
            const segW = seg[1] - seg[0];
            const key = p + ':' + line + ':' + si;
            const run = runs.get(key);
            const joined = run ? run.text + ' ' + word : word;
            if (W(joined) <= segW) {
              if (run) run.text = joined;
              else { const r = { x: seg[0], line, text: word, off: wo }; runs.set(key, r); out[p].push(r); }
              break;
            }
            if (!run && W(word) > segW) { // từ quá dài: cắt theo ký tự
              let k = 1;
              while (k < word.length && W(word.slice(0, k + 1)) <= segW) k++;
              const r = { x: seg[0], line, text: word.slice(0, k), off: wo };
              runs.set(key, r);
              out[p].push(r);
              word = word.slice(k);
              wo += k;
              si++;
              if (!word) break;
              continue;
            }
            si++;
          }
        }
        off += para.length + 1;
      }
    }
    s.lines = out;
  }

  function paintText(s) {
    s.pages.forEach(({ el }, i) => {
      const layer = $('.nb-txt', el);
      layer.replaceChildren(...(s.lines[i] || []).map((r) => {
        const d = h('div', { class: 'nb-ln', style: { left: M.px + r.x + 'px', top: M.py + r.line * LINE + 'px' } }, r.text);
        d.addEventListener('click', (e) => {
          const x = e.clientX - d.getBoundingClientRect().left;
          let k = 0;
          while (k < r.text.length && W(r.text.slice(0, k + 1)) < x) k++;
          openWriter(true, r.off + k);
        });
        return d;
      }));
    });
  }

  function relayoutText(s) {
    const doc = docOf(s.id);
    s.grew = false;
    layoutText(s, doc);
    if (s.grew) return buildFree(s), refresh(s);
    paintText(s);
  }

  /* ───── ảnh dán ───── */
  function makePhoto(s, ph) {
    const img = h('img', { src: mu(ph.key), alt: '', draggable: false });
    const tb = h('div', { class: 'nb-tb' },
      h('button', { type: 'button', onclick: () => editPhoto(s, ph) }, '✎ Trang trí'),
      h('button', { type: 'button', onclick: () => front(s, ph) }, '▲ Lên'),
      h('button', { type: 'button', onclick: () => removePhoto(s, ph.id) }, '✕ Xoá'),
    );
    const rot = h('span', { class: 'nb-knob rot', title: 'Xoay' }, '⟳');
    const size = h('span', { class: 'nb-knob size', title: 'Đổi cỡ' }, '⤡');
    const el = h('div', { class: 'nb-pi' }, h('span', { class: 'nb-tape' }), img, Deco.tiny([...ph.id].reduce((a, c) => a + c.charCodeAt(0), 0)), tb, rot, size);
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.nb-tb')) return;
      drag(e, s, ph, el, e.target === rot ? 'rot' : e.target === size ? 'size' : 'move');
    });
    return el;
  }

  function placePhoto(el, ph) {
    const w = ph.w * M.pw;
    Object.assign(el.style, { left: ph.x * M.pw + 'px', top: ph.y * M.H + 'px', width: w + 'px', height: w * ph.ar + 'px', transform: `rotate(${ph.r}deg)`, zIndex: 2 + (ph.z || 0) });
  }

  const findPhoto = (s, id) => { for (const p of docOf(s.id).pages) { const ph = p.photos.find((x) => x.id === id); if (ph) return [ph, p]; } return [null, null]; };

  function select(s, id) {
    if (s.sel === id) return;
    s.sel = id;
    s.pe.forEach((pe, k) => pe.classList.toggle('sel', k === id));
  }
  function front(s, ph) {
    ph.z = Math.max(0, ...docOf(s.id).pages.flatMap((p) => p.photos.map((x) => x.z || 0))) + 1;
    placePhoto(s.pe.get(ph.id), ph);
    save(s);
  }

  function drag(e, s, ph, el, mode) {
    e.preventDefault();
    select(s, ph.id);
    const doc = docOf(s.id);
    let pgIdx = doc.pages.findIndex((p) => p.photos.includes(ph));
    const rect0 = s.pages[pgIdx].el.getBoundingClientRect();
    const gx = (e.clientX - rect0.left) / M.pw - ph.x, gy = (e.clientY - rect0.top) / M.H - ph.y;
    const o = { w: ph.w, sx: e.clientX };
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    let moved = false;
    const onMove = (ev) => {
      moved = true;
      if (mode === 'move') {
        let target = pgIdx;
        s.pages.forEach((p, i) => {
          const r = p.el.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) target = i;
        });
        if (target !== pgIdx) {
          doc.pages[pgIdx].photos.splice(doc.pages[pgIdx].photos.indexOf(ph), 1);
          doc.pages[target].photos.push(ph);
          s.pages[target].el.append(el);
          pgIdx = target;
        }
        const r = s.pages[pgIdx].el.getBoundingClientRect();
        ph.x = Math.min(0.95 - ph.w * 0.3, Math.max(-ph.w * 0.7, (ev.clientX - r.left) / M.pw - gx));
        ph.y = Math.min(0.97, Math.max(-0.1, (ev.clientY - r.top) / M.H - gy));
      } else if (mode === 'size') {
        ph.w = Math.min(1, Math.max(0.12, o.w + (ev.clientX - o.sx) / M.pw));
      } else {
        let a = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
        if (a > 180) a -= 360;
        ph.r = Math.abs(a) < 4 ? 0 : Math.round(a);
      }
      placePhoto(el, ph);
      cancelAnimationFrame(drag.raf);
      drag.raf = requestAnimationFrame(() => relayoutText(s));
    };
    const onUp = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      if (moved) { relayoutText(s); save(s); }
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
  }

  async function removePhoto(s, id) {
    const [ph, pg] = findPhoto(s, id);
    if (!ph) return;
    pg.photos.splice(pg.photos.indexOf(ph), 1);
    s.sel = null;
    buildFree(s);
    refresh(s);
    save(s);
  }

  function editPhoto(s, ph) {
    openEditor({
      src: mu(ph.key),
      onDone: async (blob, w, hh) => {
        try {
          ph.key = await uploadBlob(blob);
          ph.ar = hh / w;
          s.pe.get(ph.id)?.querySelector('img')?.setAttribute('src', mu(ph.key));
          placePhoto(s.pe.get(ph.id), ph);
          relayoutText(s);
          save(s);
        } catch (e) { toast(e.message); }
      },
    });
  }

  function pickPhoto() { document.getElementById('nbFile').click(); }

  async function addPhoto(file) {
    const s = st[active];
    if (!s || !file.type.startsWith('image/')) return;
    const note = toast('Đang dán ảnh…', 60000);
    try {
      const p = await prepImage(file, 1600);
      const key = await uploadBlob(p.blob);
      const doc = docOf(s.id);
      if (!doc.pages.length) doc.pages.push({ photos: [] });
      // ưu tiên trang tự do đang hiện trên màn hình
      const first = s.cur * M.per;
      let idx = doc.pages.findIndex((_, i) => s.N + i >= first && s.N + i < first + M.per);
      if (idx < 0) idx = 0;
      const ph = { id: uid(), key, x: 0.22 + Math.random() * 0.12, y: 0.12 + Math.random() * 0.15, w: M.spread ? 0.42 : 0.5, ar: p.h / p.w, r: Math.round(rnd(-5, 5)), z: 0 };
      doc.pages[idx].photos.push(ph);
      buildFree(s);
      front(s, ph);
      select(s, ph.id);
      const target = Math.floor((s.N + idx) / M.per);
      refresh(s);
      if (target !== s.cur) showSpread(s, target);
      save(s);
    } catch (e) { toast(e.message); } finally { note.remove(); }
  }

  function addPage() {
    const s = st[active];
    if (!s) return;
    const doc = docOf(s.id);
    if (doc.pages.length >= MAX_PAGES) return toast('Đã đủ số trang tối đa của chương này');
    doc.pages.push({ photos: [] });
    buildFree(s);
    refresh(s);
    showSpread(s, Math.floor((s.N + doc.pages.length - 1) / M.per));
    save(s);
  }

  async function delPage(s, i) {
    const doc = docOf(s.id);
    const has = doc.pages[i].photos.length;
    if (!(await confirmBox(has ? 'Xoá trang này cùng những ảnh đã dán?' : 'Xoá trang trống này?'))) return;
    doc.pages.splice(i, 1);
    s.sel = null;
    buildFree(s);
    refresh(s);
    save(s);
  }

  /* ───── viết chữ ───── */
  function openWriter(on, caret) {
    const s = st[active];
    if (!s) return;
    writer.hidden = !on;
    if (on) {
      area.value = docOf(s.id).text;
      area.focus();
      if (caret != null) area.setSelectionRange(caret, caret);
      writer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  function onType() {
    const s = st[active];
    const doc = docOf(s.id);
    doc.text = area.value;
    s.grew = false;
    cancelAnimationFrame(onType.raf);
    onType.raf = requestAnimationFrame(() => {
      relayoutText(s);
      // đi theo con trỏ: lật tới trang đang viết
      const pos = area.selectionStart;
      let pageIdx = -1;
      (s.lines || []).forEach((ls, i) => ls.forEach((r) => r.off <= pos && (pageIdx = i)));
      if (pageIdx >= 0) {
        const target = Math.floor((s.N + pageIdx) / M.per);
        if (target !== s.cur) showSpread(s, target);
      }
      refresh(s);
    });
    save(s);
  }

  /* ───── lưu ───── */
  function save(s) {
    s.dirty = true;
    saveNote.textContent = 'Đang lưu…';
    clearTimeout(s.timer);
    s.timer = setTimeout(() => flushOne(s), 900);
  }
  async function flushOne(s) {
    if (!s.dirty) return;
    s.dirty = false;
    clearTimeout(s.timer);
    try {
      await api('notebook/' + s.id, { method: 'PUT', body: { data: docOf(s.id) } });
      saveNote.textContent = 'Đã lưu';
      setTimeout(() => saveNote.textContent === 'Đã lưu' && (saveNote.textContent = ''), 1800);
    } catch (e) {
      s.dirty = true;
      saveNote.textContent = 'Chưa lưu được';
      toast(e.message);
    }
  }
  function flush() { Object.values(st).forEach((s) => s.dirty && flushOne(s)); }

  /* ───── API ngoài ───── */
  return {
    build,
    // nạp dữ liệu từ máy chủ (không ghi đè phần đang sửa dở)
    load(nb) {
      order.forEach((id) => {
        if (st[id]?.dirty) return;
        const d = nb?.[id];
        docs[id] = d && Array.isArray(d.pages) ? { text: d.text || '', pages: d.pages.map((p) => ({ photos: p.photos || [] })) } : docs[id] || { text: '', pages: [] };
      });
      schedule(true);
    },
    open(id) {
      if (!st[id]) return;
      flush();
      active = id;
      Object.values(st).forEach((s) => s.el.classList.toggle('on', s.id === id));
      writer.hidden = true;
      requestAnimationFrame(() => {
        metrics();
        Object.values(st).forEach(relayout);
        refresh(st[id]);
      });
    },
    schedule,
    flush,
  };
})();
